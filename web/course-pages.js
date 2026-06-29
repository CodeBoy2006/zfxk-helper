export const COURSE_PAGE_SPAN = 1000;

const MAX_COURSE_PAGE_REQUESTS = 50;

export async function loadAllCoursePages(catalog, query = {}, options = {}) {
  const pageSpan = positiveInteger(options.pageSpan, COURSE_PAGE_SPAN);
  const maxRequests = positiveInteger(options.maxRequests, MAX_COURSE_PAGE_REQUESTS);
  const courses = [];

  for (let index = 0; index < maxRequests; index += 1) {
    const start = index * pageSpan + 1;
    const end = start + pageSpan - 1;
    const pageCourses = await catalog.searchCourses({
      ...query,
      page: {
        ...(query.page ?? {}),
        start,
        size: end
      }
    });

    if (!pageCourses.length) return courses;
    courses.push(...pageCourses);
    if (isPartialCoursePage(pageCourses, pageSpan)) return courses;
  }

  throw new Error(`Course search exceeded ${maxRequests} page requests.`);
}

function isPartialCoursePage(courses, pageSpan) {
  const boundary = coursePageBoundary(courses);
  if (!boundary) return courses.length < pageSpan;
  return boundary.last - boundary.first + 1 < pageSpan;
}

function coursePageBoundary(courses) {
  let first = Infinity;
  let last = -Infinity;

  for (const course of courses) {
    const rowNumber = courseRowNumber(course);
    if (!Number.isFinite(rowNumber)) continue;
    first = Math.min(first, rowNumber);
    last = Math.max(last, rowNumber);
  }

  return first === Infinity ? null : { first, last };
}

function courseRowNumber(course) {
  const value = course?.raw?.kcrow ?? course?.kcrow;
  const rowNumber = Number(value);
  return Number.isFinite(rowNumber) ? rowNumber : NaN;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
