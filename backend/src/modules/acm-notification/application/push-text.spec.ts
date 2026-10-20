import { pushText } from './push-text';

describe('pushText (REQ-261020C)', () => {
  it('names the sender and channel for a chat mention', () => {
    expect(
      pushText({
        type: 'CHAT_MENTION',
        payload: { senderName: '김선생', title: '수학팀', channelId: 'c' },
      }).body,
    ).toBe('김선생님이 채팅에서 나를 멘션했습니다 · 수학팀');
  });
  it('labels a chat message without the message content', () => {
    const r = pushText({
      type: 'CHAT_MESSAGE',
      payload: { senderName: '운영팀장', title: '운영팀' },
    });
    expect(r).toEqual({
      title: 'ACM',
      body: '운영팀장님의 새 메시지 · 운영팀',
    });
  });
  it('handles a DM without channel name and a missing sender', () => {
    expect(
      pushText({
        type: 'CHAT_MESSAGE',
        payload: { senderName: '이강사', title: '' },
      }).body,
    ).toBe('이강사님의 새 메시지');
    expect(pushText({ type: 'CHAT_MENTION', payload: {} }).body).toBe(
      '채팅에서 나를 멘션했습니다',
    );
  });
  it('uses the inbox wording for other types and a safe fallback', () => {
    expect(pushText({ type: 'CSL_STAGE', payload: { seqNo: 145 } }).body).toBe(
      '상담 상태가 변경되었습니다 · #145',
    );
    expect(
      pushText({
        type: 'ISSUE_MENTION',
        payload: { senderName: 'A', title: '로그인 오류', commentId: 'x' },
      }).body,
    ).toBe('A님이 이슈 댓글에서 나를 멘션했습니다 · 로그인 오류');
    expect(pushText({}).body).toBe('새 알림이 도착했습니다');
  });
});
