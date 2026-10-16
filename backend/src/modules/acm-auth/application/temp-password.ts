import { randomInt } from 'crypto';

/** 혼동 문자(0/O, 1/l/I) 제외. 정책(영문·숫자 포함, 8자 이상)을 항상 만족. */
const PW_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const PW_DIGITS = '23456789';
const PW_ALL = PW_LETTERS + PW_DIGITS;

/** 10자 임시 비밀번호(포털·콘솔 공용). REQ-261017 에서 공용으로 분리. */
export function generateTempPassword(): string {
  const chars = [
    PW_LETTERS[randomInt(PW_LETTERS.length)],
    PW_DIGITS[randomInt(PW_DIGITS.length)],
  ];
  for (let i = 0; i < 8; i++) chars.push(PW_ALL[randomInt(PW_ALL.length)]);
  // Fisher-Yates shuffle so the guaranteed letter/digit aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
