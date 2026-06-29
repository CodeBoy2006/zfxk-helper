const COURSE_FIELDS = [
  ['courseId', '课程ID'],
  ['courseCode', '课程号'],
  ['name', '课程名称'],
  ['credit', '学分'],
  ['typeCode', '课程类型代码'],
  ['typeName', '课程类型名称'],
  ['ownershipCode', '课程归属代码'],
  ['ownershipName', '课程归属名称'],
  ['retake', '是否重修'],
  ['hasPrerequisiteHint', '是否有先行课提示'],
  ['recommended', '是否推荐']
];

const SELECTED_COURSE_FIELDS = [
  ['courseId', '课程ID'],
  ['courseCode', '课程号'],
  ['name', '课程名称'],
  ['credit', '学分'],
  ['typeCode', '课程类型代码'],
  ['ownershipCode', '课程归属代码'],
  ['ownershipName', '课程归属名称'],
  ['retake', '是否重修']
];

const SELECTED_CLASS_FIELDS = [
  ['classId', '教学班ID'],
  ['submitClassId', '提交教学班ID'],
  ['courseId', '课程ID'],
  ['name', '教学班名称'],
  ['order', '志愿顺序'],
  ['weight', '权重'],
  ['credit', '学分'],
  ['scheduleText', '上课时间'],
  ['locationText', '上课地点'],
  ['ownershipCode', '课程归属代码'],
  ['ownershipName', '课程归属名称']
];

const TEACHING_CLASS_FIELDS = [
  ['classId', '教学班ID'],
  ['submitClassId', '提交教学班ID'],
  ['courseId', '课程ID'],
  ['name', '教学班名称'],
  ['childClassCount', '子班数量'],
  ['credit', '学分'],
  ['selectedCount', '已选人数'],
  ['capacity', '容量'],
  ['scheduleText', '上课时间'],
  ['locationText', '上课地点'],
  ['examText', '考试时间'],
  ['campusId', '校区ID'],
  ['collegeName', '开课学院'],
  ['ownershipCode', '课程归属代码'],
  ['ownershipName', '课程归属名称']
];

const TEACHER_FIELDS = [
  ['id', '教师工号'],
  ['name', '姓名'],
  ['title', '职称'],
  ['raw', '原始教师文本']
];

const SELECTED_CLASS_FLAG_FIELDS = [
  ['selectedBySystem', '是否已选上'],
  ['selfSelected', '是否自选'],
  ['canDrop', '是否可退'],
  ['dropRestriction', '不可退原因']
];

const TEACHING_CLASS_FLAG_FIELDS = [
  ['selected', '是否已选'],
  ['full', '是否已满'],
  ['canSelect', '是否可选'],
  ['canDrop', '是否可退'],
  ['hasTextbook', '是否有教材'],
  ['retake', '是否重修'],
  ['auxiliary', '是否辅修']
];

const RAW_FIELD_LABELS = {
  kcrow: '源序号',
  kch_id: '课程ID',
  t_kch_id: '课程ID',
  courseId: '课程ID',
  kch: '课程号',
  courseCode: '课程号',
  kcmc: '课程名称',
  name: '名称',
  xf: '学分',
  jxbxf: '教学班学分',
  credit: '学分',
  kklxdm: '课程类型代码',
  kklxmc: '课程类型名称',
  kclxmc: '课程类型名称',
  typeCode: '课程类型代码',
  typeName: '课程类型名称',
  kcgsdm: '课程归属代码',
  kcgs_id: '课程归属代码',
  kcgs: '课程归属代码',
  kcgsmc: '课程归属名称',
  ownershipCode: '课程归属代码',
  ownershipName: '课程归属名称',
  courseOwnershipName: '课程归属名称',
  cxbj: '是否重修',
  xxkbj: '是否有先行课提示',
  sftj: '是否推荐',
  jxb_id: '教学班ID',
  do_jxb_id: '提交教学班ID',
  classId: '教学班ID',
  submitClassId: '提交教学班ID',
  jxbmc: '教学班名称',
  jxbzls: '子班数量',
  childClassCount: '子班数量',
  yxzrs: '已选人数',
  jxbrs: '已选人数',
  selectedCount: '已选人数',
  jxbrl: '容量',
  capacity: '容量',
  blzyl: '本轮容量',
  blyxrs: '本轮已选人数',
  roundCapacity: '本轮容量',
  roundSelected: '本轮已选人数',
  jsxx: '教师原始文本',
  sksj: '上课时间',
  scheduleText: '上课时间',
  jxdd: '上课地点',
  locationText: '上课地点',
  kssj: '考试时间',
  examText: '考试时间',
  xqh_id: '校区ID',
  campusId: '校区ID',
  kkxymc: '开课学院',
  collegeName: '开课学院',
  sfxz: '是否已选',
  sfxkbj: '是否可选',
  sfktk: '是否可退',
  zntgpk: '智能调排可退',
  isInxksj: '是否在选课时间',
  tktjrs: '退课临界人数',
  zckz: '正选控制',
  bdzcbj: '补退正选标记',
  sfydjc: '是否有教材',
  fxbj: '是否辅修',
  zypx: '志愿顺序',
  qz: '权重',
  sxbj: '是否已选上',
  zixf: '是否自选'
};

const METADATA_LABELS = {
  term: '学年学期',
  courseTypeName: '课程类型',
  courseTypeCode: '课程类型代码',
  controlId: '选课控制ID',
  keyword: '关键词',
  filters: '筛选条件'
};

