import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const json = (schema) => ({
  'application/json': {
    schema
  }
});

const ok = (description, schema) => ({
  description,
  content: json(schema)
});

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

export function buildOpenApiDocument(options = {}) {
  const version = options.version ?? '0.1.0';

  return {
    openapi: '3.0.3',
    info: {
      title: 'zfxk SDK API',
      version,
      description: 'Documented SDK-facing operations for the ZFXK/ZZXK HTTP workflow client.'
    },
    servers: [
      {
        url: 'sdk://zfxk',
        description: 'Logical SDK surface. Calls are executed through an authenticated school session.'
      }
    ],
    tags: [
      { name: 'Context' },
      { name: 'Catalog' },
      { name: 'Chosen' },
      { name: 'Selection' },
      { name: 'Extras' }
    ],
    paths: {
      '/sdk/context/bootstrap': {
        post: {
          tags: ['Context'],
          operationId: 'bootstrapContext',
          summary: 'Load runtime context from hidden fields or known raw values.',
          requestBody: requestBody(ref('BootstrapInput')),
          responses: {
            200: ok('Runtime context', ref('RuntimeContext'))
          }
        }
      },
      '/sdk/context/bootstrap-from-page': {
        post: {
          tags: ['Context'],
          operationId: 'bootstrapFromPage',
          summary: 'Fetch a selection page with the configured session and parse runtime context.',
          requestBody: requestBody(ref('BootstrapFromPageInput')),
          responses: {
            200: ok('Runtime context', ref('RuntimeContext'))
          }
        }
      },
      '/sdk/catalog/courses': {
        post: {
          tags: ['Catalog'],
          operationId: 'searchCourses',
          summary: 'Search paged course candidates.',
          requestBody: requestBody(ref('CourseQuery')),
          responses: {
            200: ok('Course list', arrayOf(ref('Course')))
          }
        }
      },
      '/sdk/catalog/teaching-classes': {
        post: {
          tags: ['Catalog'],
          operationId: 'getTeachingClasses',
          summary: 'Load teaching classes for a course.',
          requestBody: requestBody(ref('TeachingClassQuery')),
          responses: {
            200: ok('Teaching-class list', arrayOf(ref('TeachingClass')))
          }
        }
      },
      '/sdk/chosen/snapshot': {
        post: {
          tags: ['Chosen'],
          operationId: 'getSelectionSnapshot',
          summary: 'Refresh selected courses and classes.',
          responses: {
            200: ok('Selection snapshot', ref('SelectionSnapshot'))
          }
        }
      },
      '/sdk/selection/choose': {
        post: {
          tags: ['Selection'],
          operationId: 'chooseCourse',
          summary: 'Run the SDK course-selection workflow.',
          requestBody: requestBody(ref('ChooseInput')),
          responses: {
            200: ok('Choose result', ref('ChooseResult'))
          }
        }
      },
      '/sdk/selection/drop': {
        post: {
          tags: ['Selection'],
          operationId: 'dropCourse',
          summary: 'Run the SDK drop workflow.',
          requestBody: requestBody(ref('DropInput')),
          responses: {
            200: ok('Drop result', ref('DropResult'))
          }
        }
      },
      '/sdk/selection/reorder': {
        post: {
          tags: ['Selection'],
          operationId: 'reorderSelectedClasses',
          summary: 'Save ordinary wish order for selected classes.',
          requestBody: requestBody(ref('ReorderInput')),
          responses: {
            200: ok('Selection snapshot', ref('SelectionSnapshot'))
          }
        }
      },
      '/sdk/selection/update-weight': {
        post: {
          tags: ['Selection'],
          operationId: 'updateSelectionWeight',
          summary: 'Update a weighted selection value.',
          requestBody: requestBody(ref('UpdateWeightInput')),
          responses: {
            200: ok('Selection snapshot', ref('SelectionSnapshot'))
          }
        }
      },
      '/sdk/textbook/order': {
        post: {
          tags: ['Extras'],
          operationId: 'orderTextbook',
          summary: 'Order textbook for a teaching class.',
          requestBody: requestBody(ref('TextbookInput')),
          responses: {
            200: ok('Textbook result', ref('SimpleResult'))
          }
        }
      },
      '/sdk/waitlist/join': {
        post: {
          tags: ['Extras'],
          operationId: 'joinWaitlist',
          summary: 'Join a course waitlist/intention list.',
          requestBody: requestBody(ref('WaitlistInput')),
          responses: {
            200: ok('Waitlist result', ref('SimpleResult'))
          }
        }
      },
      '/sdk/listener/apply': {
        post: {
          tags: ['Extras'],
          operationId: 'applyListener',
          summary: 'Submit a listener application.',
          requestBody: requestBody(ref('ListenerApplyInput')),
          responses: {
            200: ok('Listener result', ref('SimpleResult'))
          }
        }
      }
    },
    components: {
      schemas
    }
  };
}

