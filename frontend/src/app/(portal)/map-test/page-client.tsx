"use client";

import { useTranslation } from "react-i18next";
import { FormHero } from "@/components/portal/forms/form-hero";
import { MapTestForm } from "@/components/portal/forms/map-test-form";
import { ContactDetails } from "@/components/portal/forms/contact-details";

export function MapTestPageClient() {
  const { t } = useTranslation("portal");
  return (
    <>
      <FormHero
        eyebrow="NWEA MAP TEST"
        title={
          <>
            {t("map-test.hero-title-line1")}
            <br />
            {t("map-test.hero-title-line2")}
          </>
        }
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <MapTestForm />
      </section>
      <ContactDetails />
    </>
  );
}
