import { ValidationPipe } from '@nestjs/common';
import {
  ListStudentsQueryDto,
  CreateStudentDto,
  UpdateStudentDto,
  ChangeStudentSitesDto,
} from './student.dto';
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
describe('student site HTTP contracts', () => {
  it('accepts the site list query and converts pagination numbers', async () => {
    const result = await pipe.transform(
      {
        site: 'UNASSIGNED',
        page: '2',
        limit: '25',
        sort: 'startDate',
        dir: 'asc',
      },
      { type: 'query', metatype: ListStudentsQueryDto },
    );
    expect(result.page).toBe(2);
    await expect(
      pipe.transform(
        { showInactive: 'false' },
        { type: 'query', metatype: ListStudentsQueryDto },
      ),
    ).rejects.toThrow();
  });
  it('requires a valid site for new manual registration', async () => {
    await expect(
      pipe.transform(
        { stdName: 'Fixture', stdEmail: 'fixture@example.test' },
        { type: 'body', metatype: CreateStudentDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { stdName: 'Fixture', stdSite: 'UNKNOWN' },
        { type: 'body', metatype: CreateStudentDto },
      ),
    ).rejects.toThrow();
  });
  it('allows withdrawn registration without site or email and validates withdrawal dates', async () => {
    await expect(
      pipe.transform(
        {
          stdName: 'Synthetic withdrawn',
          stdStatus: 'WITHDRAWN',
          stdAdmissionDate: '2026-01-01',
          stdWithdrawnDate: '2026-09-01',
        },
        { type: 'body', metatype: CreateStudentDto },
      ),
    ).resolves.toBeDefined();
    await expect(
      pipe.transform(
        {
          stdName: 'Synthetic withdrawn',
          stdStatus: 'WITHDRAWN',
          stdWithdrawnDate: 'invalid',
        },
        { type: 'body', metatype: CreateStudentDto },
      ),
    ).rejects.toThrow();
  });
  it('rejects bulk mutation requests without a valid timestamp', async () => {
    await expect(
      pipe.transform(
        {
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              updatedAt: 'invalid',
            },
          ],
          site: 'TPI',
          reason: 'review',
        },
        { type: 'body', metatype: ChangeStudentSitesDto },
      ),
    ).rejects.toThrow();
  });
});

describe('teacher class information HTTP contract', () => {
  it('accepts blank fields without persisting placeholder strings', async () => {
    const result = await pipe.transform(
      {
        stdTeacherClassInfos: [
          {
            tchId: '11111111-1111-4111-8111-111111111111',
            curriculum: '',
            gpa: '0',
          },
        ],
      },
      { type: 'body', metatype: UpdateStudentDto },
    );
    expect(result.stdTeacherClassInfos[0].curriculum).toBe('');
    expect(result.stdTeacherClassInfos[0].gpa).toBe('0');
  });
  it.each([
    null,
    [{ tchId: 'bad' }],
    [
      {
        tchId: '11111111-1111-4111-8111-111111111111',
        subject: 'x'.repeat(101),
      },
    ],
    Array(6).fill({ tchId: '11111111-1111-4111-8111-111111111111' }),
  ])(
    'rejects invalid nested profile input %#',
    async (stdTeacherClassInfos) => {
      await expect(
        pipe.transform(
          { stdTeacherClassInfos },
          { type: 'body', metatype: UpdateStudentDto },
        ),
      ).rejects.toThrow();
    },
  );
});
