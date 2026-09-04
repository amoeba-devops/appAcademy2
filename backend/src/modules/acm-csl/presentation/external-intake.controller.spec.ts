import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExternalIntakeController, ExternalIntakeDto } from './external-intake.controller';
import type { InquiryService } from '../application/inquiry.service';

/**
 * REQ-260903G — external intake gate branches:
 * site key / origin allowlist / honeypot / purpose-label mapping.
 */
describe('ExternalIntakeController', () => {
  let create: jest.Mock;
  let controller: ExternalIntakeController;

  const baseDto = (): ExternalIntakeDto =>
    Object.assign(new ExternalIntakeDto(), {
      studentName: '김민준',
      parentPhone: '010-1234-5678',
      consent: true,
    });

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({ seqNo: 42 });
    controller = new ExternalIntakeController({
      create,
    } as unknown as InquiryService);
    delete process.env.ACM_INTAKE_SITE_KEYS;
  });

  it('rejects missing/unknown site key with 401', async () => {
    await expect(controller.submit(baseDto(), undefined, undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.submit(baseDto(), 'wrong-key', undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects disallowed Origin with 403', async () => {
    await expect(
      controller.submit(baseDto(), 'dev-intake-tpi', 'https://evil.example'),
    ).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts allowed Origin and stores WEB_EXTERNAL + source site', async () => {
    const res = await controller.submit(
      baseDto(),
      'dev-intake-tpi',
      'https://www.tpi.co.kr',
    );
    expect(res).toEqual({ success: true, seqNo: 42 });
    expect(create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        inflowType: 'WEB_EXTERNAL',
        sourceSite: 'TPI',
        applyType: 'COUNSELING_ONLY',
        phoneStatus: 'PROVIDED',
        schoolFreetext: 'TPI 웹 접수',
      }),
    );
  });

  it('accepts a request without Origin (non-browser client with valid key)', async () => {
    await controller.submit(baseDto(), 'dev-intake-trinity', undefined);
    expect(create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sourceSite: 'TRINITY' }),
    );
  });

  it('honeypot filled → 200-shaped success without storing', async () => {
    const dto = baseDto();
    dto.website = 'http://spam.example';
    const res = await controller.submit(dto, 'dev-intake-tpi', 'https://www.tpi.co.kr');
    expect(res).toEqual({ success: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('maps known purpose labels to codes and keeps unmapped labels verbatim', async () => {
    const dto = baseDto();
    dto.applyPurposeLabels = [
      'MAP TEST 튜터링',
      '맞춤형 GPA 관리',
      '심화 수업(SSAT / Duolingo / TOEFL / PSAT / AP / IB / ACT / SAT)',
      '해외 주니어 보딩스쿨 입학 준비', // not in TPI map
    ];
    await controller.submit(dto, 'dev-intake-tpi', 'https://www.tpi.co.kr');
    expect(create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        applyPurposes: ['MAP_TEST_TUTORING', 'GPA_MGMT', 'ADVANCED_COURSES'],
        applyPurposeOther: '해외 주니어 보딩스쿨 입학 준비',
      }),
    );
  });

  it('dedupes labels mapping to the same code (TRINITY → INTL_SCHOOL_PREP)', async () => {
    const dto = baseDto();
    dto.applyPurposeLabels = ['인가 국제학교 입학 준비', '비인가 국제학교 입학 준비'];
    await controller.submit(dto, 'dev-intake-trinity', 'https://trinityacademy.imweb.me');
    expect(create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        applyPurposes: ['INTL_SCHOOL_PREP'],
        applyPurposeOther: undefined,
      }),
    );
  });

  it('honors ACM_INTAKE_SITE_KEYS rotation (default key stops working)', async () => {
    process.env.ACM_INTAKE_SITE_KEYS = 'TPI:rotated-key';
    await expect(
      controller.submit(baseDto(), 'dev-intake-tpi', 'https://www.tpi.co.kr'),
    ).rejects.toThrow(UnauthorizedException);
    await controller.submit(baseDto(), 'rotated-key', 'https://www.tpi.co.kr');
    expect(create).toHaveBeenCalledTimes(1);
    delete process.env.ACM_INTAKE_SITE_KEYS;
  });
});
