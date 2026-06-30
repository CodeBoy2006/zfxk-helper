import { buildContextRequest, extractHiddenFields, loadRuntimeContext } from './context.js';
import { endpoints } from './endpoints.js';
import { CatalogService, ChosenService, ListenerService, SelectionService, TextbookService, WaitlistService } from './services.js';
import { HttpTransport } from './transport.js';

export class ZfxkClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl ?? '').replace(/\/$/, '');
    this.auth = options.auth;
    this.mode = options.mode ?? 'commit';
    this.entryHtml = '';
    this.entryPath = options.pagePath ?? options.entryPath ?? '';
    this.context = options.context ? loadRuntimeContext({ baseUrl: this.baseUrl, context: options.context }) : undefined;
    this.transport = options.transport ?? new HttpTransport({ baseUrl: this.baseUrl, auth: this.auth });
    this.catalog = new CatalogService(this);
    this.chosen = new ChosenService(this);
    this.selection = new SelectionService(this);
    this.textbook = new TextbookService(this);
    this.waitlist = new WaitlistService(this);
    this.listener = new ListenerService(this);
  }

  async bootstrap(input = {}) {
    if (typeof input.html === 'string') this.entryHtml = input.html;
    if (input.pagePath || input.path) this.entryPath = input.pagePath ?? input.path;
    if (input.html || input.raw || input.context) {
      this.context = loadRuntimeContext({ baseUrl: this.baseUrl, ...input });
    }
    return this.requireContext();
  }

  async bootstrapFromPage(input = {}) {
    const path = input.path;
    if (!path) throw new Error('bootstrapFromPage requires a page path.');
    if (typeof this.transport.get !== 'function') {
      throw new Error('Current transport does not support GET requests.');
    }

    const html = await this.transport.get(path, input.request);
    if (typeof html !== 'string') {
      throw new Error('CONTEXT_NOT_FOUND: expected an HTML page response.');
    }
    this.entryHtml = html;
    this.entryPath = path;

    const context = loadRuntimeContext({
      baseUrl: this.baseUrl,
      html,
      raw: input.raw
    });
    assertSelectionContext(context);
    this.context = context;
    return context;
  }

  async refreshContext(input = {}) {
    return this.bootstrap({
      context: input.context ?? this.context,
      html: input.html ?? this.entryHtml,
      raw: input.raw
    });
  }

  async loadCourseTypeDisplayContext(input = {}) {
    if (input.pagePath || input.path) this.entryPath = input.pagePath ?? input.path;
    const context = await this.refreshContext({
      context: input.context ?? this.context,
      html: input.html ?? this.entryHtml,
      raw: input.raw
    });
    let display;
    try {
      display = await this.transport.post(
        this.functionPath(endpoints.display, input.gnmkdm),
        buildContextRequest(context, {
          kspage: input.page?.start ?? 0,
          jspage: input.page?.size ?? 0,
          ...(input.extra ?? {})
        })
      );
    } catch (error) {
      if (input.allowFallback) return context;
      throw error;
    }

    if (typeof display !== 'string') {
      if (input.allowFallback) return context;
      throw new Error('CONTEXT_NOT_FOUND: expected course-type display HTML.');
    }

    this.context = loadRuntimeContext({
      baseUrl: this.baseUrl,
      context,
      html: display,
      raw: {
        ...extractHiddenFields(display),
        ...(input.raw ?? {})
      }
    });
    return this.requireContext();
  }

  requireContext() {
    if (!this.context) {
      throw new Error('Runtime context is not loaded. Call bootstrap({ html }) or pass context when creating the client.');
    }
    return this.context;
  }

  functionPath(path, gnmkdm) {
    return withGnmkdm(path, gnmkdm ?? gnmkdmFromPath(this.entryPath));
  }
}

export function createZfxkClient(options = {}) {
  return new ZfxkClient(options);
}

function assertSelectionContext(context) {
  const missing = [];
  if (!context.term.xkxnm) missing.push('xkxnm');
  if (!context.term.xkxqm) missing.push('xkxqm');
  if (!context.current.xkkzId) missing.push('xkkz_id');
  if (!context.current.kklxdm) missing.push('kklxdm');
  if (missing.length) {
    throw new Error(`CONTEXT_NOT_FOUND: missing ${missing.join(', ')}. The page may be a login page or an unsupported selection entry.`);
  }
}

function withGnmkdm(path, gnmkdm) {
  if (!gnmkdm) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}gnmkdm=${encodeURIComponent(gnmkdm)}`;
}

function gnmkdmFromPath(path = '') {
  if (!path) return '';
  try {
    return new URL(path, 'https://zfxk.local').searchParams.get('gnmkdm') ?? '';
  } catch {
    return '';
  }
}
