import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_KR, Noto_Serif_KR, Noto_Sans_SC } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-sans-kr",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  variable: "--font-noto-serif-kr",
  weight: ["500", "600", "700"],
  display: "swap",
});

// Simplified Chinese fallback for zh-CN locale (i18n migration)
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0E1E3A',
};

export const metadata: Metadata = {
  title: {
    template: "%s | Trinity Academy",
    default: "Trinity Academy — NWEA MAP TEST 공식 기관",
  },
  description:
    "트리니티 아카데미 · NWEA MAP TEST 공식 기관. 2020년 설립 이후 230명 이상의 국제학교 학생을 배출한 검증된 국제학교 입학 준비 기관.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${inter.variable} ${notoSansKR.variable} ${notoSerifKR.variable} ${notoSansSC.variable} font-body antialiased`}
      >
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
