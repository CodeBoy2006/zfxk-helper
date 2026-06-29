export type Mode = 'commit' | 'dry-run';

export interface RuntimeContext {
  baseUrl: string;
  term: { xkxnm: string; xkxqm: string };
  student: {
    xhId?: string;
    jgId?: string;
    zyhId: string;
    njdmId: string;
    zyfxId?: string;
    bhId?: string;
    xz?: string;
    ccdm?: string;
    campusId?: string;
  };
  current: {
    xkkzId: string;
    kklxdm: string;
    kklxmc?: string;
    xklc?: string;
    xkkzXh?: string;
  };
  switches: {
    isInSelectionTime: boolean;
    canSelect: boolean;
    canDrop: boolean;
    useWeight: boolean;
    enableTextbook: boolean;
    enableWaitlist: boolean;
    enableListenerApply: boolean;
  };
  raw: Record<string, string>;
}

export interface Teacher {
  id?: string;
  name?: string;
  title?: string;
  raw: string;
}

export interface Course {
  courseId: string;
  courseCode?: string;
  name: string;
  credit: number;
  typeCode: string;
  typeName?: string;
  ownershipCode?: string;
  ownershipName?: string;
  retake: boolean;
  hasPrerequisiteHint: boolean;
  recommended?: boolean;
  raw: Record<string, unknown>;
}

export interface TeachingClass {
  classId: string;
  submitClassId: string;
  courseId: string;
  name: string;
  childClassCount: number;
  credit: number;
  selectedCount: number;
  capacity: number;
  currentRound: { capacity: number; selected: number };
  teachers: Teacher[];
  scheduleText?: string;
  locationText?: string;
  examText?: string;
  campusId?: string;
  collegeName?: string;
  ownershipCode?: string;
  ownershipName?: string;
  flags: {
    selected: boolean;
    full: boolean;
    canSelect: boolean;
    canDrop?: boolean;
    hasTextbook?: boolean;
    retake?: boolean;
    auxiliary?: boolean;
  };
  raw: Record<string, unknown>;
}

export interface SelectedClass {
  classId: string;
  submitClassId: string;
  courseId: string;
  name: string;
  order?: number;
  weight?: number;
  selectedBySystem: boolean;
  selfSelected: boolean;
  canDrop: boolean;
  credit?: number;
  teachers?: Teacher[];
  scheduleText?: string;
  locationText?: string;
  ownershipCode?: string;
  ownershipName?: string;
  raw: Record<string, unknown>;
}

export interface SelectedCourse {
  courseId: string;
  courseCode?: string;
  name: string;
  credit: number;
  typeCode: string;
  ownershipCode?: string;
  ownershipName?: string;
  retake: boolean;
  classes: SelectedClass[];
  raw: Record<string, unknown>;
}

export interface SelectionSnapshot {
  selectedCourses: SelectedCourse[];
  selectedClasses: SelectedClass[];
  totals: { courseCount: number; credit: number; teachingClassCredit: number };
  byCourseId: Map<string, SelectedCourse>;
  byClassId: Map<string, SelectedClass>;
  version: string;
  fetchedAt: Date;
}

export interface CourseTypeOption {
  label: string;
  kklxdm: string;
  xkkzId: string;
  njdmId: string;
  zyhId: string;
  xkkzXh: string;
  active: boolean;
}

export interface ZfxkClientOptions {
  baseUrl: string;
  auth?: { type: 'cookie'; cookie: string } | { type: 'custom'; [key: string]: unknown };
  mode?: Mode;
  context?: RuntimeContext;
  transport?: Transport;
}

