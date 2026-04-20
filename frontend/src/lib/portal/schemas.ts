import { z } from "zod";
import { CONSULTATION_TYPES, GRADE_OPTIONS } from "./site-content";

// Messages use the `validation` namespace (see src/i18n/zod-error-map.ts).
const PHONE_REGEX = /^0\d{1,2}-\d{3,4}-\d{4}$/;

const CONSULTATION_TYPE_IDS = CONSULTATION_TYPES.map((t) => t.id) as [
  string,
  ...string[],
];

export const consultationSchema = z.object({
  types: z
    .array(z.enum(CONSULTATION_TYPE_IDS))
    .min(1, "validation.consultation-type-required"),
  studentName: z.string().min(1, "validation.student-name-required"),
  grade: z.string().min(1, "validation.grade-required"),
  phone: z.string().regex(PHONE_REGEX, "validation.phone-invalid"),
  privacyAgreed: z
    .boolean()
    .refine((v) => v === true, { message: "validation.privacy-required" }),
});
export type ConsultationInput = z.infer<typeof consultationSchema>;

const GRADE_VALUES = GRADE_OPTIONS as unknown as [string, ...string[]];

export const mapTestSchema = z.object({
  studentNameKo: z.string().min(1, "validation.student-name-ko-required"),
  studentNameEn: z.string().min(1, "validation.student-name-en-required"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "validation.birth-date-invalid"),
  grade: z.enum(GRADE_VALUES).refine((v) => v.length > 0, {
    message: "validation.grade-select-required",
  }),
  gender: z.enum(["M", "F"] as [string, ...string[]]),
  phone: z.string().regex(PHONE_REGEX, "validation.phone-invalid"),
  parentEmail: z.string().email("validation.email-invalid"),
  testLocation: z.string().min(1, "validation.test-location-required"),
  privacyAgreed: z
    .boolean()
    .refine((v) => v === true, { message: "validation.privacy-required" }),
});
export type MapTestInput = z.infer<typeof mapTestSchema>;

export const consultationApiSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("GENERAL_INQUIRY"), payload: consultationSchema }),
  z.object({ type: z.literal("MAP_TEST_INQUIRY"), payload: mapTestSchema }),
]);
export type ConsultationApiInput = z.infer<typeof consultationApiSchema>;
