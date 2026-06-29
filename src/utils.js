export function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function number(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function compact(record) {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

export function joinCsv(value) {
  return Array.isArray(value) ? value.join(',') : String(value ?? '');
}

export function firstDefined(...values) {
  const found = values.find((value) => value !== undefined && value !== null && value !== '');
  return found === undefined && values.length ? values.at(-1) : found;
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

export function buildFormBody(data) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(compact(data))) {
    body.set(key, joinCsv(value));
  }
  return body;
}