export interface Transport {
  get?(path: string, options?: Record<string, unknown>): Promise<unknown>;
  post(path: string, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

export declare const endpoints: Record<string, string>;

export interface CaptchaSolveResult {
  status: 'success';
  cookies: Record<string, string>;
  cookieHeader: string;
  distance: number;
}

export interface ZfLoginPublicKey {
  modulus: string;
  exponent: string;
}

export interface ZfLoginResult {
  status: 'success';
  cookies: Record<string, string>;
  cookieHeader: string;
  responseUrl: string;
  attempts: number;
}

export interface LoginWithZfCaptchaOptions {
  baseUrl: string;
  username: string;
  password: string;
  appPath?: string;
  loginPath?: string;
  maxCaptchaAttempts?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
  templateDir?: string;
  instanceId?: string;
  language?: string;
  userAgent?: string;
  publicKey?: ZfLoginPublicKey;
  cookieJar?: CookieJar;
  checkIdentityConfirmation?: boolean;
  checkLoginLock?: boolean;
  solveCaptcha?: (input: LoginWithZfCaptchaOptions & { cookieJar: CookieJar; attempt: number }) => Promise<unknown>;
}

export declare function createZfxkClient(options: ZfxkClientOptions): ZfxkClient;
export declare function loginWithZfCaptcha(options: LoginWithZfCaptchaOptions): Promise<ZfLoginResult>;
export declare function encryptZfPassword(password: string, publicKey: ZfLoginPublicKey): string;
export declare function solveZfCaptcha(options: { baseUrl: string; templateDir?: string; fetchImpl?: typeof fetch; instanceId?: string; userAgent?: string; cookieJar?: CookieJar }): Promise<CaptchaSolveResult>;
export declare function formatCookieHeader(cookies: Record<string, string>): string;
export declare function resolveAppBaseUrl(baseUrl: string, appPath?: string): string;
export declare function generateMouseTrack(distance: number, options?: Record<string, unknown>): Array<{ x: number; y: number; t: number }>;
export declare function buildVerifyPayload(input: { rtk: string; instanceId: string; mouseTrack: Array<{ x: number; y: number; t: number }>; userAgent: string; now?: () => number }): URLSearchParams;
export declare function generateFingerprint(image: { width: number; height: number; data: Uint8Array }): string;
export declare function findGapByComparison(background: { width: number; height: number; data: Uint8Array }, template: { width: number; height: number; data: Uint8Array }, options?: Record<string, unknown>): number;
export declare function loadRuntimeContext(input: { baseUrl?: string; html?: string; raw?: Record<string, string>; context?: RuntimeContext }): RuntimeContext;
export declare function extractHiddenFields(html: string): Record<string, string>;
export declare function parseCourseTypeOptions(input: string | { html?: string; raw?: Record<string, string> }): CourseTypeOption[];
export declare function mapCourse(row: Record<string, unknown>): Course;
export declare function mapTeachingClass(row: Record<string, unknown>): TeachingClass;
export declare function normalizeSaveSelection(data: unknown): unknown;

export declare class MemoryTransport implements Transport {
  calls: Array<{ method: string; path: string; data: Record<string, unknown>; options: Record<string, unknown> }>;
  constructor(routes?: Record<string, unknown>);
  queue(path: string, response: unknown): void;
  get(path: string, options?: Record<string, unknown>): Promise<unknown>;
  post(path: string, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

export declare class HttpTransport implements Transport {
  constructor(options: { baseUrl: string; auth?: ZfxkClientOptions['auth']; fetchImpl?: typeof fetch });
  get(path: string, options?: Record<string, unknown>): Promise<unknown>;
  post(path: string, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

export declare class CookieJar {
  constructor(initialCookies?: Record<string, string>);
  storeFromHeaders(headers: Headers | string[] | Record<string, string | string[]>): void;
  get(name: string): string | undefined;
  entries(): Array<[string, string]>;
  toObject(names?: string[]): Record<string, string>;
  header(): string;
}

export declare class ZfLoginError extends Error {
  name: 'ZfLoginError';
  code: string;
  status?: number;
  responseUrl?: string;
  secondsRemaining?: number;
}

export declare class ImageMatcher {
  templates: Map<string, { name: string; image: { width: number; height: number; data: Uint8Array }; fingerprint: string }>;
  constructor(entries?: Array<{ name: string; image: { width: number; height: number; data: Uint8Array } }>);
  static fromDirectory(templateDir: string): Promise<ImageMatcher>;
  add(name: string, image: { width: number; height: number; data: Uint8Array }): void;
  findMatch(image: { width: number; height: number; data: Uint8Array }): { name: string; image: { width: number; height: number; data: Uint8Array }; fingerprint: string };
}

export declare class CaptchaSolver {
  constructor(options: { baseUrl: string; templateDir?: string; fetchImpl?: typeof fetch; instanceId?: string; userAgent?: string; matcher?: ImageMatcher; cookieJar?: CookieJar });
  static fromTemplates(options: { baseUrl: string; templateDir?: string; fetchImpl?: typeof fetch; instanceId?: string; userAgent?: string; matcher?: ImageMatcher; cookieJar?: CookieJar }): Promise<CaptchaSolver>;
  solve(): Promise<CaptchaSolveResult>;
}

export declare class ZfxkClient {
  context: RuntimeContext;
  catalog: {
    searchCourses(query?: Record<string, unknown>): Promise<Course[]>;
    getTeachingClasses(courseId: string, query?: Record<string, unknown>): Promise<TeachingClass[]>;
  };
  chosen: {
    snapshot(): Promise<SelectionSnapshot>;
    listSelected(): Promise<SelectedClass[]>;
    hasSelected(input: { courseId?: string; classId?: string }): Promise<boolean>;
  };
  selection: {
    choose(input: Record<string, unknown>, policy?: Record<string, (...args: any[]) => Promise<unknown>>): Promise<Record<string, unknown>>;
    drop(input: Record<string, unknown>, policy?: Record<string, (...args: any[]) => Promise<unknown>>): Promise<Record<string, unknown>>;
    quickSelect(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
    reorder(input: { classIds: string[] }): Promise<SelectionSnapshot>;
    updateWeight(input: { classId: string; submitClassId?: string; weight: number }): Promise<SelectionSnapshot>;
    plan(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  textbook: Record<string, (...args: any[]) => Promise<unknown>>;
  waitlist: Record<string, (...args: any[]) => Promise<unknown>>;
  listener: Record<string, (...args: any[]) => Promise<unknown>>;
  constructor(options: ZfxkClientOptions);
  bootstrap(input?: { html?: string; raw?: Record<string, string>; context?: RuntimeContext }): Promise<RuntimeContext>;
  bootstrapFromPage(input: { path: string; raw?: Record<string, string>; request?: Record<string, unknown> }): Promise<RuntimeContext>;
  refreshContext(input?: { html?: string; raw?: Record<string, string>; context?: RuntimeContext }): Promise<RuntimeContext>;
}
