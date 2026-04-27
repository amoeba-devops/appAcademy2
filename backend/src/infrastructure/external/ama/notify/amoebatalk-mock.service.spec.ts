import { AmoebaTalkMockService } from './amoebatalk-mock.service';

describe('AmoebaTalkMockService', () => {
  it('T-3: send returns synthetic messageId and SENT status', async () => {
    const svc = new AmoebaTalkMockService();
    const result = await svc.send({
      to: '010-1234-5678',
      templateCode: 'PAYMENT_DONE',
      variables: { orderNo: 'ORD-1' },
    });
    expect(result.status).toBe('SENT');
    expect(result.messageId).toMatch(/^mock-\d+-\d+$/);
  });

  it('returns unique messageIds for sequential sends', async () => {
    const svc = new AmoebaTalkMockService();
    const r1 = await svc.send({
      to: '010-1111-2222',
      templateCode: 'X',
      variables: {},
    });
    const r2 = await svc.send({
      to: '010-1111-2222',
      templateCode: 'X',
      variables: {},
    });
    expect(r1.messageId).not.toEqual(r2.messageId);
  });
});
