import type { Metadata } from "next";
import { MapTestPageClient } from "./page-client";

// SEO metadata canonical (ko). i18n page content is rendered client-side.
export const metadata: Metadata = {
  title: "온라인 MAP TEST 응시 신청",
  description:
    "NWEA 공식 MAP TEST 응시 신청 · 학생 인적사항을 입력하시면 영업일 기준 24시간 이내 전문 컨설턴트가 연락드립니다.",
};

export default function MapTestPage() {
  return <MapTestPageClient />;
}
