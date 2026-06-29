const LOCAL_MODES = new Set(['local', 'hybrid']);

export function splitFilterPayload(filterGroups = [], filters = {}) {
  const definitions = new Map(filterGroups.map((group) => [group.key, group]));
  const local = {};
  const remote = {};

  for (const [key, value] of Object.entries(filters)) {
    if (isBlank(value)) continue;
    const mode = definitions.get(key)?.mode ?? 'remote';
    if (LOCAL_MODES.has(mode)) local[key] = value;
    else remote[key] = value;
  }

  return { local, remote };
}

export function filterPayloadSignature(filters = {}) {
  return JSON.stringify(Object.entries(filters)
    .filter(([, value]) => !isBlank(value))
    .sort(([left], [right]) => left.localeCompare(right)));
}

export function applyLocalCourseFilters(courses = [], options = {}) {
  const keyword = normalizeText(options.keyword);
  const filters = options.filters ?? {};

  return courses.filter((course) => {
    if (keyword && !courseMatchesKeyword(course, keyword)) return false;
    for (const [key, value] of Object.entries(filters)) {
      if (isBlank(value)) continue;
      if (!courseMatchesLocalFilter(course, key, String(value))) return false;
    }
    return true;
  });
}

function courseMatchesKeyword(course, keyword) {
  return [
    course.courseId,
    course.courseCode,
    course.name,
    course.typeCode,
    course.typeName,
    course.ownershipCode,
    course.ownershipName,
    course.raw?.kch_id,
    course.raw?.kch,
    course.raw?.kcmc,
    course.raw?.jxb_id,
    course.raw?.do_jxb_id,
    course.raw?.jxbmc
  ].some((value) => normalizeText(value).includes(keyword));
}

function courseMatchesLocalFilter(course, key, value) {
  if (key === 'cxbj_list') return flagEquals(course.retake ?? course.raw?.cxbj, value);
  if (key === 'tjbj_list') return flagEquals(course.recommended ?? course.raw?.sftj, value);
  if (key === 'kcgs_list') return listFieldMatches(value, [
    course.ownershipCode,
    course.ownershipName,
    course.raw?.kcgsdm,
    course.raw?.kcgs_id,
    course.raw?.kcgs,
    course.raw?.kcgsmc
  ]);
  if (key === 'jxbmc_list') return normalizeText(course.raw?.jxbmc).includes(normalizeText(value));
  if (key === 'xf_list') return String(course.credit ?? course.raw?.xf ?? '') === value;
  return true;
}

function flagEquals(actual, expected) {
  const normalized = actual === true || actual === 1 || actual === '1' || actual === 'true' ? '1' : '0';
  return normalized === String(expected);
}

function listFieldMatches(value, fields) {
  const expected = normalizeText(value);
  return fields.some((field) => splitValues(field).some((item) => normalizeText(item) === expected));
}

function splitValues(value) {
  return String(value ?? '')
    .split(/[,\s、;；]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}
