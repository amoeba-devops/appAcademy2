import type { Metadata } from "next";
import { AboutPageClient } from "./page-client";

// SEO metadata canonical (ko). i18n page content is rendered client-side.
export const metadata: Metadata = {
  title: "About — TRINITY ACADEMY",
  description:
    "OMNIBUS OMNIA — 트리니티 아카데미의 교육 철학과 연혁을 소개합니다.",
};

export default function AboutPage() {
  return <AboutPageClient />;
}
