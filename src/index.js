export { createZfxkClient, ZfxkClient } from './client.js';
export { endpoints } from './endpoints.js';
export { extractHiddenFields, loadRuntimeContext, buildContextRequest } from './context.js';
export { parseCourseTypeOptions } from './course-types.js';
export { mapCourse, mapTeachingClass, mapSelectionSnapshot, parseTeachers } from './mappers.js';
export { normalizeConflictCheck, normalizeDropSelection, normalizeSaveSelection, normalizeTitleCheck } from './normalizers.js';
export { HttpTransport, MemoryTransport } from './transport.js';
export { encryptZfPassword, loginWithZfCaptcha, ZfLoginError } from './auth/index.js';
export {
  CaptchaSolver,
  CookieJar,
  ImageMatcher,
  buildVerifyPayload,
  findGapByComparison,
  formatCookieHeader,
  generateFingerprint,
  generateMouseTrack,
  resolveAppBaseUrl,
  solveZfCaptcha
} from './captcha/index.js';
export {
  CatalogService,
  ChosenService,
  ListenerService,
  SelectionService,
  TextbookService,
  WaitlistService
} from './services.js';
