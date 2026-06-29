export function groupCoursesForDisplay(courses = []) {
  const groups = new Map();
  for (const course of courses) {
    const key = courseDisplayKey(course);
    const existing = groups.get(key);
    if (existing) {
      existing.courses.push(course);
      if (!existing.courseIds.includes(course.courseId)) existing.courseIds.push(course.courseId);
      continue;
    }
    groups.set(key, {
      key,
      courseIds: [course.courseId],
      courses: [course],
      name: course.name,
      courseCode: course.courseCode || course.courseId,
      credit: course.credit,
      typeName: course.typeName,
      typeCode: course.typeCode,
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
