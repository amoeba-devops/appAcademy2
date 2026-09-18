import { ValidationPipe } from '@nestjs/common';
import { ListStudentsQueryDto, CreateStudentDto, ChangeStudentSitesDto } from './student.dto';
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
describe('student site HTTP contracts', () => {
  it('accepts the site list query and converts pagination numbers', async () => {
    const result = await pipe.transform({ site: 'UNASSIGNED', page: '2', limit: '25', sort: 'startDate', dir: 'asc' }, { type: 'query', metatype: ListStudentsQueryDto });
    expect(result.page).toBe(2);
    await expect(pipe.transform({ showInactive: 'false' }, { type: 'query', metatype: ListStudentsQueryDto })).rejects.toThrow();
  });
  it('requires a valid site for new manual registration', async () => {
    await expect(pipe.transform({ stdName: 'Fixture', stdEmail: 'fixture@example.test' }, { type: 'body', metatype: CreateStudentDto })).rejects.toThrow();
    await expect(pipe.transform({ stdName: 'Fixture', stdSite: 'UNKNOWN' }, { type: 'body', metatype: CreateStudentDto })).rejects.toThrow();
  });
  it('rejects bulk mutation requests without a valid timestamp', async () => {
    await expect(pipe.transform({ items: [{ id: '11111111-1111-4111-8111-111111111111', updatedAt: 'invalid' }], site: 'TPI', reason: 'review' }, { type: 'body', metatype: ChangeStudentSitesDto })).rejects.toThrow();
  });
});
