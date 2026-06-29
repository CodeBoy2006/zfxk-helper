import { bool, firstDefined, number } from './utils.js';

export function parseTeachers(jsxx) {
  if (!jsxx) return [];
  return String(jsxx)
    .replace(/<br\s*\/?>/gi, ';')
    .split(/[;；]+/)
    .filter(Boolean)
    .map((item) => {
      if (!item.includes('/')) {
        const name = item.trim();
        return {
          id: undefined,
          name: name && name !== '--' ? name : undefined,
          title: undefined,
          raw: item
        };
      }
      const [id, name, title] = item.split('/');
      return {
        id: id || undefined,
        name: name && name !== '--' ? name : undefined,
        title: title && title !== '--' ? title : undefined,
        raw: item
      };
    });
}

export function mapCourse(row = {}) {
  return {
    courseId: String(firstDefined(row.kch_id, row.courseId, '')),
    courseCode: firstDefined(row.kch, row.courseCode),
    name: String(firstDefined(row.kcmc, row.name, '')),
    credit: number(firstDefined(row.xf, row.credit)),
    typeCode: String(firstDefined(row.kklxdm, row.typeCode, '')),
    typeName: firstDefined(row.kklxmc, row.kclxmc, row.typeName),
    ownershipCode: firstDefined(row.kcgsdm, row.kcgs_id, row.kcgs, row.ownershipCode),
    ownershipName: firstDefined(row.kcgsmc, row.ownershipName, row.courseOwnershipName),
    retake: bool(firstDefined(row.cxbj, row.retake)),
    hasPrerequisiteHint: bool(firstDefined(row.xxkbj, row.hasPrerequisiteHint)),
    recommended: row.sftj === undefined ? undefined : bool(row.sftj),
    raw: row
  };
}

export function mapTeachingClass(row = {}) {
  const selectedCount = number(firstDefined(row.yxzrs, row.jxbrs, row.selectedCount));
  const capacity = number(firstDefined(row.jxbrl, row.capacity));
  const full = capacity > 0 && selectedCount >= capacity;

  return {
    classId: String(firstDefined(row.jxb_id, row.classId, '')),
    submitClassId: String(firstDefined(row.do_jxb_id, row.submitClassId, row.jxb_id, '')),
    courseId: String(firstDefined(row.kch_id, row.courseId, '')),
    name: String(firstDefined(row.jxbmc, row.name, '')),
    childClassCount: number(firstDefined(row.jxbzls, row.childClassCount), 1),
    credit: number(firstDefined(row.xf, row.jxbxf, row.credit)),
    selectedCount,
    capacity,
    currentRound: {
      capacity: number(firstDefined(row.blzyl, row.roundCapacity)),
      selected: number(firstDefined(row.blyxrs, row.roundSelected))
    },
    teachers: parseTeachers(row.jsxx),
    scheduleText: firstDefined(row.sksj, row.scheduleText),
    locationText: firstDefined(row.jxdd, row.locationText),
    examText: firstDefined(row.kssj, row.examText),
    campusId: firstDefined(row.xqh_id, row.campusId),
    collegeName: firstDefined(row.kkxymc, row.collegeName),
    ownershipCode: firstDefined(row.kcgsdm, row.kcgs_id, row.kcgs, row.ownershipCode),
    ownershipName: firstDefined(row.kcgsmc, row.ownershipName, row.courseOwnershipName),
    flags: {
      selected: bool(firstDefined(row.sfxz, row.selected)),
      full,
      canSelect: firstDefined(row.sfxkbj, row.canSelect) !== '0',
      canDrop: firstDefined(row.sfktk, row.canDrop) === undefined ? undefined : bool(firstDefined(row.sfktk, row.canDrop)),
      hasTextbook: firstDefined(row.sfydjc, row.hasTextbook) === undefined ? undefined : bool(firstDefined(row.sfydjc, row.hasTextbook)),
      retake: firstDefined(row.cxbj, row.retake) === undefined ? undefined : bool(firstDefined(row.cxbj, row.retake)),
      auxiliary: firstDefined(row.fxbj, row.auxiliary) === undefined ? undefined : bool(firstDefined(row.fxbj, row.auxiliary))
    },
    raw: row
  };
}

