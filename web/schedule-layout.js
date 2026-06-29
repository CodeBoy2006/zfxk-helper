export const COURSE_COLOR_PALETTE = [
  { bg: '#dff3ff', border: '#1f8ac0', fg: '#0f3d57' },
  { bg: '#e3f8ec', border: '#229c68', fg: '#174a31' },
  { bg: '#fff1d6', border: '#d58a00', fg: '#5f3a00' },
  { bg: '#f2e7ff', border: '#8b5cf6', fg: '#42206e' },
  { bg: '#ffe4e8', border: '#e04462', fg: '#6b1b2b' },
  { bg: '#e9edff', border: '#5b6ee1', fg: '#253071' },
  { bg: '#ddf7f4', border: '#0f9f92', fg: '#124e49' },
  { bg: '#ffe9dc', border: '#eb7a34', fg: '#643118' },
  { bg: '#edf5dd', border: '#7cae25', fg: '#344d12' },
  { bg: '#f5e7d6', border: '#b97935', fg: '#583512' },
  { bg: '#e7f0ff', border: '#3a7bd5', fg: '#173d73' },
  { bg: '#f7e5f2', border: '#c45aa0', fg: '#653153' }
];

export function colorScheduleEntries(entries, palette = COURSE_COLOR_PALETTE) {
  if (!palette.length) return entries.map((entry) => ({ ...entry }));

  const courseKeys = [];
  const adjacency = new Map();
  for (const entry of entries) {
    const key = String(entry.courseKey ?? '');
    if (!adjacency.has(key)) {
      adjacency.set(key, new Set());
      courseKeys.push(key);
    }
  }

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex];
      const right = entries[rightIndex];
      const leftKey = String(left.courseKey ?? '');
      const rightKey = String(right.courseKey ?? '');
      if (leftKey === rightKey || left.day !== right.day) continue;
      if (!periodRangesTouch(left.periods, right.periods)) continue;
      adjacency.get(leftKey)?.add(rightKey);
      adjacency.get(rightKey)?.add(leftKey);
    }
  }

  const colorIndexByCourse = new Map();
  for (const courseKey of courseKeys) {
    const usedByNeighbors = new Set(
      [...(adjacency.get(courseKey) ?? [])]
        .map((neighborKey) => colorIndexByCourse.get(neighborKey))
        .filter((colorIndex) => colorIndex !== undefined)
    );
    const preferredIndex = stableColorIndex(courseKey, palette.length);
    colorIndexByCourse.set(courseKey, firstAvailableColor(preferredIndex, usedByNeighbors, palette.length));
  }

  return entries.map((entry) => {
    const colorIndex = colorIndexByCourse.get(String(entry.courseKey ?? '')) ?? 0;
    return {
      ...entry,
      color: palette[colorIndex],
      colorIndex
    };
  });
}

export function buildScheduleBlocks(entries, { weekdays = [], periods = [] } = {}) {
  const slots = new Map();
  for (const entry of entries) {
    for (const period of entry.periods ?? []) {
      const key = scheduleSlotKey(entry.day, period);
      const slotEntries = slots.get(key) ?? [];
      slotEntries.push(entry);
      slots.set(key, slotEntries);
    }
  }

  const blocksByStart = new Map();
  const coveredKeys = new Set();
  for (const day of weekdays) {
    let periodIndex = 0;
    while (periodIndex < periods.length) {
      const period = periods[periodIndex];
      const entriesAtPeriod = slots.get(scheduleSlotKey(day, period)) ?? [];
      if (!entriesAtPeriod.length) {
        periodIndex += 1;
        continue;
      }

      const signature = slotSignature(entriesAtPeriod);
      let endIndex = periodIndex;
      while (
        endIndex + 1 < periods.length
        && periods[endIndex + 1] === periods[endIndex] + 1
        && slotSignature(slots.get(scheduleSlotKey(day, periods[endIndex + 1])) ?? []) === signature
      ) {
        endIndex += 1;
      }

      const rowSpan = endIndex - periodIndex + 1;
      blocksByStart.set(scheduleSlotKey(day, period), {
        day,
        start: period,
        end: periods[endIndex],
        rowSpan,
        entries: entriesAtPeriod
      });

      for (let coveredIndex = periodIndex + 1; coveredIndex <= endIndex; coveredIndex += 1) {
        coveredKeys.add(scheduleSlotKey(day, periods[coveredIndex]));
      }
      periodIndex = endIndex + 1;
    }
  }

  return { slots, blocksByStart, coveredKeys };
}

export function scheduleSlotKey(day, period) {
  return `${day}:${period}`;
}

function firstAvailableColor(preferredIndex, usedByNeighbors, colorCount) {
  for (let offset = 0; offset < colorCount; offset += 1) {
    const candidate = (preferredIndex + offset) % colorCount;
    if (!usedByNeighbors.has(candidate)) return candidate;
  }
  return preferredIndex;
}

function periodRangesTouch(leftPeriods = [], rightPeriods = []) {
  if (!leftPeriods.length || !rightPeriods.length) return false;
  const leftStart = Math.min(...leftPeriods);
  const leftEnd = Math.max(...leftPeriods);
  const rightStart = Math.min(...rightPeriods);
  const rightEnd = Math.max(...rightPeriods);
  return leftStart <= rightEnd + 1 && rightStart <= leftEnd + 1;
}

function stableColorIndex(value, colorCount) {
  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return hash % colorCount;
}

function slotSignature(entries) {
  return entries
    .map((entry) => [
      entry.courseKey,
      entry.className,
      entry.weeks,
      entry.location,
      entry.teachers
    ].map((value) => String(value ?? '')).join('\u0001'))
    .sort()
    .join('\u0002');
}
