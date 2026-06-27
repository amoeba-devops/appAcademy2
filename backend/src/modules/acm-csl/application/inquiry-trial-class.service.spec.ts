import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { CancellationTypeormEntity } from '../infrastructure/typeorm/cancellation.typeorm-entity';
import { EnrollmentTypeormEntity } from '../infrastructure/typeorm/enrollment.typeorm-entity';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';
import { TransitionTypeormEntity } from '../infrastructure/typeorm/transition.typeorm-entity';
import { TrialClassTypeormEntity } from '../infrastructure/typeorm/trial-class.typeorm-entity';
import { InquiryService } from './inquiry.service';
import { StdInheritanceService } from './std-inheritance.service';

/**
 * REQ-260626 FR-CSL-122~128 — demo class update + feedback workflow.
 * State machine: writeFeedback → confirmFeedback → markDelivered.
 * Each step gates on the prior (confirm requires body, deliver requires
 * confirm). 404 propagates when the tcl row isn't in the tenant.
 */
describe('InquiryService — demo class + feedback', () => {
  let svc: InquiryService;
  let tcFindOne: jest.Mock;
  let tcSave: jest.Mock;
  let inqFindOne: jest.Mock;

  beforeEach(async () => {
    tcFindOne = jest.fn();
    tcSave = jest.fn((row) => Promise.resolve(row));
    inqFindOne = jest.fn().mockResolvedValue({ id: 'inq-1', entId: 'e1', deletedAt: null });

    const mod = await Test.createTestingModule({
      providers: [
        InquiryService,
        { provide: AesGcmService, useValue: { decrypt: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getDataSourceToken(ACM_DS), useValue: {} },
        { provide: getRepositoryToken(InquiryTypeormEntity, ACM_DS), useValue: { findOne: inqFindOne } },
        { provide: getRepositoryToken(MapTestTypeormEntity, ACM_DS), useValue: {} },
        {
          provide: getRepositoryToken(TrialClassTypeormEntity, ACM_DS),
          useValue: { findOne: tcFindOne, save: tcSave },
        },
        { provide: getRepositoryToken(EnrollmentTypeormEntity, ACM_DS), useValue: {} },
        { provide: getRepositoryToken(CancellationTypeormEntity, ACM_DS), useValue: {} },
        { provide: getRepositoryToken(TransitionTypeormEntity, ACM_DS), useValue: {} },
        {
          provide: StdInheritanceService,
          useValue: { inheritMapScoresOnClassStart: jest.fn() },
        },
      ],
    }).compile();

    svc = mod.get(InquiryService);
  });

  it('updateTrialClass — 404 when tcl not in tenant', async () => {
    tcFindOne.mockResolvedValueOnce(null);
    await expect(
      svc.updateTrialClass('e1', 'inq-1', 'missing', { completed: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateTrialClass — patches independent fields', async () => {
    tcFindOne.mockResolvedValueOnce({
      id: 'tcl-1', entId: 'e1', inqId: 'inq-1', heldAt: '2026-07-01',
      completed: false, teacherId: null, heldTime: null, note: null, calEventId: null,
    });
    await svc.updateTrialClass('e1', 'inq-1', 'tcl-1', {
      teacherId: 'tch-1', heldTime: '14:30', completed: true,
    });
    expect(tcSave).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: 'tch-1', heldTime: '14:30', completed: true,
      }),
    );
  });

  it('writeFeedback — stamps authoredBy/At + flips completed=true', async () => {
    tcFindOne.mockResolvedValueOnce({
      id: 'tcl-1', entId: 'e1', inqId: 'inq-1', completed: false,
    });
    await svc.writeFeedback('e1', 'inq-1', 'tcl-1', '학생이 잘 따라옴', 'teacher-1');
    expect(tcSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        feedbackBody: '학생이 잘 따라옴',
        feedbackAuthoredBy: 'teacher-1',
        completed: true,
      }),
    );
  });

  it('confirmFeedback — 400 when feedbackBody empty (state machine guard)', async () => {
    tcFindOne.mockResolvedValueOnce({
      id: 'tcl-1', entId: 'e1', inqId: 'inq-1', feedbackBody: null,
    });
    await expect(
      svc.confirmFeedback('e1', 'inq-1', 'tcl-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirmFeedback — stamps confirmedBy/At when body present', async () => {
    tcFindOne.mockResolvedValueOnce({
      id: 'tcl-1', entId: 'e1', inqId: 'inq-1', feedbackBody: 'ok',
    });
    await svc.confirmFeedback('e1', 'inq-1', 'tcl-1', 'admin-1');
    expect(tcSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        feedbackConfirmedBy: 'admin-1',
        feedbackConfirmedAt: expect.any(Date),
      }),
    );
  });

  it('markFeedbackDelivered — 400 when not yet confirmed', async () => {
    tcFindOne.mockResolvedValueOnce({
      id: 'tcl-1', entId: 'e1', inqId: 'inq-1', feedbackConfirmedAt: null,
    });
    await expect(
      svc.markFeedbackDelivered('e1', 'inq-1', 'tcl-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('markFeedbackDelivered — stamps deliveredAt after confirm', async () => {
    tcFindOne.mockResolvedValueOnce({
      id: 'tcl-1', entId: 'e1', inqId: 'inq-1',
      feedbackConfirmedAt: new Date(),
    });
    await svc.markFeedbackDelivered('e1', 'inq-1', 'tcl-1');
    expect(tcSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ feedbackDeliveredAt: expect.any(Date) }),
    );
  });
});
