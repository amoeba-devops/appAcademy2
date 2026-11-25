/** Single source for the in-product catalog and downloadable OpenAPI. */
export interface ApiField {
  name: string;
  in: 'path' | 'query' | 'header' | 'body';
  required: boolean;
  type: string;
  description: string;
  example: unknown;
  values?: string[];
  limit?: string;
}
const f = (
  name: string,
  where: ApiField['in'],
  required: boolean,
  type: string,
  description: string,
  example: unknown,
  values?: string[],
  limit?: string,
): ApiField => ({
  name,
  in: where,
  required,
  type,
  description,
  example,
  values,
  limit,
});
const auth = f(
  'Authorization',
  'header',
  true,
  'string',
  'API 키 인증 / API key authentication',
  'Bearer <API_KEY>',
);
const pages = [
  f(
    'limit',
    'query',
    false,
    'integer',
    '페이지 크기 / Page size',
    100,
    undefined,
    '1–200; default 100',
  ),
  f(
    'cursor',
    'query',
    false,
    'string(uuid)',
    '이전 nextCursor / Previous nextCursor',
    '11111111-1111-4111-8111-111111111111',
  ),
];
const external = f(
  'externalId',
  'path',
  true,
  'string',
  '외부 앱의 고유 수업 ID / Stable lesson ID',
  'slot-20261201-001',
  undefined,
  '1–128: A–Z a–z 0–9 _ . -',
);
const preconditions = [
  f(
    'Idempotency-Key',
    'header',
    true,
    'string',
    '재시도에 동일한 값 / Same value for retries',
    'slot-001-create-v1',
    undefined,
    '1–128 ASCII; 24h',
  ),
  f(
    'If-Match',
    'header',
    false,
    'string',
    '수정·삭제 시 필수: 최신 ETag / Required for update and delete',
    '"2"',
  ),
  f(
    'If-None-Match',
    'header',
    false,
    'string',
    '신규 등록 시 필수 / Required for creation',
    '*',
  ),
];
const body = [
  f(
    'teacherId',
    'body',
    false,
    'string(uuid)',
    'teacherEmail과 둘 중 하나 / Exactly one teacher identifier',
    '11111111-1111-4111-8111-111111111111',
  ),
  f(
    'teacherEmail',
    'body',
    false,
    'string(email)',
    '재직 강사 이메일 / Active teacher email',
    'teacher@example.com',
  ),
  f(
    'students',
    'body',
    true,
    'array<object>',
    '학생 이름과 선택 ID / Student names and optional IDs',
    [{ name: '홍학생' }],
    undefined,
    '1–200',
  ),
  f(
    'students[].name',
    'body',
    true,
    'string',
    '학생 이름 / Student name',
    '홍학생',
    undefined,
    '1–100',
  ),
  f(
    'students[].studentId',
    'body',
    false,
    'string(uuid)',
    '등록된 학생 ID / Registered student ID',
    '33333333-3333-4333-8333-333333333333',
  ),
  f(
    'startsAt',
    'body',
    true,
    'string(date-time)',
    '시작, offset 필수 / Start with offset',
    '2026-12-01T10:00:00+09:00',
  ),
  f(
    'endsAt',
    'body',
    true,
    'string(date-time)',
    '종료 > 시작 / End after start',
    '2026-12-01T10:50:00+09:00',
  ),
  f(
    'category',
    'body',
    true,
    'string',
    '데모/정규 / Demo or regular',
    'DEMO_CLASS',
    ['DEMO_CLASS', 'REGULAR_CLASS'],
  ),
  f(
    'deliveryMode',
    'body',
    true,
    'string',
    '대면/비대면 / Onsite or online',
    'ONSITE',
    ['ONSITE', 'ONLINE'],
  ),
  f(
    'location',
    'body',
    false,
    'string',
    '수업 장소 / Location',
    '2강의실',
    undefined,
    '0–200',
  ),
  f(
    'meetingUrl',
    'body',
    false,
    'string(uri)',
    '비대면 비-BODA 제공자에 필수, HTTPS / Required for non-BODA online lessons',
    'https://meet.google.com/abc-defg-hij',
    undefined,
    'max 500',
  ),
  f(
    'reason',
    'body',
    false,
    'string',
    '수정 사유 / Change reason',
    '수업 시간 변경',
    undefined,
    '2–500',
  ),
];
const lessonExample = {
  teacherEmail: 'teacher@example.com',
  students: [{ name: '홍학생' }],
  startsAt: '2026-12-01T10:00:00+09:00',
  endsAt: '2026-12-01T10:50:00+09:00',
  category: 'DEMO_CLASS',
  deliveryMode: 'ONSITE',
  location: '2강의실',
};
const lessonResponse = {
  id: '22222222-2222-4222-8222-222222222222',
  externalId: 'slot-20261201-001',
  managedByClient: true,
  teacherId: '11111111-1111-4111-8111-111111111111',
  teacherIds: ['11111111-1111-4111-8111-111111111111'],
  teacherName: '김강사',
  students: [{ studentId: null, name: '홍학생' }],
  startsAt: '2026-12-01T01:00:00Z',
  endsAt: '2026-12-01T01:50:00Z',
  category: 'DEMO_CLASS',
  deliveryMode: 'ONSITE',
  location: '2강의실',
  meetingUrl: null,
  version: 1,
};
export const API_ERRORS = [
  {
    status: 400,
    code: 'VALIDATION_ERROR',
    description: '파라미터·시간 범위 확인 / Check parameters and range',
  },
  {
    status: 401,
    code: 'INVALID_API_KEY',
    description: '키·만료·폐기 확인 / Check key and expiry',
  },
  {
    status: 403,
    code: 'INTEGRATION_DISABLED',
    description: '전체·종류·앱 사용 및 권한 확인 / Check settings and scopes',
  },
  {
    status: 404,
    code: 'LESSON_NOT_FOUND',
    description: '이 앱의 externalId 확인 / Check externalId ownership',
  },
  {
    status: 409,
    code: 'SCHEDULE_CONFLICT',
    description: '다른 시간으로 배정 / Reschedule',
  },
  {
    status: 409,
    code: 'IDEMPOTENCY_KEY_REUSED',
    description: '새 작업은 새 멱등 키 / Use a new key for a new operation',
  },
  {
    status: 409,
    code: 'EXTERNAL_ID_RETIRED',
    description: '삭제 ID 재사용 불가 / Deleted IDs cannot be reused',
  },
  {
    status: 412,
    code: 'VERSION_MISMATCH',
    description: '최신 일정 재조회 / Fetch latest version',
  },
  {
    status: 422,
    code: 'TEACHER_NOT_FOUND / TEACHER_AMBIGUOUS / TEACHER_NOT_ACTIVE / STUDENT_AMBIGUOUS / STUDENT_NOT_FOUND / STUDENT_NAME_MISMATCH / VIDEO_CONFIG_INVALID',
    description:
      '매칭·학생 등록·화상 설정 확인 / Resolve matching and video configuration',
  },
  {
    status: 428,
    code: 'PRECONDITION_REQUIRED',
    description: '조건 헤더 추가 / Add precondition header',
  },
  {
    status: 429,
    code: 'RATE_LIMITED',
    description: 'Retry-After 이후 재시도 / Retry after indicated delay',
  },
  {
    status: 503,
    code: 'SCHEDULE_UNAVAILABLE',
    description:
      '반복 일정 생성 실패; 담당자 확인 후 재시도 / Recurrence unavailable',
  },
];
export const API_CATALOG = [
  {
    id: 'teachers',
    group: 'teachers',
    name: '강사 목록 / Teachers',
    method: 'GET',
    path: '/teachers',
    scope: 'teachers:read',
    fields: [
      auth,
      ...pages,
      f(
        'email',
        'query',
        false,
        'string(email)',
        '이메일 정확 일치 / Exact email match',
        'teacher@example.com',
      ),
      f(
        'status',
        'query',
        false,
        'string',
        '재직/휴직/퇴직 / Employment status',
        'ACTIVE',
        ['ACTIVE', 'LEAVE', 'RESIGNED'],
      ),
    ],
    request: null,
    response: {
      success: true,
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: '김강사',
          email: 'teacher@example.com',
          status: 'ACTIVE',
        },
      ],
      meta: { limit: 100, nextCursor: null },
    },
  },
  {
    id: 'list',
    group: 'lessons',
    name: '기간별·강사별 일정 / Lessons in range',
    method: 'GET',
    path: '/lessons',
    scope: 'lessons:read',
    fields: [
      auth,
      ...pages,
      f(
        'from',
        'query',
        true,
        'string(date-time)',
        '시작 범위, offset 필수 / Range start',
        '2026-12-01T00:00:00+09:00',
      ),
      f(
        'to',
        'query',
        true,
        'string(date-time)',
        '종료 범위 / Range end',
        '2026-12-08T00:00:00+09:00',
        undefined,
        'max 31 days; up to 2 years ahead',
      ),
      f(
        'teacherId',
        'query',
        false,
        'string(uuid)',
        '생략 시 전체 강사 / All teachers if omitted',
        '11111111-1111-4111-8111-111111111111',
      ),
    ],
    request: null,
    response: {
      success: true,
      data: [lessonResponse],
      meta: { limit: 100, nextCursor: null },
    },
  },
  {
    id: 'get',
    group: 'lessons',
    name: '연동 일정 상세 / Linked lesson',
    method: 'GET',
    path: '/lessons/external/{externalId}',
    scope: 'lessons:read',
    fields: [auth, external],
    request: null,
    response: { success: true, data: lessonResponse },
  },
  {
    id: 'put',
    group: 'lessons',
    name: '수업 등록·수정 / Create or replace lesson',
    method: 'PUT',
    path: '/lessons/external/{externalId}',
    scope: 'lessons:write',
    fields: [auth, external, ...preconditions, ...body],
    request: lessonExample,
    response: { success: true, data: lessonResponse },
  },
  {
    id: 'delete',
    group: 'lessons',
    name: '수업 삭제 / Delete lesson',
    method: 'DELETE',
    path: '/lessons/external/{externalId}',
    scope: 'lessons:write',
    fields: [
      auth,
      external,
      ...preconditions
        .filter((x) => x.name !== 'If-None-Match')
        .map((x) => (x.name === 'If-Match' ? { ...x, required: true } : x)),
      f(
        'reason',
        'body',
        true,
        'string',
        '삭제 사유 / Cancellation reason',
        '스케줄 앱에서 수업 취소',
        undefined,
        '2–500',
      ),
    ],
    request: { reason: '스케줄 앱에서 수업 취소' },
    response: {
      success: true,
      data: { externalId: 'slot-20261201-001', deleted: true },
    },
  },
];
function schema(field: ApiField): Record<string, unknown> {
  const format = /\((.+)\)/.exec(field.type)?.[1];
  return {
    type: field.type.startsWith('array')
      ? 'array'
      : field.type === 'integer'
        ? 'integer'
        : 'string',
    ...(format ? { format } : {}),
    ...(field.values ? { enum: field.values } : {}),
    ...(field.type.startsWith('array')
      ? {
          minItems: 1,
          maxItems: 200,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              studentId: { type: 'string', format: 'uuid' },
            },
          },
        }
      : {}),
    example: field.example,
    description: [field.description, field.limit].filter(Boolean).join('; '),
  };
}
export function schedulerOpenApi(baseUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const entry of API_CATALOG) {
    const fields = entry.fields.filter(
      (x) => x.in === 'body' && !x.name.includes('[]'),
    );
    const responses: Record<string, unknown> = {};
    for (const status of [
      200,
      ...(entry.method === 'PUT' ? [201] : []),
      400,
      401,
      403,
      404,
      409,
      412,
      422,
      428,
      429,
      503,
    ])
      responses[status] = {
        description: status < 300 ? 'Success' : 'Error',
        ...(status < 300 && ['get', 'put'].includes(entry.id)
          ? {
              headers: {
                ETag: {
                  schema: { type: 'string' },
                  description: 'Version for If-Match',
                },
              },
            }
          : {}),
        content: {
          'application/json': {
            schema:
              status < 300
                ? responseSchema(entry.id)
                : { $ref: '#/components/schemas/Error' },
            example:
              status < 300
                ? entry.response
                : {
                    success: false,
                    error: {
                      code:
                        API_ERRORS.find((e) => e.status === status)?.code ??
                        'ERROR',
                      message: '...',
                    },
                  },
          },
        },
      };
    (paths[entry.path] ??= {})[entry.method.toLowerCase()] = {
      operationId: entry.id,
      summary: entry.name,
      description: `Required scope: ${entry.scope}. PUT creation requires If-None-Match: *, updates and deletes require If-Match.`,
      security: [{ apiKey: [] }],
      parameters: entry.fields
        .filter((x) => x.in !== 'body' && x.name !== 'Authorization')
        .map((x) => ({
          name: x.name,
          in: x.in,
          required: x.required,
          schema: schema(x),
          description: x.description,
        })),
      ...(fields.length
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    required: fields
                      .filter((f) => f.required)
                      .map((f) => f.name),
                    properties: Object.fromEntries(
                      fields.map((f) => [f.name, schema(f)]),
                    ),
                    ...(entry.id === 'put'
                      ? {
                          oneOf: [
                            {
                              required: ['teacherId'],
                              not: { required: ['teacherEmail'] },
                            },
                            {
                              required: ['teacherEmail'],
                              not: { required: ['teacherId'] },
                            },
                          ],
                        }
                      : {}),
                  },
                  example: entry.request,
                },
              },
            },
          }
        : {}),
      responses,
    };
  }
  return {
    openapi: '3.0.3',
    info: { title: 'ACM External Scheduler API', version: '1.0.0' },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'ACM API key' },
      },
      schemas: RESPONSE_SCHEMAS,
    },
    paths,
  };
}
const uuid = { type: 'string', format: 'uuid' };
const RESPONSE_SCHEMAS = {
  Teacher: {
    type: 'object',
    required: ['id', 'name', 'email', 'status'],
    properties: {
      id: uuid,
      name: { type: 'string' },
      email: { type: 'string', format: 'email', nullable: true },
      status: { type: 'string', enum: ['ACTIVE', 'LEAVE', 'RESIGNED'] },
    },
  },
  Lesson: {
    type: 'object',
    required: Object.keys(lessonResponse),
    properties: {
      id: uuid,
      externalId: { type: 'string', nullable: true },
      managedByClient: { type: 'boolean' },
      teacherId: { ...uuid, nullable: true },
      teacherIds: { type: 'array', items: uuid },
      teacherName: { type: 'string', nullable: true },
      students: {
        type: 'array',
        items: {
          type: 'object',
          required: ['studentId', 'name'],
          properties: {
            studentId: { ...uuid, nullable: true },
            name: { type: 'string' },
          },
        },
      },
      startsAt: { type: 'string', format: 'date-time' },
      endsAt: { type: 'string', format: 'date-time' },
      category: {
        type: 'string',
        enum: ['DEMO_CLASS', 'REGULAR_CLASS', 'MEETING', 'LEVEL_TEST', 'OTHER'],
      },
      deliveryMode: {
        type: 'string',
        enum: ['ONSITE', 'ONLINE'],
        nullable: true,
      },
      location: { type: 'string', nullable: true },
      meetingUrl: { type: 'string', nullable: true },
      version: { type: 'integer', minimum: 1, nullable: true },
    },
  },
  PageMeta: {
    type: 'object',
    required: ['limit', 'nextCursor'],
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 200 },
      nextCursor: { ...uuid, nullable: true },
    },
  },
  Error: {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
};
function responseSchema(id: string) {
  const list = id === 'teachers' || id === 'list';
  const data =
    id === 'delete'
      ? {
          type: 'object',
          required: ['externalId', 'deleted'],
          properties: {
            externalId: { type: 'string' },
            deleted: { type: 'boolean' },
          },
        }
      : list
        ? {
            type: 'array',
            items: {
              $ref: `#/components/schemas/${id === 'teachers' ? 'Teacher' : 'Lesson'}`,
            },
          }
        : { $ref: '#/components/schemas/Lesson' };
  return {
    type: 'object',
    required: ['success', 'data', ...(list ? ['meta'] : [])],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data,
      ...(list ? { meta: { $ref: '#/components/schemas/PageMeta' } } : {}),
    },
  };
}
