export function normalizeTitleCheck(data) {
  const flag = String(data?.flag ?? data);
  if (flag === '1') return { ok: true, raw: data };
  if (flag === '2') return { ok: false, code: 'CONFIRM_REQUIRED', message: data?.msg ?? '', raw: data };
  if (flag === '0' || flag === '3') return { ok: false, code: 'REJECTED', message: data?.msg ?? 'Rejected by title check.', raw: data };
  if (flag === '-1') return { ok: false, code: 'ILLEGAL_ACCESS', message: data?.msg ?? 'Illegal access.', raw: data };
  if (flag === '-2') return { ok: false, code: 'SESSION_EXPIRED', message: data?.msg ?? 'Refresh required.', raw: data };
  return { ok: false, code: 'UNKNOWN', message: data?.msg ?? 'Unknown title-check response.', raw: data };
}

export function normalizeConflictCheck(data) {
  const flag = String(data?.flag ?? data);
  if (flag === '1') return { ok: true, raw: data };
  if (flag === '2' || flag === '3' || flag === '4') {
    return { ok: false, code: 'CONFIRM_REQUIRED', message: data?.msg ?? '', raw: data };
  }
  if (flag === '5') return { ok: false, code: 'LISTENER_APPLY_REQUIRED', message: data?.msg ?? '', raw: data };
  return { ok: false, code: 'UNKNOWN', message: data?.msg ?? 'Unknown conflict-check response.', raw: data };
}

export function normalizeSaveSelection(data) {
  const flag = String(data?.flag ?? data);
  if (flag === '1' || flag === '6' || flag === '3') {
    return { ok: true, status: flag === '3' ? 'selected-with-message' : 'selected', raw: data };
  }
  if (flag === '-1') return { ok: false, code: 'CAPACITY_FULL', message: data?.msg ?? 'Capacity full.', raw: data };
  if (flag === '2') return { ok: false, code: 'CONFLICT', message: data?.msg ?? 'Schedule conflict.', raw: data };
  return { ok: false, code: 'REJECTED', message: data?.msg ?? 'Selection rejected.', raw: data };
}

export function normalizeDropSelection(data) {
  const flag = String(data?.flag ?? data);
  if (flag === '1') return { ok: true, raw: data };
  if (flag === '2') return { ok: false, code: 'SERVER_BUSY', message: 'Server busy.', raw: data };
  if (flag === '3') return { ok: false, code: 'UNKNOWN', message: 'Unknown drop failure.', raw: data };
  if (flag === '4') return { ok: false, code: 'ILLEGAL_ACCESS', message: 'Illegal access.', raw: data };
  if (flag === '5') return { ok: false, code: 'SESSION_EXPIRED', message: 'Drop check failed.', raw: data };
  return { ok: false, code: 'REJECTED', message: String(data ?? 'Drop rejected.'), raw: data };
}
