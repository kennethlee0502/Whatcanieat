import { z } from "zod";

import {
  confidenceLevelSchema,
  domainIdentifierSchema,
  evidenceIdsSchema,
  shortTextSchema,
} from "@/domain/primitives";

export const FOOD_FACTS_SCHEMA_VERSION = 1 as const;

export const evidenceSourceSchema = z.enum([
  "visibleInImage",
  "readableOnLabel",
  "conventionalInference",
  "userProvided",
]);

export const evidenceStrengthSchema = z.enum([
  "confirmed",
  "likely",
  "possible",
  "unknown",
]);

export const evidenceItemSchema = z
  .object({
    id: domainIdentifierSchema,
    source: evidenceSourceSchema,
    strength: evidenceStrengthSchema,
    summary: shortTextSchema,
  })
  .strict();

export const foodIdentitySchema = z
  .object({
    id: domainIdentifierSchema,
    displayName: z.string().trim().min(1).max(160),
    canonicalName: domainIdentifierSchema.optional(),
    identityConfidence: confidenceLevelSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const ingredientPresenceSchema = z.enum([
  "confirmed",
  "likely",
  "possible",
  "absent",
  "unknown",
]);

export const ingredientEvidenceSchema = z
  .object({
    id: domainIdentifierSchema,
    ingredientId: domainIdentifierSchema,
    displayName: z.string().trim().min(1).max(160),
    presence: ingredientPresenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const pasteurizationStatusSchema = z.enum([
  "pasteurized",
  "unpasteurized",
  "unknown",
  "notApplicable",
]);

export const donenessStatusSchema = z.enum([
  "raw",
  "undercooked",
  "fullyCooked",
  "unknown",
  "notApplicable",
]);

export const ternaryFactSchema = z.enum(["yes", "no", "unknown"]);

export const preparationFactsSchema = z
  .object({
    pasteurization: pasteurizationStatusSchema,
    doneness: donenessStatusSchema,
    rawAnimalProduct: ternaryFactSchema,
    cookingMethod: z.string().trim().min(1).max(120).optional(),
    internalTemperature: z
      .object({
        value: z.number().finite(),
        unit: z.enum(["celsius", "fahrenheit"]),
        evidenceIds: evidenceIdsSchema,
      })
      .strict()
      .optional(),
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const sodiumLevelSchema = z.enum([
  "low",
  "moderate",
  "high",
  "unknown",
]);

export const nutritionSignalsSchema = z
  .object({
    sodiumLevel: sodiumLevelSchema,
    sodiumMilligrams: z.number().nonnegative().finite().optional(),
    servingDescription: z.string().trim().min(1).max(160).optional(),
    highlyProcessed: ternaryFactSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

const readableLabelEvidenceSchema = z
  .object({
    id: domainIdentifierSchema,
    text: z.string().trim().min(1).max(2_000),
    legibility: z.enum(["readable", "partial"]),
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

const unreadableLabelEvidenceSchema = z
  .object({
    id: domainIdentifierSchema,
    legibility: z.literal("unreadable"),
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const labelEvidenceSchema = z.union([
  readableLabelEvidenceSchema,
  unreadableLabelEvidenceSchema,
]);

export const uncertaintySchema = z
  .object({
    id: domainIdentifierSchema,
    subject: shortTextSchema,
    kind: z.enum([
      "identity",
      "ingredient",
      "preparation",
      "labelReadability",
      "nutrition",
      "contradiction",
      "other",
    ]),
    description: shortTextSchema,
    safetyRelevance: z.enum([
      "consequential",
      "relevant",
      "informational",
    ]),
    resolvableByUser: z.boolean(),
    relatedFactIds: z.array(domainIdentifierSchema).max(20),
  })
  .strict();

const contradictoryClaimSchema = z
  .object({
    value: z.string().trim().min(1).max(160),
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const factContradictionSchema = z
  .object({
    id: domainIdentifierSchema,
    factPath: z.string().trim().min(1).max(160),
    description: shortTextSchema,
    competingClaims: z.array(contradictoryClaimSchema).min(2).max(10),
  })
  .strict()
  .superRefine((contradiction, refinementContext) => {
    const distinctValues = new Set(
      contradiction.competingClaims.map((claim) => claim.value),
    );

    if (distinctValues.size < 2) {
      refinementContext.addIssue({
        code: "custom",
        message: "Contradictions require at least two distinct claims.",
        path: ["competingClaims"],
      });
    }
  });

export const extractedFoodFactsSchema = z
  .object({
    schemaVersion: z.literal(FOOD_FACTS_SCHEMA_VERSION),
    imageSuitability: z.enum([
      "foodDetected",
      "noFoodDetected",
      "insufficientImage",
    ]),
    foodCandidates: z.array(foodIdentitySchema).max(10),
    primaryFoodId: domainIdentifierSchema.nullable(),
    ingredients: z.array(ingredientEvidenceSchema).max(100),
    preparation: preparationFactsSchema,
    nutrition: nutritionSignalsSchema,
    labels: z.array(labelEvidenceSchema).max(20),
    evidence: z.array(evidenceItemSchema).max(200),
    uncertainties: z.array(uncertaintySchema).max(100),
    contradictions: z.array(factContradictionSchema).max(50),
    extractionConfidence: confidenceLevelSchema,
  })
  .strict();

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type FoodIdentity = z.infer<typeof foodIdentitySchema>;
export type IngredientEvidence = z.infer<typeof ingredientEvidenceSchema>;
export type PreparationFacts = z.infer<typeof preparationFactsSchema>;
export type NutritionSignals = z.infer<typeof nutritionSignalsSchema>;
export type LabelEvidence = z.infer<typeof labelEvidenceSchema>;
export type Uncertainty = z.infer<typeof uncertaintySchema>;
export type FactContradiction = z.infer<typeof factContradictionSchema>;
export type ExtractedFoodFacts = z.infer<typeof extractedFoodFactsSchema>;
