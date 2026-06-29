import { teachingClassNamesById } from './course-groups.js';
import { withRetry } from './retry.js';

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_RETRIES = 3;

export async function buildCoursesForExport(courses, options = {}) {
  const uniqueCourses = uniqueBy(courses, (course) => String(course.courseId ?? ''));
  const sourceCounts = countBy(courses, (course) => String(course.courseId ?? ''));
  const allCourses = options.allCourses ?? courses;
  const results = await mapWithConcurrency(uniqueCourses, options.concurrency ?? DEFAULT_CONCURRENCY, async (course) => {
    const courseId = String(course.courseId);
    try {
      const classNames = teachingClassNamesById(allCourses, [courseId]);
      const teachingClasses = (await withRetry(() => options.getTeachingClasses(courseId), retryOptions(options)))
        .map((item) => inheritCourseOwnershipFromCourse(mergeTeachingClassName(item, classNames), course));
      return [courseId, { teachingClasses }];
    } catch (error) {
      return [courseId, { teachingClasses: [], teachingClassLoadError: error.message }];
    }
  });
  const byCourseId = new Map(results);
  return uniqueCourses.map((course) => ({
    ...course,
    sourceCourseRowCount: sourceCounts.get(String(course.courseId)) ?? 1,
    ...(byCourseId.get(String(course.courseId)) ?? { teachingClasses: [] })
  }));
}

export async function buildSelectedSnapshotForExport(snapshot, options = {}) {
  const courseIds = uniqueBy(snapshot.selectedClasses ?? [], (item) => String(item.courseId ?? ''))
    .map((item) => String(item.courseId))
    .filter(Boolean);
  const results = await mapWithConcurrency(courseIds, options.concurrency ?? DEFAULT_CONCURRENCY, async (courseId) => {
    try {
      return await withRetry(() => options.getTeachingClasses(courseId), retryOptions(options));
    } catch {
      return [];
    }
  });
  const detailsByClassId = new Map();
  for (const detail of results.flat()) {
    detailsByClassId.set(String(detail.classId), detail);
    detailsByClassId.set(String(detail.submitClassId), detail);
  }

  const selectedClasses = (snapshot.selectedClasses ?? []).map((item) => mergeSelectedClassDetail(item, detailsByClassId));
  const selectedClassByKey = new Map();
  for (const item of selectedClasses) {
    selectedClassByKey.set(String(item.classId), item);
    selectedClassByKey.set(String(item.submitClassId), item);
  }
  const selectedCourses = (snapshot.selectedCourses ?? []).map((course) => ({
    ...course,
    classes: (course.classes ?? []).map((item) => selectedClassByKey.get(String(item.classId)) ?? selectedClassByKey.get(String(item.submitClassId)) ?? item)
  }));

  return { ...snapshot, selectedCourses, selectedClasses };
}

function retryOptions(options) {
  return {
    retries: options.retries ?? DEFAULT_RETRIES,
    delays: options.retryDelays,
    wait: options.wait
  };
}

function mergeTeachingClassName(item, classNames) {
  const className = classNames.get(String(item.classId)) ?? classNames.get(String(item.submitClassId));
  if (!className) return item;
  return {
    ...item,
    raw: {
      ...item.raw,
      jxbmc: className
    }
  };
}

function mergeSelectedClassDetail(item, detailsByClassId) {
  const detail = detailsByClassId.get(String(item.classId)) ?? detailsByClassId.get(String(item.submitClassId));
  if (!detail) return item;
  return {
    ...item,
    teachers: item.teachers?.length ? item.teachers : detail.teachers,
    scheduleText: item.scheduleText || detail.scheduleText,
    locationText: item.locationText || detail.locationText,
    ownershipCode: item.ownershipCode || detail.ownershipCode,
    ownershipName: item.ownershipName || detail.ownershipName,
    raw: {
      ...(detail.raw ?? {}),
      ...(item.raw ?? {})
    }
  };
}

function inheritCourseOwnershipFromCourse(item, course) {
  if (item.ownershipName || item.ownershipCode) return item;
  if (!course?.ownershipName && !course?.ownershipCode) return item;
  return {
    ...item,
    ownershipName: course.ownershipName,
    ownershipCode: course.ownershipCode
  };
}

function uniqueBy(items, keyOf) {
  const seen = new Set();
  const values = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    values.push(item);
  }
  return values;
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
