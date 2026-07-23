import type {
  ExtractedFoodFacts,
  IngredientEvidence,
  NutritionSignals,
  PreparationFacts,
} from "@/domain/food";
import {
  FOOD_FACTS_SCHEMA_VERSION,
  extractedFoodFactsSchema,
} from "@/domain/food";
import type { AllergyProfile } from "@/domain/profile";
import type { RawExtraction } from "@/schemas/extraction";

export type CanonicalAliases = Readonly<Record<string, string>>;

export const INGREDIENT_ALIASES: CanonicalAliases = {
  eggs: "egg",
  groundnut: "peanut",
  groundnuts: "peanut",
  peanuts: "peanut",
  "sesame-seed": "sesame",
  "sesame-seeds": "sesame",
};

export const ALLERGEN_ALIASES: CanonicalAliases = INGREDIENT_ALIASES;

export const canonicalizeTerm = (value: string): string =>
  value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeAliasMap = (aliases: CanonicalAliases) =>
  Object.fromEntries(
    Object.entries(aliases).map(([alias, canonical]) => [
      canonicalizeTerm(alias),
      canonicalizeTerm(canonical),
    ]),
  );

export const resolveCanonicalTerm = (
  value: string,
  aliases: CanonicalAliases = {},
): string => {
  const normalizedAliases = normalizeAliasMap(aliases);
  let canonicalTerm = canonicalizeTerm(value);
  const visitedTerms = new Map<string, number>();
  const resolutionPath: string[] = [];

  while (canonicalTerm && normalizedAliases[canonicalTerm]) {
    const cycleStartIndex = visitedTerms.get(canonicalTerm);

    if (cycleStartIndex !== undefined) {
      return [...resolutionPath.slice(cycleStartIndex)].sort()[0];
    }

    visitedTerms.set(canonicalTerm, resolutionPath.length);
    resolutionPath.push(canonicalTerm);
    canonicalTerm = normalizedAliases[canonicalTerm];
  }

  return canonicalTerm;
};

export const normalizeIngredientEvidence = (
  ingredient: IngredientEvidence,
  aliases: CanonicalAliases = INGREDIENT_ALIASES,
): IngredientEvidence => ({
  ...ingredient,
  ingredientId:
    resolveCanonicalTerm(ingredient.ingredientId, aliases) ||
    ingredient.ingredientId,
  evidenceIds: [...ingredient.evidenceIds],
});

export const normalizeAllergyProfile = (
  allergy: AllergyProfile,
  aliases: CanonicalAliases = ALLERGEN_ALIASES,
): AllergyProfile => ({
  ...allergy,
  allergenId:
    resolveCanonicalTerm(allergy.allergenId, aliases) || allergy.allergenId,
});

export const normalizePreparationFacts = (
  preparation: PreparationFacts,
): PreparationFacts => ({
  ...preparation,
  internalTemperature: preparation.internalTemperature
    ? {
        ...preparation.internalTemperature,
        evidenceIds: [...preparation.internalTemperature.evidenceIds],
      }
    : undefined,
  evidenceIds: [...preparation.evidenceIds],
});

export const normalizeNutritionSignals = (
  nutrition: NutritionSignals,
): NutritionSignals => ({
  ...nutrition,
  evidenceIds: [...nutrition.evidenceIds],
});

export const normalizeExtractedFoodFacts = (
  facts: ExtractedFoodFacts,
  ingredientAliases: CanonicalAliases = INGREDIENT_ALIASES,
): ExtractedFoodFacts => ({
  ...facts,
  foodCandidates: facts.foodCandidates.map((candidate) => ({
    ...candidate,
    canonicalName: candidate.canonicalName
      ? resolveCanonicalTerm(candidate.canonicalName)
      : undefined,
    evidenceIds: [...candidate.evidenceIds],
  })),
  ingredients: facts.ingredients.map((ingredient) =>
    normalizeIngredientEvidence(ingredient, ingredientAliases),
  ),
  preparation: normalizePreparationFacts(facts.preparation),
  nutrition: normalizeNutritionSignals(facts.nutrition),
  labels: facts.labels.map((label) => ({
    ...label,
    evidenceIds: [...label.evidenceIds],
  })),
  evidence: facts.evidence.map((evidence) => ({ ...evidence })),
  uncertainties: facts.uncertainties.map((uncertainty) => ({
    ...uncertainty,
    relatedFactIds: [...uncertainty.relatedFactIds],
  })),
  contradictions: facts.contradictions.map((contradiction) => ({
    ...contradiction,
    competingClaims: contradiction.competingClaims.map((claim) => ({
      ...claim,
      evidenceIds: [...claim.evidenceIds],
    })),
  })),
});

export const normalizeRawExtraction = (
  extraction: RawExtraction,
): ExtractedFoodFacts => {
  const facts: ExtractedFoodFacts = {
    schemaVersion: FOOD_FACTS_SCHEMA_VERSION,
    imageSuitability: extraction.imageSuitability,
    foodCandidates: extraction.foodCandidates.map((candidate) => {
      const canonicalName = canonicalizeTerm(candidate.displayName);

      return {
        ...candidate,
        canonicalName: canonicalName || undefined,
        evidenceIds: [...candidate.evidenceIds],
      };
    }),
    primaryFoodId: extraction.primaryFoodReference,
    ingredients: extraction.ingredientClaims.map((ingredient) => ({
      id: ingredient.id,
      ingredientId:
        canonicalizeTerm(ingredient.name) || ingredient.name,
      displayName: ingredient.name,
      presence: ingredient.presence,
      evidenceIds: [...ingredient.evidenceIds],
    })),
    preparation: {
      pasteurization: extraction.preparation.pasteurization,
      doneness: extraction.preparation.doneness,
      rawAnimalProduct: extraction.preparation.rawAnimalProduct,
      cookingMethod: extraction.preparation.cookingMethod ?? undefined,
      internalTemperature: extraction.preparation.internalTemperature
        ? {
            ...extraction.preparation.internalTemperature,
            evidenceIds: [
              ...extraction.preparation.internalTemperature.evidenceIds,
            ],
          }
        : undefined,
      evidenceIds: [...extraction.preparation.evidenceIds],
    },
    nutrition: {
      sodiumLevel: extraction.nutrition.sodiumLevel,
      sodiumMilligrams:
        extraction.nutrition.sodiumMilligrams ?? undefined,
      servingDescription:
        extraction.nutrition.servingDescription ?? undefined,
      highlyProcessed: extraction.nutrition.highlyProcessed,
      evidenceIds: [...extraction.nutrition.evidenceIds],
    },
    labels: extraction.labels.map((label) => ({
      ...label,
      evidenceIds: [...label.evidenceIds],
    })),
    evidence: extraction.evidence.map((evidence) => ({ ...evidence })),
    uncertainties: extraction.uncertainties.map((uncertainty) => ({
      ...uncertainty,
      relatedFactIds: [...uncertainty.relatedFactIds],
    })),
    contradictions: extraction.contradictions.map((contradiction) => ({
      ...contradiction,
      competingClaims: contradiction.competingClaims.map((claim) => ({
        ...claim,
        evidenceIds: [...claim.evidenceIds],
      })),
    })),
    extractionConfidence: extraction.extractionConfidence,
  };

  return extractedFoodFactsSchema.parse(
    normalizeExtractedFoodFacts(facts),
  );
};
