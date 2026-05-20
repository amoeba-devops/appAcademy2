import { DualTabSection } from '../components/home/dual-tab-section';
import { TypingHero } from '../components/home/typing-hero';
import { CourseMatrix } from '../components/home/course-matrix';
import { MapTestIntro } from '../components/home/map-test-intro';
import { StatsSection } from '../components/home/stats-section';
import { FeatureSection } from '../components/home/feature-section';
import { ValuePropositionHeading } from '../components/home/value-proposition-heading';
import { TpiFeatures } from '../components/home/tpi-features';
import { ProcessSection } from '../components/home/process-section';
import { EquipSlider } from '../components/home/equip-slider';
import { ResultsSection } from '../components/home/results-section';
import { ContactCtaBanner } from '../components/home/contact-cta-banner';

// Section order mirrors live www.tpi.co.kr — REQ-260520 v3.2.
// Deprecated (files preserved for rollback, import 0):
//   HeroSection, MapTestImportance, EnrollmentProcess, ReviewsSlider,
//   BottomCtaSection, AmaSignInBanner.

export function PortalHomePage() {
  return (
    <>
      <DualTabSection />
      <TypingHero />
      <CourseMatrix />
      <MapTestIntro />
      <StatsSection />
      <FeatureSection />
      <ValuePropositionHeading />
      <TpiFeatures />
      <ProcessSection />
      <EquipSlider />
      <ResultsSection />
      <ContactCtaBanner />
    </>
  );
}
