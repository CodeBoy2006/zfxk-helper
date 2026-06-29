import {
  exportAutoSelectionConfig,
  importAutoSelectionConfig,
  normalizeAutoSelectionConfig,
  validateAutoSelectionConfig
} from './config.js';
import { AutoSelectionTaskRunner } from './task-runner.js';

export class AutoSelectionTaskManager {
  constructor(options = {}) {
    this.tasks = new Map();
    this.nextId = 1;
    this.options = options;
  }

  async createTask(input = {}) {
    const validation = validateAutoSelectionConfig(input, { requireCredentials: true });
    if (!validation.valid) {
      const error = new Error(validation.errors.join('; '));
      error.code = 'AUTO_SELECTION_CONFIG_INVALID';
      error.errors = validation.errors;
      throw error;
    }

    const id = `task_${Date.now()}_${this.nextId++}`;
    const runner = new AutoSelectionTaskRunner({
      id,
      config: normalizeAutoSelectionConfig(input),
      autoStart: this.options.autoStartTasks !== false,
      login: this.options.login,
      createClient: this.options.createClient
    });
    this.tasks.set(id, runner);
    if (this.options.autoStartTasks === false) await runner.tick();
    return runner.snapshot();
  }

  listTasks() {
    return [...this.tasks.values()].map((task) => task.snapshot());
  }

  getTask(id) {
    return this.tasks.get(id)?.snapshot() ?? null;
  }

  getTaskEvents(id) {
    return this.tasks.get(id)?.events.list() ?? null;
  }

  cancelTask(id) {
    return this.tasks.get(id)?.cancel() ?? null;
  }

  pauseTask(id) {
    return this.tasks.get(id)?.pause() ?? null;
  }

  resumeTask(id) {
    return this.tasks.get(id)?.resume() ?? null;
  }

  validateConfig(input) {
    return validateAutoSelectionConfig(input, { requireCredentials: false });
  }

  importConfig(input) {
    return importAutoSelectionConfig(input);
  }

  exportConfig(input) {
    return exportAutoSelectionConfig(input);
  }
}
