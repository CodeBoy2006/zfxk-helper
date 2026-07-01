import { createZfxkClient } from '../client.js';
import { loginWithZfCaptcha } from '../auth/index.js';
import { parseCourseTypeOptions } from '../course-types.js';
import { createAutoSelectionEventLog } from './events.js';
import { isGroupSucceeded, chooseTarget, planGroupAction, reconcileGroups } from './group-runner.js';
import { maskUsername } from './config.js';
import { isSessionError } from './outcomes.js';
import { upgradeTarget } from './upgrade-runner.js';

const MAX_BACKOFF_FACTOR = 16;

export class AutoSelectionTaskRunner {
  constructor(options = {}) {
    this.id = options.id;
    this.config = options.config;
    this.status = 'queued';
    this.authStatus = 'logged-out';
    this.attempts = 0;
    this.nextRunAt = null;
    this.startedAt = new Date();
    this.events = options.events ?? createAutoSelectionEventLog();
    this.login = options.login ?? loginWithZfCaptcha;
    this.createClient = options.createClient ?? defaultCreateClient;
    this.client = options.client;
    this.timer = null;
    this.isTicking = false;
    this.writeLock = false;
    this.pauseScope = undefined;
    this.autoStart = options.autoStart !== false;
    this.consecutiveFailures = 0;
    this.courseTypes = options.courseTypes ?? [];
    if (this.autoStart) this.start();
  }

  start() {
    if (this.status === 'cancelled') return;
    this.status = 'running';
    this.schedule(0);
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.status = 'cancelled';
    this.events.add('task-cancelled', 'Task cancelled');
    return this.snapshot();
  }

  pause() {
    if (['cancelled', 'succeeded', 'failed'].includes(this.status)) return this.snapshot();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.status = 'paused';
    this.pauseScope = 'task';
    this.events.add('task-paused', 'Task paused');
    return this.snapshot();
  }

  resume() {
    if (this.status !== 'paused') return this.snapshot();
    this.pauseScope = undefined;
    for (const group of this.config.groups) {
      if (group.state === 'PAUSED') group.state = group.currentPlacement ? 'HOLDING' : 'WATCHING';
      group.pauseScope = undefined;
    }
    this.status = 'running';
    this.schedule(0);
    return this.snapshot();
  }

  schedule(delay = this.config.intervalMs) {
    if (!this.autoStart || this.status === 'cancelled') return;
    if (this.timer) clearTimeout(this.timer);
    this.nextRunAt = new Date(Date.now() + delay);
    this.timer = setTimeout(() => {
      this.tick().catch((error) => this.handleTickError(error));
    }, delay);
  }

  async tick() {
    if (this.isTicking || this.status === 'cancelled' || this.status === 'paused') return this.snapshot();
    this.isTicking = true;
    try {
      this.attempts += 1;
      await this.ensureAuthenticated();

      const snapshot = await this.client.chosen.snapshot();
      reconcileGroups(this.config.groups, snapshot);

      for (const group of this.config.groups) {
        if (this.writeLock) break;
        if (['PAUSED', 'FAILED', 'SUCCEEDED'].includes(group.state)) continue;
        const action = await planGroupAction(this, group);
        if (action.type === 'none') continue;
        await this.withWriteLock(async () => {
          if (action.type === 'choose') await chooseTarget(this, group, action.target, { teachingClass: action.teachingClass });
          if (action.type === 'upgrade') await upgradeTarget(this, group, action.current, action.next, { teachingClass: action.teachingClass });
        });
        break;
      }

      this.updateStatus();
      this.resetBackoff();
      return this.snapshot();
    } catch (error) {
      if (isSessionError(error)) {
        await this.handleSessionError(error);
      } else {
        this.handleTransientError(error);
      }
      return this.snapshot();
    } finally {
      this.isTicking = false;
      if (this.autoStart && this.status === 'running') this.schedule(this.nextDelay());
    }
  }

  async ensureAuthenticated() {
    if (this.client) return;
    await this.refreshAuth();
  }

