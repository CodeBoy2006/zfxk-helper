export function groupCoursesForDisplay(courses = []) {
  const groups = new Map();
  for (const course of courses) {
    const key = courseDisplayKey(course);
    const existing = groups.get(key);
    if (existing) {
      existing.courses.push(course);
      if (!existing.courseIds.includes(course.courseId)) existing.courseIds.push(course.courseId);
      addUnique(existing.ownershipNames, courseOwnershipLabel(course));
      existing.ownershipName = existing.ownershipNames.join('、') || undefined;
      continue;
    }
    const ownershipNames = [];
    addUnique(ownershipNames, courseOwnershipLabel(course));
    groups.set(key, {
      key,
      courseIds: [course.courseId],
      courses: [course],
      name: course.name,
      courseCode: course.courseCode || course.courseId,
      credit: course.credit,
      typeName: course.typeName,
      typeCode: course.typeCode,
      ownershipName: ownershipNames.join('、') || undefined,
      ownershipCode: course.ownershipCode,
      ownershipNames,
      recommended: course.recommended,
      hasPrerequisiteHint: course.hasPrerequisiteHint,
      retake: course.retake
    });
  }
  return [...groups.values()];
}

export function courseIdsForDisplayKey(courses = [], key) {
  const group = groupCoursesForDisplay(courses).find((item) => item.key === key);
  return group?.courseIds ?? (key ? [key] : []);
}

function courseDisplayKey(course = {}) {
  return String(course.courseCode || course.courseId || '');
}

function courseOwnershipLabel(course = {}) {
  return String(course.ownershipName || course.ownershipCode || '');
}

function addUnique(values, value) {
  const normalized = String(value || '').trim();
  if (normalized && !values.includes(normalized)) values.push(normalized);
}
