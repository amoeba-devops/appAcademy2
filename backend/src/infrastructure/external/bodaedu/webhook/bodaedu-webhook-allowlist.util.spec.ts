import { isIpInBodaAllowlist } from './bodaedu-webhook-allowlist.util';

describe('isIpInBodaAllowlist', () => {
  describe('exact IP match', () => {
    it('allows exact match', () => {
      expect(isIpInBodaAllowlist('1.2.3.4', '1.2.3.4')).toEqual({ allowed: true });
    });

    it('denies a different IP', () => {
      expect(isIpInBodaAllowlist('1.2.3.5', '1.2.3.4')).toEqual({
        allowed: false,
        reason: 'NOT_IN_ALLOWLIST',
      });
    });
  });

  describe('CIDR match', () => {
    it('allows IP within /24', () => {
      expect(isIpInBodaAllowlist('10.0.0.123', '10.0.0.0/24')).toEqual({ allowed: true });
    });

    it('denies IP outside /24', () => {
      expect(isIpInBodaAllowlist('10.0.1.5', '10.0.0.0/24')).toEqual({
        allowed: false,
        reason: 'NOT_IN_ALLOWLIST',
      });
    });

    it('allows IP within /16', () => {
      expect(isIpInBodaAllowlist('192.168.50.99', '192.168.0.0/16')).toEqual({ allowed: true });
    });

    it('0.0.0.0/0 lets everything through', () => {
      expect(isIpInBodaAllowlist('203.0.113.7', '0.0.0.0/0')).toEqual({ allowed: true });
    });

    it('rejects malformed CIDR silently (no match, no throw)', () => {
      expect(isIpInBodaAllowlist('1.1.1.1', '1.1.1.0/99')).toEqual({
        allowed: false,
        reason: 'NOT_IN_ALLOWLIST',
      });
    });
  });

  describe('multiple rules', () => {
    it('matches against any rule in the CSV', () => {
      const csv = '1.2.3.4, 10.0.0.0/24, 5.5.5.5';
      expect(isIpInBodaAllowlist('10.0.0.99', csv)).toEqual({ allowed: true });
      expect(isIpInBodaAllowlist('5.5.5.5', csv)).toEqual({ allowed: true });
      expect(isIpInBodaAllowlist('1.2.3.4', csv)).toEqual({ allowed: true });
      expect(isIpInBodaAllowlist('192.168.0.1', csv)).toEqual({
        allowed: false,
        reason: 'NOT_IN_ALLOWLIST',
      });
    });

    it('ignores blank entries', () => {
      expect(isIpInBodaAllowlist('1.2.3.4', '  , 1.2.3.4,, ')).toEqual({ allowed: true });
    });
  });

  describe('failure modes', () => {
    it('returns EMPTY_ALLOWLIST when allow list is empty', () => {
      expect(isIpInBodaAllowlist('1.2.3.4', '')).toEqual({
        allowed: false,
        reason: 'EMPTY_ALLOWLIST',
      });
      expect(isIpInBodaAllowlist('1.2.3.4', '   ')).toEqual({
        allowed: false,
        reason: 'EMPTY_ALLOWLIST',
      });
      expect(isIpInBodaAllowlist('1.2.3.4', null)).toEqual({
        allowed: false,
        reason: 'EMPTY_ALLOWLIST',
      });
    });

    it('returns INVALID_IP for missing srcIp', () => {
      expect(isIpInBodaAllowlist(undefined, '1.2.3.4')).toEqual({
        allowed: false,
        reason: 'INVALID_IP',
      });
    });

    it('returns INVALID_IP for malformed srcIp', () => {
      expect(isIpInBodaAllowlist('not-an-ip', '1.2.3.4')).toEqual({
        allowed: false,
        reason: 'INVALID_IP',
      });
      expect(isIpInBodaAllowlist('999.999.999.999', '1.2.3.4')).toEqual({
        allowed: false,
        reason: 'INVALID_IP',
      });
    });
  });
});
