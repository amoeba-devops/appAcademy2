import { AmaOidcStateStore } from './ama-oidc-state.store';

describe('AmaOidcStateStore', () => {
  it('put + consume returns verifier and removes entry', () => {
    const s = new AmaOidcStateStore();
    s.put('st-1', { codeVerifier: 'v', returnTo: '/admin' });
    expect(s.size()).toBe(1);
    const got = s.consume('st-1');
    expect(got).toEqual({ codeVerifier: 'v', returnTo: '/admin' });
    expect(s.size()).toBe(0);
  });

  it('consume returns null on unknown state', () => {
    const s = new AmaOidcStateStore();
    expect(s.consume('nope')).toBeNull();
  });

  it('expired entry returns null', () => {
    const s = new AmaOidcStateStore();
    s.put('st-2', { codeVerifier: 'v' });
    // mutate internal expiresAt
    (s as unknown as { store: Map<string, { expiresAt: number }> }).store.get('st-2')!.expiresAt =
      Date.now() - 1;
    expect(s.consume('st-2')).toBeNull();
  });

  it('consume is one-shot', () => {
    const s = new AmaOidcStateStore();
    s.put('st-3', { codeVerifier: 'v' });
    expect(s.consume('st-3')).not.toBeNull();
    expect(s.consume('st-3')).toBeNull();
  });
});
