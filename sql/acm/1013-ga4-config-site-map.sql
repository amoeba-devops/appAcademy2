-- 1013 — PLN-260914C: GA4 사이트별 연동 정보(URL·측정 ID·스트림 ID) + 마지막 연동 상태 점검 결과
-- gac_stream_map 은 호환을 위해 유지하며 서비스가 gac_site_map[*].streamId 로부터 재생성한다. Idempotent.

ALTER TABLE amb_acm_ga4_config
  ADD COLUMN IF NOT EXISTS gac_site_map        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gac_site_status     JSONB,
  ADD COLUMN IF NOT EXISTS gac_site_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN amb_acm_ga4_config.gac_site_map IS
  'PLN-260914C {"TPI":{"url":"https://…","measurementId":"G-…","streamId":"…"},…}';
COMMENT ON COLUMN amb_acm_ga4_config.gac_site_status IS
  'PLN-260914C 마지막 연동 상태 점검 결과 site → {level, tag, ga4, acm, checkedAt}';

-- 1회 이관 + 기본값 시드 (REQ-260914C Q3): 기존 gac_stream_map 의 streamId 를 site_map 으로 옮기고,
-- url/measurementId 가 비어 있는 사이트만 운영 3사이트 기본값으로 채운다. 이미 값이 있으면 건드리지 않는다.
UPDATE amb_acm_ga4_config c
   SET gac_site_map = (
     SELECT jsonb_object_agg(
              s.site,
              COALESCE(c.gac_site_map -> s.site, '{}'::jsonb)
              || jsonb_build_object(
                   'streamId',
                   COALESCE(NULLIF(c.gac_site_map -> s.site ->> 'streamId', ''), c.gac_stream_map ->> s.site, ''))
              || CASE WHEN COALESCE(c.gac_site_map -> s.site ->> 'url', '') = ''
                      THEN jsonb_build_object('url', s.url) ELSE '{}'::jsonb END
              || CASE WHEN COALESCE(c.gac_site_map -> s.site ->> 'measurementId', '') = ''
                      THEN jsonb_build_object('measurementId', s.mid) ELSE '{}'::jsonb END)
       FROM (VALUES
              ('TPI',        'https://www.tpi.co.kr/',     'G-QVDVBTC7JC'),
              ('TRINITY',    'https://trinityacademy.kr/', 'G-BM7QE6ZGSE'),
              ('SANTACROCE', 'https://santacroce.co.kr/',  'G-4EFHZC0077')
            ) AS s(site, url, mid)
   )
 WHERE NOT (c.gac_site_map ? 'TPI' AND c.gac_site_map ? 'TRINITY' AND c.gac_site_map ? 'SANTACROCE')
    OR EXISTS (
      SELECT 1 FROM (VALUES ('TPI'),('TRINITY'),('SANTACROCE')) AS s(site)
       WHERE COALESCE(c.gac_site_map -> s.site ->> 'url', '') = ''
          OR COALESCE(c.gac_site_map -> s.site ->> 'measurementId', '') = '');
