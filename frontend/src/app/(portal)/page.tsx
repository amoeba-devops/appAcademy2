import { HeroSection } from "@/components/portal/home/hero-section";
import { ResultsBand, ResultsStatsBand } from "@/components/portal/home/results-band";
import { CampusBand } from "@/components/portal/home/campus-band";
import { PillarSection } from "@/components/portal/home/pillar-section";
import { ProcessTimeline } from "@/components/portal/home/process-timeline";
import { ClosingCta } from "@/components/portal/home/closing-cta";

export default function PortalHome() {
  return (
    <>
      <HeroSection />
      <ResultsBand />
      <CampusBand />
      <PillarSection />
      <ResultsStatsBand />
      <ProcessTimeline />
      <ClosingCta />
    </>
  );
}
