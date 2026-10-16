import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ParseEntIdPipe } from './ent-id';
import { ListSystemUsersQueryDto } from '../../acm-system/application/dto/system-user.dto';

// REQ-261016D — 고정 테넌트 ID(버전 자리 0)도 허용해야 /system/admin?entId=… 가 400 이 나지 않는다.
const TRINITY = '00000000-0000-0000-0000-000000000001';
const SYSTEM = '00000000-0000-0000-0000-0000000000ff';

describe('ent id validation', () => {
  it('accepts fixed tenant ids and random uuids', () => {
    const pipe = new ParseEntIdPipe();
    for (const id of [TRINITY, SYSTEM, '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b'])
      expect(pipe.transform(id)).toBe(id);
    expect(
      validateSync(
        plainToInstance(ListSystemUsersQueryDto, { entId: TRINITY }),
      ),
    ).toHaveLength(0);
  });
  it('rejects malformed ids', () => {
    const pipe = new ParseEntIdPipe();
    for (const bad of ['', '1', 'not-a-uuid', `${TRINITY}x`, "' OR 1=1 --"])
      expect(() => pipe.transform(bad)).toThrow(BadRequestException);
    expect(
      validateSync(plainToInstance(ListSystemUsersQueryDto, { entId: 'nope' })),
    ).not.toHaveLength(0);
  });
});
