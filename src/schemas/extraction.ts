import { z } from "zod";

import {
  donenessStatusSchema,
  evidenceSourceSchema,
  evidenceStrengthSchema,
  factContradictionSchema,
  imageSuitabilitySchema,
  ingredientPresenceSchema,
  labelEvidenceSchema,
  pasteurizationStatusSchema,
  sodiumLevelSchema,
  ternaryFactSchema,
  uncertaintySchema,
} from "@/domain/food";
import {
  confidenceLevelSchema,
  domainIdentifierSchema,
  evidenceIdsSchema,
} from "@/domain/primitives";

export const RAW_EXTRACTION_SCHEMA_VERSION = 1 as const;

const rawEvidenceSourceSchema = evidenceSourceSchema.exclude([
  "userProvided",
]);

export const rawExtractionEvidenceSchema = z
  .object({
    id: domainIdentifierSchema,
    source: rawEvidenceSourceSchema,
    strength: evidenceStrengthSchema,
    summary: z.string().trim().min(1).max(240),
  })
  .strict();

export const rawFoodCandidateSchema = z
  .object({
    id: domainIdentifierSchema,
    displayName: z.string().trim().min(1).max(160),
    identityConfidence: confidenceLevelSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const rawIngredientClaimSchema = z
  .object({
    id: domainIdentifierSchema,
    name: z.string().trim().min(1).max(160),
    presence: ingredientPresenceSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const rawPreparationFactsSchema = z
  .object({
    pasteurization: pasteurizationStatusSchema,
    doneness: donenessStatusSchema,
    rawAnimalProduct: ternaryFactSchema,
    cookingMethod: z.string().trim().min(1).max(120).nullable(),
    internalTemperature: z
      .object({
        value: z.number().finite(),
        unit: z.enum(["celsius", "fahrenheit"]),
        evidenceIds: evidenceIdsSchema,
      })
      .strict()
      .nullable(),
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const rawNutritionSignalsSchema = z
  .object({
    sodiumLevel: sodiumLevelSchema,
    sodiumMilligrams: z.number().nonnegative().finite().nullable(),
    servingDescription: z.string().trim().min(1).max(160).nullable(),
    highlyProcessed: ternaryFactSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

const knownContradictableFactPaths = new Map<
  string,
  (extraction: RawExtraction) => string
>([
  [
    "preparation.pasteurization",
    (extraction) => extraction.preparation.pasteurization,
  ],
  ["preparation.doneness", (extraction) => extraction.preparation.doneness],
  [
    "preparation.rawAnimalProduct",
    (extraction) => extraction.preparation.rawAnimalProduct,
  ],
  ["nutrition.sodiumLevel", (extraction) => extraction.nutrition.sodiumLevel],
  [
    "nutrition.highlyProcessed",
    (extraction) => extraction.nutrition.highlyProcessed,
  ],
]);

const resolveContradictedFactValue = (
  extraction: RawExtraction,
  factPath: string,
): string | undefined => {
  const knownFactValue = knownContradictableFactPaths.get(factPath)?.(
    extraction,
  );
  if (knownFactValue !== undefined) {
    return knownFactValue;
  }

  const ingredientPathMatch = /^ingredientClaims\.([^.]+)\.presence$/.exec(
    factPath,
  );
  if (!ingredientPathMatch) {
    return undefined;
  }

  return extraction.ingredientClaims.find(
    ({ id }) => id === ingredientPathMatch[1],
  )?.presence;
};

const addUniqueIdIssues = (
  values: readonly { id: string }[],
  path: string,
  refinementContext: z.RefinementCtx,
) => {
  const seenIds = new Set<string>();

  values.forEach(({ id }, index) => {
    if (seenIds.has(id)) {
      refinementContext.addIssue({
        code: "custom",
        message: "Identifiers must be unique within the extraction.",
        path: [path, index, "id"],
      });
    }
    seenIds.add(id);
  });
};

const addEvidenceReferenceIssues = (
  evidenceIds: readonly string[],
  existingEvidenceIds: ReadonlySet<string>,
  path: (string | number)[],
  refinementContext: z.RefinementCtx,
) => {
  evidenceIds.forEach((evidenceId, index) => {
    if (!existingEvidenceIds.has(evidenceId)) {
      refinementContext.addIssue({
        code: "custom",
        message: "Evidence references must resolve within the extraction.",
        path: [...path, index],
      });
    }
  });
};

export const rawExtractionStructuredOutputSchema = z
  .object({
    schemaVersion: z.literal(RAW_EXTRACTION_SCHEMA_VERSION),
    imageSuitability: imageSuitabilitySchema,
    foodCandidates: z.array(rawFoodCandidateSchema).max(10),
    primaryFoodReference: domainIdentifierSchema.nullable(),
    ingredientClaims: z.array(rawIngredientClaimSchema).max(100),
    preparation: rawPreparationFactsSchema,
    nutrition: rawNutritionSignalsSchema,
    labels: z.array(labelEvidenceSchema).max(20),
    evidence: z.array(rawExtractionEvidenceSchema).max(200),
    uncertainties: z.array(uncertaintySchema).max(100),
    contradictions: z.array(factContradictionSchema).max(50),
    extractionConfidence: confidenceLevelSchema,
  })
  .strict();

export const rawExtractionSchema = rawExtractionStructuredOutputSchema.superRefine(
  (extraction, refinementContext) => {
    addUniqueIdIssues(
      [
        ...extraction.foodCandidates,
        ...extraction.ingredientClaims,
        ...extraction.labels,
        ...extraction.evidence,
        ...extraction.uncertainties,
        ...extraction.contradictions,
      ],
      "identifiers",
      refinementContext,
    );

    const candidateIds = new Set(
      extraction.foodCandidates.map(({ id }) => id),
    );
    const evidenceIds = new Set(extraction.evidence.map(({ id }) => id));
    const factIds = new Set([
      ...candidateIds,
      ...extraction.ingredientClaims.map(({ id }) => id),
      ...extraction.labels.map(({ id }) => id),
    ]);

    if (
      extraction.primaryFoodReference !== null &&
      !candidateIds.has(extraction.primaryFoodReference)
    ) {
      refinementContext.addIssue({
        code: "custom",
        message: "The primary food reference must identify a food candidate.",
        path: ["primaryFoodReference"],
      });
    }

    if (
      extraction.imageSuitability === "foodDetected" &&
      (extraction.foodCandidates.length === 0 ||
        extraction.primaryFoodReference === null)
    ) {
      refinementContext.addIssue({
        code: "custom",
        message:
          "A suitable food image requires candidates and a primary reference.",
        path: ["foodCandidates"],
      });
    }

    if (
      extraction.imageSuitability !== "foodDetected" &&
      extraction.primaryFoodReference !== null
    ) {
      refinementContext.addIssue({
        code: "custom",
        message:
          "An unsuitable image cannot declare a primary food reference.",
        path: ["primaryFoodReference"],
      });
    }

    extraction.foodCandidates.forEach((candidate, index) => {
      addEvidenceReferenceIssues(
        candidate.evidenceIds,
        evidenceIds,
        ["foodCandidates", index, "evidenceIds"],
        refinementContext,
      );
    });
    extraction.ingredientClaims.forEach((ingredient, index) => {
      addEvidenceReferenceIssues(
        ingredient.evidenceIds,
        evidenceIds,
        ["ingredientClaims", index, "evidenceIds"],
        refinementContext,
      );
    });
    addEvidenceReferenceIssues(
      extraction.preparation.evidenceIds,
      evidenceIds,
      ["preparation", "evidenceIds"],
      refinementContext,
    );
    if (extraction.preparation.internalTemperature) {
      addEvidenceReferenceIssues(
        extraction.preparation.internalTemperature.evidenceIds,
        evidenceIds,
        ["preparation", "internalTemperature", "evidenceIds"],
        refinementContext,
      );
    }
    addEvidenceReferenceIssues(
      extraction.nutrition.evidenceIds,
      evidenceIds,
      ["nutrition", "evidenceIds"],
      refinementContext,
    );
    extraction.labels.forEach((label, index) => {
      addEvidenceReferenceIssues(
        label.evidenceIds,
        evidenceIds,
        ["labels", index, "evidenceIds"],
        refinementContext,
      );
    });
    extraction.uncertainties.forEach((uncertainty, index) => {
      uncertainty.relatedFactIds.forEach((factId, factIndex) => {
        if (!factIds.has(factId)) {
          refinementContext.addIssue({
            code: "custom",
            message: "Uncertainty references must identify extracted facts.",
            path: ["uncertainties", index, "relatedFactIds", factIndex],
          });
        }
      });
    });
    extraction.contradictions.forEach((contradiction, index) => {
      contradiction.competingClaims.forEach((claim, claimIndex) => {
        addEvidenceReferenceIssues(
          claim.evidenceIds,
          evidenceIds,
          [
            "contradictions",
            index,
            "competingClaims",
            claimIndex,
            "evidenceIds",
          ],
          refinementContext,
        );
      });

      const resolvedValue = resolveContradictedFactValue(
        extraction,
        contradiction.factPath,
      );
      if (resolvedValue === undefined) {
        refinementContext.addIssue({
          code: "custom",
          message:
            "Contradictions must reference a supported extracted fact path.",
          path: ["contradictions", index, "factPath"],
        });
        return;
      }

      if (
        resolvedValue !== "unknown" &&
        resolvedValue !== "notApplicable"
      ) {
        refinementContext.addIssue({
          code: "custom",
          message:
            "A contradicted fact must remain unknown rather than be silently resolved.",
          path: ["contradictions", index, "factPath"],
        });
      }
    });
  },
);

export type RawExtractionEvidence = z.infer<
  typeof rawExtractionEvidenceSchema
>;
export type RawFoodCandidate = z.infer<typeof rawFoodCandidateSchema>;
export type RawIngredientClaim = z.infer<typeof rawIngredientClaimSchema>;
export type RawExtraction = z.infer<
  typeof rawExtractionStructuredOutputSchema
>;
