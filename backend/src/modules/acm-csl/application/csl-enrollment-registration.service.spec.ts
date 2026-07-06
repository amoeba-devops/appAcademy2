import { CslEnrollmentRegistrationService } from './csl-enrollment-registration.service';

/**
 * PLN-260706 — auto-registration behaviour: idempotency, anonymous skip,
 * find-vs-create, parent link, portal account issuance.
 */
describe('CslEnrollmentRegistrationService', () => {
  const ENT = 'e1';

  const makeCrypto = () => ({
    // decrypt returns a fixed map keyed by the ciphertext buffer's string.
    decrypt: jest.fn(({ ciphertext }: { ciphertext: Buffer }) =>
      ciphertext.toString(),
    ),
  });

  const buf = (s: string) => Buffer.from(s);

  const baseInquiry = (over: Record<string, unknown> = {}) => ({
    id: 'inq-1',
    entId: ENT,
    isAnonymous: false,
    nameEncrypted: buf('홍길동'),
    nameIv: buf('iv'),
    nameAuthTag: buf('tag'),
    phoneEncrypted: buf('010-1234-5678'),
    phoneIv: buf('iv'),
    phoneAuthTag: buf('tag'),
    parentNameEncrypted: buf('홍부모'),
    parentNameIv: buf('iv'),
    parentNameAuthTag: buf('tag'),
    schoolFreetext: '트리니티중',
    grade: '중2',
    stdId: null,
    ...over,
  });

  function build(opts: {
    inquiry: Record<string, unknown> | null;
    students?: any[];
    parents?: any[];
  }) {
    const inqRepo = {
      findOne: jest.fn().mockResolvedValue(opts.inquiry),
      save: jest.fn(async (x: any) => x),
    };
    const savedStudents: any[] = [];
    const stdRepo = {
      find: jest.fn().mockResolvedValue(opts.students ?? []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        const row = { id: `std-${savedStudents.length + 1}`, ...x };
        savedStudents.push(row);
        return row;
      }),
    };
    const parRepo = {
      find: jest.fn().mockResolvedValue(opts.parents ?? []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'par-1', ...x })),
    };
    const linkRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const portal = {
      ensureAccount: jest
        .fn()
        .mockResolvedValue({ account: { id: 'pac' }, created: true }),
    };
    const svc = new CslEnrollmentRegistrationService(
      inqRepo as any,
      stdRepo as any,
      parRepo as any,
      linkRepo as any,
      makeCrypto() as any,
      portal as any,
    );
    return { svc, inqRepo, stdRepo, parRepo, linkRepo, portal };
  }

  it('creates student + parent + link and issues both portal accounts', async () => {
    const h = build({ inquiry: baseInquiry() });
    const res = await h.svc.register(ENT, 'inq-1');

    expect(res).toEqual({ stdId: 'std-1', created: true });
    expect(h.stdRepo.save).toHaveBeenCalledTimes(1);
    expect(h.parRepo.save).toHaveBeenCalledTimes(1);
    // link created with primary = true (first guardian)
    expect(h.linkRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ stdId: 'std-1', parId: 'par-1', isPrimary: true }),
    );
    // portal accounts: STUDENT + PARENT
    expect(h.portal.ensureAccount).toHaveBeenCalledWith(ENT, 'PARENT', 'par-1');
    expect(h.portal.ensureAccount).toHaveBeenCalledWith(ENT, 'STUDENT', 'std-1');
    // idempotency link stamped
    expect(h.inqRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ stdId: 'std-1' }),
    );
  });

  it('is idempotent — skips when inq already linked to a student', async () => {
    const h = build({ inquiry: baseInquiry({ stdId: 'std-existing' }) });
    const res = await h.svc.register(ENT, 'inq-1');
    expect(res).toEqual({ stdId: 'std-existing', created: false });
    expect(h.stdRepo.save).not.toHaveBeenCalled();
    expect(h.portal.ensureAccount).not.toHaveBeenCalled();
  });

  it('skips anonymous inquiries', async () => {
    const h = build({ inquiry: baseInquiry({ isAnonymous: true }) });
    const res = await h.svc.register(ENT, 'inq-1');
    expect(res).toBeNull();
    expect(h.stdRepo.save).not.toHaveBeenCalled();
  });

  it('reuses an existing student matched by name + phone (no create)', async () => {
    const existing = {
      id: 'std-9',
      name: '홍길동',
      phone: '01012345678',
      status: 'ACTIVE',
    };
    const h = build({ inquiry: baseInquiry(), students: [existing] });
    const res = await h.svc.register(ENT, 'inq-1');
    expect(res).toEqual({ stdId: 'std-9', created: false });
    expect(h.stdRepo.save).not.toHaveBeenCalled();
    expect(h.portal.ensureAccount).toHaveBeenCalledWith(ENT, 'STUDENT', 'std-9');
  });

  it('creates a new student when the name is ambiguous (2+ name-only matches)', async () => {
    const h = build({
      inquiry: baseInquiry({ phoneEncrypted: null, phoneIv: null, phoneAuthTag: null }),
      students: [
        { id: 'a', name: '홍길동', phone: null, status: 'ACTIVE' },
        { id: 'b', name: '홍길동', phone: null, status: 'ACTIVE' },
      ],
    });
    const res = await h.svc.register(ENT, 'inq-1');
    expect(res?.created).toBe(true);
    expect(h.stdRepo.save).toHaveBeenCalledTimes(1);
  });
});