export async function writeOpenApiDocument(outputPath, options = {}) {
  await mkdir(dirname(outputPath), { recursive: true });
  const document = buildOpenApiDocument(options);
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  return document;
}

const schemas = {
  BootstrapInput: object({
    baseUrl: string('School jwglxt base URL.'),
    html: string('Course-selection page HTML containing hidden inputs.'),
    raw: mapOf(string())
  }),
  BootstrapFromPageInput: object({
    path: string('Selection page path relative to baseUrl.'),
    raw: mapOf(string())
  }, ['path']),
  RuntimeContext: object(
    {
      baseUrl: string(),
      term: object({
        xkxnm: string(),
        xkxqm: string()
      }, ['xkxnm', 'xkxqm']),
      student: object({
        xhId: string(),
        jgId: string(),
        zyhId: string(),
        njdmId: string(),
        zyfxId: string(),
        bhId: string(),
        campusId: string()
      }, ['zyhId', 'njdmId']),
      current: object({
        xkkzId: string(),
        kklxdm: string(),
        kklxmc: string(),
        xklc: string(),
        xkkzXh: string()
      }, ['xkkzId', 'kklxdm']),
      switches: object({
        isInSelectionTime: boolean(),
        canSelect: boolean(),
        canDrop: boolean(),
        useWeight: boolean(),
        enableTextbook: boolean(),
        enableWaitlist: boolean(),
        enableListenerApply: boolean()
      }, ['isInSelectionTime', 'canSelect', 'canDrop', 'useWeight', 'enableTextbook', 'enableWaitlist', 'enableListenerApply']),
      raw: mapOf(string())
    },
    ['baseUrl', 'term', 'student', 'current', 'switches', 'raw']
  ),
  CourseQuery: object({
    keyword: string(),
    page: object({
      start: integer(),
      size: integer()
    }),
    filters: object({
      hasCapacity: boolean(),
      recommended: boolean(),
      retake: boolean()
    }),
    extra: mapOf({})
  }),
  TeachingClassQuery: object({
    courseId: string(),
    retake: string(),
    auxiliary: string(),
    extra: mapOf({})
  }, ['courseId']),
  Course: object({
    courseId: string(),
    courseCode: string(),
    name: string(),
    credit: number(),
    typeCode: string(),
    typeName: string(),
    ownershipCode: string(),
    ownershipName: string(),
    retake: boolean(),
    hasPrerequisiteHint: boolean(),
    recommended: boolean(),
    raw: mapOf({})
  }, ['courseId', 'name', 'credit', 'typeCode', 'retake', 'hasPrerequisiteHint', 'raw']),
  TeachingClass: object({
    classId: string(),
    submitClassId: string(),
    courseId: string(),
    name: string(),
    childClassCount: integer(),
    credit: number(),
    selectedCount: integer(),
    capacity: integer(),
    currentRound: object({
      capacity: integer(),
      selected: integer()
    }, ['capacity', 'selected']),
    teachers: arrayOf(ref('Teacher')),
    scheduleText: string(),
    locationText: string(),
    examText: string(),
    campusId: string(),
    collegeName: string(),
    ownershipCode: string(),
    ownershipName: string(),
    flags: object({
      selected: boolean(),
      full: boolean(),
      canSelect: boolean(),
      canDrop: boolean(),
      hasTextbook: boolean(),
      retake: boolean(),
      auxiliary: boolean()
    }, ['selected', 'full', 'canSelect']),
    raw: mapOf({})
  }, ['classId', 'submitClassId', 'courseId', 'name', 'childClassCount', 'credit', 'selectedCount', 'capacity', 'currentRound', 'teachers', 'flags', 'raw']),
  Teacher: object({
    id: string(),
    name: string(),
    title: string(),
    raw: string()
  }, ['raw']),
  SelectedCourse: object({
    courseId: string(),
    courseCode: string(),
    name: string(),
    credit: number(),
    typeCode: string(),
    ownershipCode: string(),
    ownershipName: string(),
    retake: boolean(),
    classes: arrayOf(ref('SelectedClass')),
    raw: mapOf({})
  }, ['courseId', 'name', 'credit', 'typeCode', 'retake', 'classes', 'raw']),
  SelectedClass: object({
    classId: string(),
    submitClassId: string(),
    courseId: string(),
    name: string(),
    order: integer(),
    weight: number(),
    selectedBySystem: boolean(),
    selfSelected: boolean(),
    canDrop: boolean(),
    credit: number(),
    teachers: arrayOf(ref('Teacher')),
    scheduleText: string(),
    locationText: string(),
    ownershipCode: string(),
    ownershipName: string(),
    raw: mapOf({})
  }, ['classId', 'submitClassId', 'courseId', 'name', 'selectedBySystem', 'selfSelected', 'canDrop', 'raw']),
  SelectionSnapshot: object({
    selectedCourses: arrayOf(ref('SelectedCourse')),
    selectedClasses: arrayOf(ref('SelectedClass')),
    totals: object({
      courseCount: integer(),
      credit: number(),
      teachingClassCredit: number()
    }, ['courseCount', 'credit', 'teachingClassCredit']),
    version: string(),
    fetchedAt: string('ISO date-time string.', 'date-time')
  }, ['selectedCourses', 'selectedClasses', 'totals', 'version', 'fetchedAt']),
  ChooseInput: object({
    courseId: string(),
    classId: string(),
    query: mapOf({})
  }, ['courseId', 'classId']),
  ChooseResult: object({
    status: string('selected | pending-filter | rejected | capacity-full | requires-listener-apply | planned'),
    selection: ref('SelectedClass'),
    snapshot: ref('SelectionSnapshot'),
    reason: string(),
    waitlistAvailable: boolean(),
    messages: arrayOf(ref('WorkflowMessage'))
  }, ['status']),
  DropInput: object({
    courseId: string(),
    classId: string(),
    submitClassId: string(),
    controlId: string()
  }, ['courseId', 'classId']),
  DropResult: object({
    status: string('dropped | rejected | sms-failed | already-dropped'),
    snapshot: ref('SelectionSnapshot'),
    reason: string(),
    message: string()
  }, ['status']),
  ReorderInput: object({
    classIds: arrayOf(string())
  }, ['classIds']),
  UpdateWeightInput: object({
    classId: string(),
    submitClassId: string(),
    weight: number()
  }, ['classId', 'weight']),
  TextbookInput: object({
    classId: string(),
    reason: string()
  }, ['classId']),
  WaitlistInput: object({
    courseId: string(),
    classId: string()
  }, ['courseId', 'classId']),
  ListenerApplyInput: object({
    courseId: string(),
    classId: string(),
    conflictClassIds: arrayOf(string())
  }, ['courseId', 'classId']),
  WorkflowMessage: object({
    code: string(),
    message: string(),
    raw: mapOf({})
  }),
  SimpleResult: object({
    ok: boolean(),
    message: string(),
    raw: {}
  }, ['ok'])
};

function requestBody(schema) {
  return {
    required: true,
    content: json(schema)
  };
}

function object(properties, required = []) {
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {})
  };
}

function arrayOf(items) {
  return {
    type: 'array',
    items
  };
}

function mapOf(additionalProperties) {
  return {
    type: 'object',
    additionalProperties
  };
}

function string(description, format) {
  return {
    type: 'string',
    ...(description ? { description } : {}),
    ...(format ? { format } : {})
  };
}

function number() {
  return { type: 'number' };
}

function integer() {
  return { type: 'integer' };
}

function boolean() {
  return { type: 'boolean' };
}
