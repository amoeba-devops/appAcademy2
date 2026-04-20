import type { Metadata } from "next";
import { ContactPageClient } from "./page-client";

// SEO metadata canonical (ko). i18n page content is rendered client-side.
export const metadata: Metadata = {
  title: "국제학교 입학 준비 상담 신청",
  description:
    "트리니티 아카데미 · 1:1 무료 상담 · 정확한 학업 진단과 독보적인 입학 시험 클래스로 확실한 국제학교 합격을 선사합니다.",
};

export default function ContactPage() {
  return <ContactPageClient />;
}
