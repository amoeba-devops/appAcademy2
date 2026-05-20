export const TPI_SITE = {
  name: 'Trinity Prep Institute',
  shortName: 'TPI',
  phone: '1555-2108',
  phoneDigits: '15552108',
  email: 'info@tpiglobal.network',
  kakaoChat: 'http://pf.kakao.com/_IaxbCn/chat',
  address: '서울특별시 강남구 언주로 152길 15-4',
  businessId: '546-06-03432',
} as const;

export const TPI_LOGO =
  'https://cdn.imweb.me/thumbnail/20260424/06355cc452830.jpg';

export const TPI_HERO_BG =
  'https://cdn.imweb.me/thumbnail/20251106/907e0c00a7bd6.jpg';

export const TPI_FEATURE_KEYS = ['f1', 'f2', 'f3', 'f4', 'f5'] as const;

/** Per-strength imweb CDN images (live tpi.co.kr 5 strengths section). */
export const TPI_FEATURE_IMAGES: Record<(typeof TPI_FEATURE_KEYS)[number], string> = {
  f1: 'https://cdn.imweb.me/upload/S20251104ec4c428bdd288/f6a1212c11f7d.png',
  f2: 'https://cdn.imweb.me/upload/S20251104ec4c428bdd288/5952f643eff38.png',
  f3: 'https://cdn.imweb.me/upload/S20251104ec4c428bdd288/84fa950641796.png',
  f4: 'https://cdn.imweb.me/upload/S20251104ec4c428bdd288/ce01a69a2dd73.png',
  f5: 'https://cdn.imweb.me/upload/S20251104ec4c428bdd288/dc9d08fd2908b.png',
};
export const TPI_PROCESS_KEYS = ['s1', 's2', 's3', 's4', 's5'] as const;
export const TPI_IMPORTANCE_KEYS = ['i1', 'i2', 'i3', 'i4'] as const;

export const TPI_REVIEW_IMAGES: ReadonlyArray<string> = [
  'https://i.ifh.cc/g/review01.jpg',
  'https://i.ifh.cc/g/review02.jpg',
  'https://i.ifh.cc/g/review03.jpg',
  'https://i.ifh.cc/g/review04.jpg',
  'https://i.ifh.cc/g/review05.jpg',
  'https://i.ifh.cc/g/review06.jpg',
  'https://i.ifh.cc/g/review07.jpg',
  'https://i.ifh.cc/g/review08.jpg',
];
