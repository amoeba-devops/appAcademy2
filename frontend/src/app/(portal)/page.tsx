import { HeroSection } from "@/components/portal/home/hero-section";
import { AmaSignInBanner } from "@/components/portal/home/ama-signin-banner";
import { MapTestIntro } from "@/components/portal/home/map-test-intro";
import { MapTestImportance } from "@/components/portal/home/map-test-importance";
import { TpiFeatures } from "@/components/portal/home/tpi-features";
import { EnrollmentProcess } from "@/components/portal/home/enrollment-process";
import { ReviewsSlider } from "@/components/portal/home/reviews-slider";
import { BottomCtaSection } from "@/components/portal/home/bottom-cta-section";

export default function PortalHome() {
  return (
    <>
      <HeroSection />
      <AmaSignInBanner />
      <MapTestIntro />
      <MapTestImportance />
      <TpiFeatures />
      <EnrollmentProcess />
      <ReviewsSlider />
      <BottomCtaSection />
    </>
  );
}
