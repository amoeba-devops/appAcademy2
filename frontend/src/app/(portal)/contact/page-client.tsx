"use client";

import { useTranslation } from "react-i18next";
import { FormHero } from "@/components/portal/forms/form-hero";
import { ConsultationForm } from "@/components/portal/forms/consultation-form";
import { ContactDetails } from "@/components/portal/forms/contact-details";

export function ContactPageClient() {
  const { t } = useTranslation("portal");
  return (
    <>
      <FormHero
        eyebrow={t("contact.hero-eyebrow")}
        title={
          <>
            {t("contact.hero-title-line1")}
            <br />
            {t("contact.hero-title-line2")}
          </>
        }
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <ConsultationForm />
      </section>
      <ContactDetails />
    </>
  );
}
