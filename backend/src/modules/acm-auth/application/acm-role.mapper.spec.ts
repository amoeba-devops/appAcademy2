import { mapAcmRole } from './acm-role.mapper';

describe('mapAcmRole (REQ-260609 FR-B)', () => {
  describe('admin-tier levels → ADMIN (FR-B1)', () => {
    it.each(['MASTER', 'MANAGER', 'OWNER', 'master', ' Manager '])(
      'level=%s → ADMIN regardless of jobRole',
      (level) => {
        expect(mapAcmRole(level, 'TEACHER')).toBe('ADMIN');
        expect(mapAcmRole(level, null)).toBe('ADMIN');
        expect(mapAcmRole(level, 'WHATEVER')).toBe('ADMIN');
      },
    );
  });

  describe('non-admin levels → job field decides (FR-B2)', () => {
    it('jobRole TEACHER → TEACHER', () => {
      expect(mapAcmRole('MEMBER', 'TEACHER')).toBe('TEACHER');
      expect(mapAcmRole('VIEWER', 'teacher')).toBe('TEACHER');
    });

    it('non-teacher job → STAFF', () => {
      expect(mapAcmRole('MEMBER', 'ADMIN_STAFF')).toBe('STAFF');
      expect(mapAcmRole('VIEWER', 'COUNSELOR')).toBe('STAFF');
    });

    it('null / empty / unknown job → STAFF', () => {
      expect(mapAcmRole('MEMBER', null)).toBe('STAFF');
      expect(mapAcmRole('MEMBER', undefined)).toBe('STAFF');
      expect(mapAcmRole('MEMBER', '')).toBe('STAFF');
    });
  });

  describe('unknown / missing level', () => {
    it('falls back to job-field logic (defaults to STAFF)', () => {
      expect(mapAcmRole(null, null)).toBe('STAFF');
      expect(mapAcmRole('UNKNOWN', 'TEACHER')).toBe('TEACHER');
    });
  });
});