export function mapSelectionSnapshot(records = []) {
  const selectedCourses = [];
  const selectedClasses = [];
  const byCourseId = new Map();
  const byClassId = new Map();
  let totalCredit = 0;

  for (const row of records) {
    const courseId = String(firstDefined(row.t_kch_id, row.kch_id, ''));
    let course = byCourseId.get(courseId);
    if (!course) {
      course = {
        courseId,
        courseCode: firstDefined(row.kch, row.courseCode),
        name: String(firstDefined(row.kcmc, row.name, '')),
        credit: number(firstDefined(row.xf, row.credit)),
        typeCode: String(firstDefined(row.kklxdm, row.typeCode, '')),
        ownershipCode: firstDefined(row.kcgsdm, row.kcgs_id, row.kcgs, row.ownershipCode),
        ownershipName: firstDefined(row.kcgsmc, row.ownershipName, row.courseOwnershipName),
        retake: bool(firstDefined(row.cxbj, row.retake)),
        classes: [],
        raw: row
      };
      byCourseId.set(courseId, course);
      selectedCourses.push(course);
      totalCredit += course.credit;
    }

    const selectedClass = {
      classId: String(firstDefined(row.jxb_id, row.classId, '')),
      submitClassId: String(firstDefined(row.do_jxb_id, row.submitClassId, row.jxb_id, '')),
      courseId: String(firstDefined(row.kch_id, courseId)),
      name: String(firstDefined(row.jxbmc, row.name, '')),
      order: row.zypx === undefined ? course.classes.length + 1 : number(row.zypx),
      weight: number(row.qz) === 0 ? undefined : number(row.qz),
      selectedBySystem: bool(row.sxbj),
      selfSelected: bool(row.zixf),
      ...selectedDropEligibility(row),
      credit: number(firstDefined(row.jxbxf, row.xf, row.credit)),
      teachers: parseTeachers(row.jsxx),
      scheduleText: firstDefined(row.sksj, row.scheduleText),
      locationText: firstDefined(row.jxdd, row.locationText),
      ownershipCode: firstDefined(row.kcgsdm, row.kcgs_id, row.kcgs, row.ownershipCode),
      ownershipName: firstDefined(row.kcgsmc, row.ownershipName, row.courseOwnershipName),
      raw: row
    };

    course.classes.push(selectedClass);
    selectedClasses.push(selectedClass);
    byClassId.set(selectedClass.classId, selectedClass);
    byClassId.set(selectedClass.submitClassId, selectedClass);
  }

  return {
    selectedCourses,
    selectedClasses,
    totals: {
      courseCount: selectedCourses.length,
      credit: totalCredit,
      teachingClassCredit: selectedClasses.reduce((sum, item) => sum + number(item.credit), 0)
    },
    byCourseId,
    byClassId,
    version: String(Date.now()),
    fetchedAt: new Date()
  };
}

function selectedDropEligibility(row = {}) {
  const dropFlag = firstDefined(row.sfktk, row.canDrop);
  const smartDropFlag = firstDefined(row.zntgpk, row.smartDropAllowed);
  if ((dropFlag !== undefined || smartDropFlag !== undefined) && !bool(dropFlag) && !bool(smartDropFlag)) {
    return dropBlocked('DROP_FLAG_DISABLED', 'Selected row is not marked as droppable by sfktk or zntgpk.');
  }

  const selectedCount = firstDefined(row.yxzrs, row.jxbrs, row.selectedCount);
  const dropThreshold = firstDefined(row.tktjrs, row.dropThreshold);
  if (selectedCount !== undefined && dropThreshold !== undefined && number(selectedCount) <= number(dropThreshold)) {
    return dropBlocked('DROP_THRESHOLD_REACHED', 'Selected count is not greater than the drop threshold.');
  }

  const inSelectionTime = firstDefined(row.isInxksj, row.isInSelectionTime);
  if (inSelectionTime !== undefined && !bool(inSelectionTime)) {
    return dropBlocked('OUTSIDE_SELECTION_TIME', 'Selected row is outside the active selection time.');
  }

  let selectableFlag = firstDefined(row.sfxkbj, row.canSelect);
  if (String(row.xxdm ?? '') === '10511' || bool(row.bhbcyxkjxb)) selectableFlag = '1';
  if (selectableFlag !== undefined && !bool(selectableFlag)) {
    return dropBlocked('SELECT_FLAG_DISABLED', 'Selected row has sfxkbj=0, so the original page shows it as already selected instead of a drop action.');
  }

  const regularControl = String(row.zckz ?? '');
  const regularDropFlag = String(row.bdzcbj ?? '');
  if (regularControl === '1' && regularDropFlag !== '2' && regularDropFlag !== '3') {
    return dropBlocked('REGULAR_SELECTION_LOCKED', 'Selected row is blocked by the regular-selection control flag.');
  }

  return { canDrop: true };
}

function dropBlocked(code, message) {
  return {
    canDrop: false,
    dropRestriction: { code, message }
  };
}
