import { matchStudents } from './student-link-rules';

const s = (stdId: string, name: string, status = 'ACTIVE') => ({
  stdId,
  name,
  status,
});

describe('matchStudents (REQ-261023B)', () => {
  it('finds one student → SURE', () => {
    const r = matchStudents('김라엘 (오프라인)', [
      s('1', '김라엘'),
      s('2', '송시율'),
    ]);
    expect(r.state).toBe('SURE');
    expect(r.candidates.map((c) => c.name)).toEqual(['김라엘']);
  });
  it('prefers the longer name and marks the shorter one', () => {
    const r = matchStudents('김민재', [s('1', '김민'), s('2', '김민재')]);
    expect(r.state).toBe('SURE');
    expect(r.candidates).toEqual([
      { stdId: '1', name: '김민', status: 'ACTIVE', suppressedBy: '김민재' },
      { stdId: '2', name: '김민재', status: 'ACTIVE' },
    ]);
    expect(
      matchStudents('이서준', [
        s('1', '서준'),
        s('2', '이서준'),
      ]).candidates.find((c) => c.name === '서준')?.suppressedBy,
    ).toBe('이서준');
  });
  it('keeps siblings → MULTI', () => {
    const r = matchStudents('이윤건, 이윤후 (오프라인)', [
      s('1', '이윤건'),
      s('2', '이윤후'),
    ]);
    expect(r.state).toBe('MULTI');
    expect(r.candidates.map((c) => c.name)).toEqual(['이윤건', '이윤후']);
  });
  it('needs a human when two students share a name', () => {
    expect(
      matchStudents('홍길동', [s('1', '홍길동'), s('2', '홍길동')]).state,
    ).toBe('MULTI');
  });
  it('ignores 1-character names and reports NONE', () => {
    expect(
      matchStudents('수업 가능 시간', [s('1', '수'), s('2', '김라엘')]),
    ).toEqual({ candidates: [], state: 'NONE' });
  });
});
