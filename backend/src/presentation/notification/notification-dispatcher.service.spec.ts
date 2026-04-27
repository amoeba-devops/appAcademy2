import { Repository } from 'typeorm';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationTemplateEntity } from '../../infrastructure/database/entities/notification-template.entity';
import { NotificationLogEntity } from '../../infrastructure/database/entities/notification-log.entity';
import { NOTIFICATION_EVENTS } from '../../application/notification/notification-context.types';
import type { IAmoebaTalkClient } from '../../infrastructure/external/ama/notify/interfaces/amoebatalk-client.interface';

function makeRepoMock<T extends object>(): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x: unknown) => x as T),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('NotificationDispatcher', () => {
  let tplRepo: jest.Mocked<Repository<NotificationTemplateEntity>>;
  let logRepo: jest.Mocked<Repository<NotificationLogEntity>>;
  let client: jest.Mocked<IAmoebaTalkClient>;
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    tplRepo = makeRepoMock<NotificationTemplateEntity>();
    logRepo = makeRepoMock<NotificationLogEntity>();
    client = { send: jest.fn() };
    dispatcher = new NotificationDispatcher(tplRepo, logRepo, client);
  });

  it('T-7: template not found → persists FAILED log with TEMPLATE_NOT_FOUND', async () => {
    tplRepo.findOne.mockResolvedValueOnce(null);

    await dispatcher.dispatch(NOTIFICATION_EVENTS.PaymentDone, {
      academyId: 1,
      recipients: ['010-1111-2222'],
      recipientKind: 'PARENT',
      variables: { orderNo: 'O-1' },
    });

    expect(client.send).not.toHaveBeenCalled();
    expect(logRepo.save).toHaveBeenCalledTimes(1);
    const saved = logRepo.save.mock.calls[0][0] as NotificationLogEntity;
    expect(saved.nlgStatus).toBe('FAILED');
    expect(saved.nlgErrorCode).toBe('TEMPLATE_NOT_FOUND');
    expect(saved.nlgEvent).toBe('PAYMENT_DONE');
  });

  it('T-8: happy path → calls client.send and persists SENT log', async () => {
    tplRepo.findOne.mockResolvedValueOnce({
      ntfId: 42,
      acdId: 1,
      ntfEvent: 'PAYMENT_DONE',
      ntfBody: '결제 완료: {{orderNo}}',
      ntfIsActive: 1,
    } as NotificationTemplateEntity);
    client.send.mockResolvedValueOnce({ messageId: 'amt-001', status: 'SENT' });

    await dispatcher.dispatch(NOTIFICATION_EVENTS.PaymentDone, {
      academyId: 1,
      recipients: ['010-1111-2222'],
      recipientKind: 'PARENT',
      subjectId: 100,
      subjectKind: 'PAYMENT_ORDER',
      variables: { orderNo: 'O-1' },
    });

    expect(client.send).toHaveBeenCalledTimes(1);
    const sentArg = client.send.mock.calls[0][0];
    expect(sentArg.body).toBe('결제 완료: O-1');
    expect(sentArg.templateCode).toBe('PAYMENT_DONE');

    expect(logRepo.save).toHaveBeenCalledTimes(1);
    const saved = logRepo.save.mock.calls[0][0] as NotificationLogEntity;
    expect(saved.nlgStatus).toBe('SENT');
    expect(saved.nlgProviderMsgId).toBe('amt-001');
    expect(saved.nlgTemplateId).toBe(42);
  });

  it('T-9: client.send fails → persists FAILED log, does not throw', async () => {
    tplRepo.findOne.mockResolvedValueOnce({
      ntfId: 7,
      acdId: 1,
      ntfEvent: 'REFUND_DONE',
      ntfBody: '환불 완료',
      ntfIsActive: 1,
    } as NotificationTemplateEntity);
    client.send.mockRejectedValueOnce(new Error('AmoebaTalk down'));

    await expect(
      dispatcher.dispatch(NOTIFICATION_EVENTS.RefundDone, {
        academyId: 1,
        recipients: ['010-9999-8888'],
        variables: {},
      }),
    ).resolves.toBeUndefined();

    expect(logRepo.save).toHaveBeenCalledTimes(1);
    const saved = logRepo.save.mock.calls[0][0] as NotificationLogEntity;
    expect(saved.nlgStatus).toBe('FAILED');
    expect(saved.nlgErrorCode).toBe('SEND_ERROR');
    expect(saved.nlgErrorMessage).toContain('AmoebaTalk down');
  });

  it('handles multiple recipients independently', async () => {
    tplRepo.findOne.mockResolvedValueOnce({
      ntfId: 1,
      acdId: 1,
      ntfEvent: 'CONSULTATION_RECEIVED',
      ntfBody: 'Hi {{parentName}}',
      ntfIsActive: 1,
    } as NotificationTemplateEntity);
    client.send
      .mockResolvedValueOnce({ messageId: 'a', status: 'SENT' })
      .mockRejectedValueOnce(new Error('boom'));

    await dispatcher.dispatch(NOTIFICATION_EVENTS.ConsultationReceived, {
      academyId: 1,
      recipients: ['010-1', '010-2'],
      variables: { parentName: 'A' },
    });

    expect(logRepo.save).toHaveBeenCalledTimes(2);
    const statuses = logRepo.save.mock.calls.map(
      (c) => (c[0] as NotificationLogEntity).nlgStatus,
    );
    expect(statuses).toEqual(['SENT', 'FAILED']);
  });
});
