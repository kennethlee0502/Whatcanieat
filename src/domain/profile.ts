import { z } from "zod";

import { domainIdentifierSchema } from "@/domain/primitives";

const labelSchema = z.string().trim().min(1).max(120);

export const allergySeveritySchema = z.enum([
  "mild",
  "moderate",
  "severe",
]);

export const allergyProfileSchema = z
  .object({
    allergenId: domainIdentifierSchema,
    label: labelSchema,
    severity: allergySeveritySchema.optional(),
  })
  .strict();

export const pregnancyProfileSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("notPregnant") }).strict(),
  z
    .object({
      status: z.literal("pregnant"),
      week: z.number().int().min(1).max(42).optional(),
    })
    .strict(),
]);

export const dietPreferenceSchema = z.enum(["none", "vegetarian", "vegan"]);

const heightSchema = z
  .object({
    value: z.number().positive().finite(),
    unit: z.enum(["centimeters", "inches"]),
  })
  .strict();

const weightSchema = z
  .object({
    value: z.number().positive().finite(),
    unit: z.enum(["kilograms", "pounds"]),
  })
  .strict();

export const bodyMeasurementsSchema = z
  .object({
    height: heightSchema.optional(),
    weight: weightSchema.optional(),
    bmi: z.number().positive().finite().optional(),
  })
  .strict();

export const userProfileSchema = z
  .object({
    pregnancy: pregnancyProfileSchema,
    allergies: z.array(allergyProfileSchema).max(20),
    highBloodPressure: z.boolean(),
    diet: dietPreferenceSchema,
    measurements: bodyMeasurementsSchema.optional(),
  })
  .strict();

const analysisPregnancySchema = z
  .object({
    week: z.number().int().min(1).max(42).optional(),
  })
  .strict();

const analysisAllergySchema = z
  .object({
    allergenId: domainIdentifierSchema,
    severity: allergySeveritySchema.optional(),
  })
  .strict();

export const analysisProfileContextSchema = z
  .object({
    pregnancy: analysisPregnancySchema.optional(),
    allergies: z.array(analysisAllergySchema).max(20).optional(),
    highBloodPressure: z.literal(true).optional(),
    diet: z.enum(["vegetarian", "vegan"]).optional(),
  })
  .strict();

export type AllergySeverity = z.infer<typeof allergySeveritySchema>;
export type AllergyProfile = z.infer<typeof allergyProfileSchema>;
export type PregnancyProfile = z.infer<typeof pregnancyProfileSchema>;
export type DietPreference = z.infer<typeof dietPreferenceSchema>;
export type BodyMeasurements = z.infer<typeof bodyMeasurementsSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type AnalysisProfileContext = z.infer<
  typeof analysisProfileContextSchema
>;
