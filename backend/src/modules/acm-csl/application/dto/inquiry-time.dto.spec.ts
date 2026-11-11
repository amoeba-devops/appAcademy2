import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CSL_TIME_HHMM,
  CreateTrialClassDto,
  UpdateTrialClassDto,
  UpsertLevelTestDto,
  UpsertMapTestDto,
} from './inquiry.dto';

/** REQ-261111 — 수업 시간 직접 입력: 30분 단위 제한 해제, 00:00~23:59 만 허용. */
describe('CSL time validation (REQ-261111)', () => {
  it.each(['08:40', '00:00', '23:59', '06:10:00', '14:30'])('allows %s', (v) => {
    expect(CSL_TIME_HHMM.test(v)).toBe(true);
  });

  it.each(['24:00', '25:10', '08:60', '8:40', '0840', '', '08:40:60'])('rejects %s', (v) => {
    expect(CSL_TIME_HHMM.test(v)).toBe(false);
  });

  const cases: Array<[string, new () => object, string]> = [
    ['UpsertMapTestDto', UpsertMapTestDto, 'scheduledTime'],
    ['UpsertLevelTestDto', UpsertLevelTestDto, 'scheduledTime'],
    ['CreateTrialClassDto', CreateTrialClassDto, 'heldTime'],
    ['UpdateTrialClassDto', UpdateTrialClassDto, 'heldTime'],
  ];

  it.each(cases)('%s accepts 08:40 and rejects 25:00', (_n, cls, field) => {
    const ok = validateSync(plainToInstance(cls, { [field]: '08:40' }));
    expect(ok.filter((e) => e.property === field)).toHaveLength(0);
    const bad = validateSync(plainToInstance(cls, { [field]: '25:00' }));
    expect(bad.filter((e) => e.property === field)).toHaveLength(1);
  });
});