export function buildCourseExport(courses = [], options = {}) {
  return {
    导出类型: '课程完整信息',
    导出时间: exportTime(options.now),
    元信息: labeledMetadata(options.metadata),
    课程数量: courses.length,
    课程: courses.map(formatCourse)
  };
}

export function buildSelectedCoursesExport(snapshot = {}, options = {}) {
  return {
    导出类型: '当前选课详细信息',
    导出时间: exportTime(options.now),
    快照时间: snapshot.fetchedAt ? exportTime(() => snapshot.fetchedAt) : undefined,
    元信息: labeledMetadata(options.metadata),
    汇总: {
      课程数: snapshot.totals?.courseCount ?? 0,
      总学分: snapshot.totals?.credit ?? 0,
      教学班学分: snapshot.totals?.teachingClassCredit ?? 0
    },
    已选课程: (snapshot.selectedCourses ?? []).map(formatSelectedCourse),
    已选教学班: (snapshot.selectedClasses ?? []).map(formatSelectedClass)
  };
}

export function downloadJson(filename, payload, env = {}) {
  const documentRef = env.documentRef ?? document;
  const urlRef = env.urlRef ?? URL;
  const BlobCtor = env.BlobCtor ?? Blob;
  const blob = new BlobCtor([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const href = urlRef.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = href;
  link.download = filename;
  link.style.display = 'none';
  documentRef.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => urlRef.revokeObjectURL(href), 0);
}

function formatCourse(course = {}) {
  const record = formatRecord(course, COURSE_FIELDS);
  if (course.teachingClassLoadError) record.教学班加载错误 = course.teachingClassLoadError;
  const teachingClasses = course.teachingClasses ?? course.classes;
  if (teachingClasses?.length) record.教学班 = teachingClasses.map(formatTeachingClass);
  return record;
}

function formatSelectedCourse(course = {}) {
  const record = formatRecord(course, SELECTED_COURSE_FIELDS);
  record.教学班 = (course.classes ?? []).map(formatSelectedClass);
  return record;
}

function formatSelectedClass(item = {}) {
  const record = formatRecord(item, SELECTED_CLASS_FIELDS);
  if (item.teachers?.length) record.教师 = item.teachers.map(formatTeacher);
  record.标志 = labeledFields(item, SELECTED_CLASS_FLAG_FIELDS);
  return record;
}

function formatTeacher(teacher = {}) {
  return labeledFields(teacher, TEACHER_FIELDS);
}

function formatTeachingClass(item = {}) {
  const record = formatRecord(item, TEACHING_CLASS_FIELDS);
  if (item.currentRound?.capacity !== undefined) record.本轮容量 = normalizeJsonValue(item.currentRound.capacity);
  if (item.currentRound?.selected !== undefined) record.本轮已选人数 = normalizeJsonValue(item.currentRound.selected);
  if (item.teachers?.length) record.教师 = item.teachers.map(formatTeacher);
  if (item.flags) record.标志 = labeledFields(item.flags, TEACHING_CLASS_FLAG_FIELDS);
  return record;
}

function formatRecord(item, fields) {
  const record = mappedRawFields(item.raw);
  addPublicFields(record, item, fields);
  const extraRawFields = unmappedRawFields(item.raw);
  if (Object.keys(extraRawFields).length) record.额外原始字段 = extraRawFields;
  return record;
}

function mappedRawFields(raw = {}) {
  const record = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const label = RAW_FIELD_LABELS[key];
    if (!label || value === undefined || value === null) continue;
    assignUniqueLabel(record, label, normalizeJsonValue(value));
  }
  return record;
}

function unmappedRawFields(raw = {}) {
  const extra = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (RAW_FIELD_LABELS[key] || value === undefined || value === null) continue;
    extra[key] = normalizeJsonValue(value);
  }
  return extra;
}

function addPublicFields(record, item, fields) {
  for (const [key, label] of fields) {
    const value = item[key];
    if (value === undefined || value === null) continue;
    const normalized = normalizeJsonValue(value);
    if (record[label] !== undefined && !sameJsonValue(record[label], normalized)) {
      assignUniqueLabel(record, `${label}原始值`, record[label]);
    }
    record[label] = normalized;
  }
}

function labeledFields(source, fields) {
  const record = {};
  for (const [key, label] of fields) {
    const value = source?.[key];
    if (value !== undefined && value !== null) record[label] = normalizeJsonValue(value);
  }
  return record;
}

function labeledMetadata(metadata = {}) {
  const record = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    record[METADATA_LABELS[key] ?? key] = normalizeJsonValue(value);
  }
  return record;
}

function assignUniqueLabel(record, label, value) {
  if (record[label] === undefined) {
    record[label] = value;
    return;
  }
  if (sameJsonValue(record[label], value)) return;

  let index = 2;
  let nextLabel = `${label}${index}`;
  while (record[nextLabel] !== undefined && !sameJsonValue(record[nextLabel], value)) {
    index += 1;
    nextLabel = `${label}${index}`;
  }
  if (record[nextLabel] === undefined) record[nextLabel] = value;
}

function sameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeJsonValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (value && typeof value === 'object') {
    if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([key, item]) => [key, normalizeJsonValue(item)]));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJsonValue(item)]));
  }
  return value;
}

function exportTime(now) {
  const value = typeof now === 'function' ? now() : new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
