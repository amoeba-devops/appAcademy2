import type { EntityManager } from 'typeorm';
import { IcsImportService } from './ics/ics-import.service';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { CalEventService } from './cal-event.service';
import { VideoConfigService } from './video-config.service';
import { CalInviteeService } from './cal-invitee.service';
import { InviteeNotifierService } from './invitee-notifier.service';
import { BodaRoomService } from './boda-room.service';
import { CalEventAttachmentService } from './cal-event-attachment.service';
import { CalEventReviewService } from './cal-event-review.service';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalEventRevisionTypeormEntity } from '../infrastructure/typeorm/cal-event-revision.typeorm-entity';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { TrialClassTypeormEntity } from '../../acm-csl/infrastructure/typeorm/trial-class.typeorm-entity';
import { MapTestTypeormEntity } from '../../acm-csl/infrastructure/typeorm/map-test.typeorm-entity';
import { AttachmentTypeormEntity } from '../../acm-csl/infrastructure/typeorm/attachment.typeorm-entity';
import type { CreateCalEventDto } from './dto/cal-event.dto';

describe('calendar video transitions', () => {
  const event = {
    id: 'evt',
    entId: 'tenant-a',
    ownerUserId: 'user-a',
    source: 'MANUAL',
    category: 'REGULAR_CLASS',
    title: 'Class',
    startAt: new Date('2026-09-28T01:00:00Z'),
    endAt: new Date('2026-09-28T02:00:00Z'),
    meetingProvider: 'BODASCHOOL',
    meetingUrl: 'https://acm.example/web/classroom/evt',
    bodaRoomType: 'ONE_TO_ONE',
  };
  const repo = {
    manager: {
      transaction: async (work: (m: EntityManager) => Promise<unknown>) =>
        work({
          save: async (entity: unknown, value?: object) =>
            value ? repo.save(value) : revision.save(entity),
          query: async () => [],
          getRepository: () => repo,
        } as unknown as EntityManager),
    },
    update: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };
  const revision = { create: jest.fn((x: unknown) => x), save: jest.fn() };
  const provision = jest
    .fn()
    .mockResolvedValue({ launcherUrl: event.meetingUrl });
  const video = {
    get: jest.fn(),
    assertBoda: jest.fn(),
    assertNoActiveRooms: jest.fn(),
    withLock: jest.fn(async (_id: string, work: () => Promise<unknown>) =>
      work(),
    ),
  };
  let svc: CalEventService;
  beforeEach(async () => {
    jest.clearAllMocks();
    repo.findOne.mockResolvedValue({ ...event });
    repo.save.mockImplementation(async (x: object) => ({
      id: 'evt',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...x,
    }));
    video.get.mockResolvedValue({
      provider: 'GOOGLE_MEET',
      bodaEnabled: false,
    });
    video.assertBoda.mockImplementation(async () => {
      throw new Error('VIDEO_PROVIDER_DISABLED');
    });
    video.assertNoActiveRooms.mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [
        CalEventService,
        {
          provide: IcsImportService,
          useValue: { ensureRange: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getRepositoryToken(CalEventTypeormEntity, ACM_DS),
          useValue: repo,
        },
        {
          provide: getRepositoryToken(CalEventRevisionTypeormEntity, ACM_DS),
          useValue: revision,
        },
        ...[
          AcmUserTypeormEntity,
          TeacherTypeormEntity,
          TrialClassTypeormEntity,
          MapTestTypeormEntity,
          AttachmentTypeormEntity,
        ].map((entity) => ({
          provide: getRepositoryToken(entity, ACM_DS),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        })),
        { provide: VideoConfigService, useValue: video },
        {
          provide: CalInviteeService,
          useValue: {
            listForEvent: jest.fn().mockResolvedValue([]),
            assertSameTenant: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: InviteeNotifierService, useValue: {} },
        { provide: BodaRoomService, useValue: { createPending: provision } },
        { provide: CalEventAttachmentService, useValue: {} },
        { provide: CalEventReviewService, useValue: {} },
      ],
    }).compile();
    svc = mod.get(CalEventService);
  });
  const dto: CreateCalEventDto = {
    evtCategory: 'REGULAR_CLASS',
    evtTitle: 'Class',
    evtStartAt: '2026-09-28T01:00:00Z',
    evtEndAt: '2026-09-28T02:00:00Z',
    evtMeetingProvider: 'GOOGLE_MEET',
    evtMeetingUrl: 'https://meet.google.com/abc-defg-hij',
  };
  it('creates a Google class without provisioning a BODA room', async () => {
    const result = await svc.create('tenant-a', 'user-a', 'ADMIN', { ...dto });
    expect(result.meetingProvider).toBe('GOOGLE_MEET');
    expect(result.meetingUrl).toBe(dto.evtMeetingUrl);
    expect(provision).not.toHaveBeenCalled();
  });
  it('rejects missing links and attempts to override the tenant provider before writing', async () => {
    await expect(
      svc.create('tenant-a', 'user-a', 'ADMIN', {
        ...dto,
        evtMeetingUrl: undefined,
      }),
    ).rejects.toThrow('MEETING_URL_REQUIRED');
    await expect(
      svc.create('tenant-a', 'user-a', 'ADMIN', {
        ...dto,
        evtMeetingProvider: 'BODASCHOOL',
      }),
    ).rejects.toThrow('VIDEO_PROVIDER_MISMATCH');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('preserves a hidden old BODA event on ordinary edits without provisioning', async () => {
    const result = await svc.update('tenant-a', 'user-a', 'ADMIN', 'evt', {
      evtTitle: 'Renamed',
      evtEditReason: 'Change title',
    });
    expect(result.meetingProvider).toBe('BODASCHOOL');
    expect(result.meetingUrl).toBe(event.meetingUrl);
    expect(provision).not.toHaveBeenCalled();
  });
  it('explicitly converts and audits the new meeting URL', async () => {
    const result = await svc.update('tenant-a', 'user-a', 'ADMIN', 'evt', {
      evtMeetingProvider: 'GOOGLE_MEET',
      evtMeetingUrl: dto.evtMeetingUrl,
      evtEditReason: 'Switch video service',
    });
    expect(result.meetingProvider).toBe('GOOGLE_MEET');
    expect(video.assertNoActiveRooms).toHaveBeenCalledWith('tenant-a', 'evt');
    expect(revision.save).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.arrayContaining([
          expect.objectContaining({
            field: 'meetingUrl',
            after: dto.evtMeetingUrl,
          }),
        ]),
      }),
    );
    expect(provision).not.toHaveBeenCalled();
  });
  it('blocks conversion of an active room before changing the event', async () => {
    video.assertNoActiveRooms.mockRejectedValue(new Error('VIDEO_ACTIVE_ROOM'));
    await expect(
      svc.update('tenant-a', 'user-a', 'ADMIN', 'evt', {
        evtMeetingProvider: 'GOOGLE_MEET',
        evtMeetingUrl: dto.evtMeetingUrl,
        evtEditReason: 'Switch service',
      }),
    ).rejects.toThrow('VIDEO_ACTIVE_ROOM');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('preserves consultation scheduling without silently creating BODA in Google mode', async () => {
    const result = await svc.createFromConsultation(
      'tenant-a',
      'user-a',
      'ADMIN',
      {
        ...dto,
        evtCategory: 'DEMO_CLASS',
        evtMeetingProvider: 'BODASCHOOL',
        evtMeetingUrl: undefined,
      },
    );
    expect(result.meetingProvider).toBe('GOOGLE_MEET');
    expect(result.meetingUrl).toBeNull();
    expect(provision).not.toHaveBeenCalled();
  });
  it('keeps an existing Google link usable after the tenant returns to BODA', async () => {
    video.get.mockResolvedValue({ provider: 'BODASCHOOL', bodaEnabled: true });
    repo.findOne.mockResolvedValue({
      ...event,
      meetingProvider: 'GOOGLE_MEET',
      meetingUrl: dto.evtMeetingUrl,
    });
    const result = await svc.update('tenant-a', 'user-a', 'ADMIN', 'evt', {
      evtTitle: 'Rescheduled',
      evtEditReason: 'Keep Google class',
    });
    expect(result.meetingProvider).toBe('GOOGLE_MEET');
    expect(result.meetingUrl).toBe(dto.evtMeetingUrl);
    expect(provision).not.toHaveBeenCalled();
  });
  it('rejects unauthorized edits without writing or provisioning', async () => {
    await expect(
      svc.update('tenant-a', 'other-user', 'TEACHER', 'evt', {
        evtTitle: 'Unauthorized',
        evtEditReason: 'Change title',
      }),
    ).rejects.toThrow('NOT_OWNER');
    expect(repo.save).not.toHaveBeenCalled();
    expect(provision).not.toHaveBeenCalled();
  });
  it('keeps BODA provisioning when selected', async () => {
    video.get.mockResolvedValue({ provider: 'BODASCHOOL', bodaEnabled: true });
    video.assertBoda.mockResolvedValue(undefined);
    Object.assign(repo, { update: jest.fn() });
    await svc.create('tenant-a', 'user-a', 'ADMIN', {
      ...dto,
      evtMeetingProvider: 'BODASCHOOL',
      evtMeetingUrl: undefined,
    });
    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({ entId: 'tenant-a', evtId: 'evt' }),
      expect.objectContaining({ save: expect.any(Function) }),
    );
  });
});
