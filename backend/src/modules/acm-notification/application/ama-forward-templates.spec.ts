import {
  forwardHref,
  forwardLink,
  normalizeForwardLocale,
  renderForward,
} from './ama-forward-templates';

describe('ama-forward-templates (REQ-261006)', () => {
  it('renders stage change with localized stage names', () => {
    expect(
      renderForward('ko', 'CSL_STAGE', {
        seqNo: 107,
        fromStage: 'TRIAL_CLASS',
        toStage: 'ENROLLMENT_COUNSELING',
      }),
    ).toEqual({
      title: '[ACM] 상담 #107 단계 변경',
      body: '데모수업 → 등록 상담',
    });
    expect(renderForward('en', 'CSL_CREATED', { seqNo: 5 }).title).toBe(
      '[ACM] New inquiry #5',
    );
  });

  it('falls back to ko for unknown locales and to CSL_CREATED for unknown types', () => {
    expect(normalizeForwardLocale('fr')).toBe('ko');
    expect(normalizeForwardLocale('zh-CN')).toBe('zh-CN');
    expect(renderForward('ko', 'UNKNOWN', {}).title).toContain('신규 상담');
  });

  it('builds the console href and an SSO re-entry link', () => {
    expect(forwardHref('CSL_STAGE', 'abc', {})).toBe('/admin/csl/abc');
    expect(forwardHref('CAL_UPDATED', 'e1', {})).toBe('/admin/cal/e1');
    expect(forwardHref('CHAT_MENTION', 'm1', { channelId: 'c 1' })).toBe(
      '/admin/chat?channelId=c%201&messageId=m1',
    );
    expect(forwardLink('https://acm.amoeba.site/', '/admin/csl/abc')).toBe(
      'https://acm.amoeba.site/login?returnTo=%2Fadmin%2Fcsl%2Fabc',
    );
  });
});
