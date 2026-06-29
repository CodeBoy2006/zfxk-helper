const SECRET_PATTERNS = [
  /JSESSIONID=[^;\s]+/gi,
  /route=[^;\s]+/gi,
  /password["':=\s]+[^"',\s]+/gi,
  /cookie["':=\s]+[^"',\n]+/gi
];

export function createAutoSelectionEventLog(limit = 200) {
  const entries = [];
  return {
    entries,
    add(type, message, details = {}) {
      const event = {
        id: `evt_${Date.now()}_${entries.length + 1}`,
        at: new Date().toISOString(),
        type,
        message: redact(message),
        details: redactObject(details)
      };
      entries.push(event);
      while (entries.length > limit) entries.shift();
      return event;
    },
    list() {
      return entries.slice();
    }
  };
}

export function redact(value) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted]'), String(value ?? ''));
}

function redactObject(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (/password|cookie|authorization/i.test(key)) return '[redacted]';
    return typeof item === 'string' ? redact(item) : item;
  }));
}
