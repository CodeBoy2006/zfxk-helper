import { loadRuntimeContext } from './context.js';
import { CatalogService, ChosenService, ListenerService, SelectionService, TextbookService, WaitlistService } from './services.js';
import { HttpTransport } from './transport.js';

export class ZfxkClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl ?? '').replace(/\/$/, '');
    this.auth = options.auth;
    this.mode = options.mode ?? 'commit';
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
    if (input.html || input.raw || input.context) {
      this.context = loadRuntimeContext({ baseUrl: this.baseUrl, ...input });
    }
    return this.requireContext();
  }

  async refreshContext(input = {}) {
    return this.bootstrap(input);
  }

  requireContext() {
    if (!this.context) {
      throw new Error('Runtime context is not loaded. Call bootstrap({ html }) or pass context when creating the client.');
    }
    return this.context;
  }
}

export function createZfxkClient(options = {}) {
  return new ZfxkClient(options);
}