  async refreshAuth() {
    this.status = 'auth-refreshing';
    let cookie = this.config.cookie;
    if (this.config.password) {
      const login = await this.login({
        baseUrl: this.config.baseUrl,
        username: this.config.username,
        password: this.config.password,
        maxCaptchaAttempts: 3
      });
      cookie = login.cookieHeader;
    }

    this.client = this.createClient({
      baseUrl: this.config.baseUrl,
      cookie,
      config: this.config
    });
    await this.client.bootstrapFromPage({ path: this.config.pagePath });
    this.courseTypes = parseCourseTypeOptions(this.client.entryHtml ?? '');
    this.authStatus = 'logged-in';
    this.status = 'running';
    this.events.add('auth-refreshed', 'Authentication ready');
  }

  async handleSessionError(error) {
    this.client = null;
    if (this.status === 'auth-refreshing') {
      this.handleAuthRefreshFailure(error);
      return;
    }

    try {
      await this.refreshAuth();
      this.resetBackoff();
    } catch (authError) {
      this.handleAuthRefreshFailure(authError);
    }
  }

  handleAuthRefreshFailure(error) {
    this.client = null;
    this.authStatus = 'logged-out';
    this.events.add('auth-refresh-failed', error.message);
    if (this.status !== 'cancelled') this.status = 'running';
  }

  handleTransientError(error) {
    this.recordFailure();
    this.events.add('task-error', error.message);
    if (this.status !== 'cancelled') this.status = 'running';
  }

  async withWriteLock(operation) {
    if (this.writeLock) return;
    this.writeLock = true;
    try {
      await operation();
    } finally {
      this.writeLock = false;
    }
  }

  updateStatus() {
    if (this.config.groups.every(isGroupSucceeded)) {
      this.status = 'succeeded';
    } else if (this.config.groups.every((group) => group.state === 'FAILED')) {
      this.status = 'failed';
    } else if (this.pauseScope === 'task' || this.config.groups.every((group) => group.state === 'PAUSED' || group.state === 'FAILED')) {
      this.status = 'paused';
    } else if (this.config.maxAttempts && this.attempts >= this.config.maxAttempts) {
      this.status = 'paused';
    } else {
      this.status = 'running';
    }
  }

  handleTickError(error) {
    this.recordFailure();
    this.events.add('task-error', error.message);
    if (this.status === 'running') this.schedule(this.nextDelay());
  }

  recordFailure() {
    this.consecutiveFailures += 1;
  }

  resetBackoff() {
    this.consecutiveFailures = 0;
  }

  nextDelay() {
    if (this.consecutiveFailures <= 0) return this.config.intervalMs;
    const factor = Math.min(2 ** this.consecutiveFailures, MAX_BACKOFF_FACTOR);
    return this.config.intervalMs * factor;
  }

  snapshot() {
    return {
      id: this.id,
      status: this.status,
      usernameMasked: maskUsername(this.config.username),
      authStatus: this.authStatus,
      pauseScope: this.pauseScope,
      attempts: this.attempts,
      intervalMs: this.config.intervalMs,
      nextRunAt: this.nextRunAt?.toISOString() ?? null,
      startedAt: this.startedAt.toISOString(),
      groups: this.config.groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
        strategy: group.strategy,
        state: group.state,
        currentTargetId: group.currentPlacement?.targetId ?? null,
        currentPriority: group.currentPlacement?.priority ?? null,
        isTopTargetSelected: group.isTopTargetSelected,
        pauseScope: group.pauseScope,
        lastMessage: group.lastMessage || '',
        targets: group.targets.map((target) => ({
          targetId: target.targetId,
          courseId: target.courseId,
          classId: target.classId,
          submitClassId: target.submitClassId,
          label: target.label,
          courseType: target.courseType,
          priority: target.priority,
          isBackup: target.isBackup,
          allowAutoDrop: target.allowAutoDrop,
          recoverOnUpgradeFailure: target.recoverOnUpgradeFailure,
          skipAfterNonCapacityFailure: target.skipAfterNonCapacityFailure,
          status: target.status,
          lastObservedRemaining: target.lastObservedRemaining,
          lastMessage: target.lastMessage
        }))
      })),
      events: this.events.list()
    };
  }
}

function defaultCreateClient({ baseUrl, cookie }) {
  return createZfxkClient({
    baseUrl,
    mode: 'commit',
    auth: { type: 'cookie', cookie }
  });
}
