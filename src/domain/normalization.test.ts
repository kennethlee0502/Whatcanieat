import { describe, expect, it } from "vitest";

import type { ExtractedFoodFacts } from "@/domain/food";
import {
  canonicalizeTerm,
  normalizeAllergyProfile,
  normalizeExtractedFoodFacts,
  normalizeRawExtraction,
  resolveCanonicalTerm,
} from "@/domain/normalization";
import {
  contradictoryRawExtractionFixture,
  validRawExtractionFixture,
} from "@/test-fixtures/extraction";

const facts: ExtractedFoodFacts = {
  schemaVersion: 1,
  imageSuitability: "foodDetected",
  foodCandidates: [
    {
      id: "food-1",
      displayName: "Groundnut stew",
      canonicalName: "Groundnut Stew",
      identityConfidence: "low",
      evidenceIds: ["evidence-visible"],
    },
  ],
  primaryFoodId: "food-1",
  ingredients: [
    {
      id: "ingredient-claim-1",
      ingredientId: "Groundnuts",
      displayName: "Groundnuts",
      presence: "possible",
      evidenceIds: ["evidence-label"],
    },
  ],
  preparation: {
    pasteurization: "unknown",
    doneness: "unknown",
    rawAnimalProduct: "unknown",
    cookingMethod: "Pan fried",
    evidenceIds: ["evidence-visible"],
  },
  nutrition: {
    sodiumLevel: "unknown",
    servingDescription: "Per package",
    highlyProcessed: "unknown",
    evidenceIds: ["evidence-label"],
  },
  labels: [
    {
      id: "label-1",
      text: "May contain groundnuts",
      legibility: "partial",
      evidenceIds: ["evidence-label"],
    },
  ],
  evidence: [
    {
      id: "evidence-visible",
      source: "visibleInImage",
      strength: "possible",
      summary: "A prepared dish is visible.",
    },
    {
      id: "evidence-label",
      source: "readableOnLabel",
      strength: "unknown",
      summary: "Part of a label is readable.",
    },
  ],
  uncertainties: [
    {
      id: "uncertainty-1",
      subject: "Groundnuts",
      kind: "ingredient",
      description: "The partial label does not confirm the ingredient.",
      safetyRelevance: "consequential",
      resolvableByUser: true,
      relatedFactIds: ["ingredient-claim-1"],
    },
  ],
  contradictions: [
    {
      id: "contradiction-1",
      factPath: "ingredients.peanut",
      description: "Visible and label evidence conflict.",
      competingClaims: [
        { value: "possible", evidenceIds: ["evidence-visible"] },
        { value: "unknown", evidenceIds: ["evidence-label"] },
      ],
    },
  ],
  extractionConfidence: "low",
};

describe("canonical normalization", () => {
  it("converts validated raw extraction into normalized domain facts", () => {
    const normalized = normalizeRawExtraction({
      ...validRawExtractionFixture,
      foodCandidates: [
        {
          ...validRawExtractionFixture.foodCandidates[0],
          displayName: "Groundnut Stew",
        },
      ],
      ingredientClaims: [
        {
          ...validRawExtractionFixture.ingredientClaims[0],
          name: "Groundnuts",
        },
      ],
    });

    expect(normalized).toMatchObject({
      schemaVersion: 1,
      primaryFoodId: "food-1",
      foodCandidates: [{ canonicalName: "groundnut-stew" }],
      ingredients: [
        {
          ingredientId: "peanut",
          displayName: "Groundnuts",
          presence: "confirmed",
        },
      ],
      preparation: {
        cookingMethod: undefined,
        internalTemperature: undefined,
      },
      nutrition: {
        sodiumMilligrams: undefined,
        servingDescription: undefined,
      },
    });
  });

  it("preserves raw evidence, uncertainty, contradictions, and confidence", () => {
    const normalized = normalizeRawExtraction(
      contradictoryRawExtractionFixture,
    );

    expect(normalized.evidence).toEqual(
      contradictoryRawExtractionFixture.evidence,
    );
    expect(normalized.uncertainties).toEqual(
      contradictoryRawExtractionFixture.uncertainties,
    );
    expect(normalized.contradictions).toEqual(
      contradictoryRawExtractionFixture.contradictions,
    );
    expect(normalized.extractionConfidence).toBe(
      contradictoryRawExtractionFixture.extractionConfidence,
    );
  });

  it("canonicalizes case, spacing, punctuation, and Unicode consistently", () => {
    expect(canonicalizeTerm("  Sesame Seeds  ")).toBe("sesame-seeds");
    expect(canonicalizeTerm("Chef’s Sauce")).toBe("chefs-sauce");
  });

  it("keeps normal acyclic alias resolution unchanged", () => {
    expect(
      resolveCanonicalTerm("Groundnuts", {
        groundnuts: "groundnut",
        groundnut: "peanut",
      }),
    ).toBe("peanut");
  });

  it("resolves every member of a two-node cycle to one representative", () => {
    const aliases = { first: "second", second: "first" };

    expect(resolveCanonicalTerm("first", aliases)).toBe("first");
    expect(resolveCanonicalTerm("second", aliases)).toBe("first");
  });

  it("resolves every member of a longer cycle to one representative", () => {
    const aliases = {
      zulu: "mango",
      mango: "alpha",
      alpha: "zulu",
    };

    expect(resolveCanonicalTerm("zulu", aliases)).toBe("alpha");
    expect(resolveCanonicalTerm("mango", aliases)).toBe("alpha");
    expect(resolveCanonicalTerm("alpha", aliases)).toBe("alpha");
  });

  it("resolves a chain entering a cycle to the cycle representative", () => {
    const aliases = {
      entry: "middle",
      middle: "zulu",
      zulu: "alpha",
      alpha: "zulu",
    };

    expect(resolveCanonicalTerm("entry", aliases)).toBe("alpha");
    expect(resolveCanonicalTerm("middle", aliases)).toBe("alpha");
    expect(resolveCanonicalTerm("zulu", aliases)).toBe("alpha");
  });

  it("keeps cycle resolution idempotent", () => {
    const aliases = {
      first: "second",
      second: "first",
    };
    const normalized = resolveCanonicalTerm("second", aliases);

    expect(resolveCanonicalTerm(normalized, aliases)).toBe(normalized);
  });

  it("normalizes ingredient and allergen identifiers while preserving labels", () => {
    const normalizedFacts = normalizeExtractedFoodFacts(facts);
    const normalizedAllergy = normalizeAllergyProfile({
      allergenId: "Peanuts",
      label: "My peanut allergy",
      severity: "severe",
    });

    expect(normalizedFacts.ingredients[0]).toMatchObject({
      ingredientId: "peanut",
      displayName: "Groundnuts",
      presence: "possible",
    });
    expect(normalizedAllergy).toEqual({
      allergenId: "peanut",
      label: "My peanut allergy",
      severity: "severe",
    });
  });

  it("does not increase certainty or alter evidence provenance", () => {
    const normalized = normalizeExtractedFoodFacts(facts);

    expect(normalized.extractionConfidence).toBe(facts.extractionConfidence);
    expect(normalized.foodCandidates[0].identityConfidence).toBe(
      facts.foodCandidates[0].identityConfidence,
    );
    expect(normalized.ingredients[0].presence).toBe(
      facts.ingredients[0].presence,
    );
    expect(normalized.evidence).toEqual(facts.evidence);
    expect(normalized.evidence.map(({ source, strength }) => ({
      source,
      strength,
    }))).toEqual(
      facts.evidence.map(({ source, strength }) => ({ source, strength })),
    );
  });

  it("preserves explicit unknowns and contradictions", () => {
    const normalized = normalizeExtractedFoodFacts(facts);

    expect(normalized.preparation.pasteurization).toBe("unknown");
    expect(normalized.preparation.doneness).toBe("unknown");
    expect(normalized.nutrition.sodiumLevel).toBe("unknown");
    expect(normalized.uncertainties).toEqual(facts.uncertainties);
    expect(normalized.contradictions).toEqual(facts.contradictions);
  });

  it("is idempotent", () => {
    const normalized = normalizeExtractedFoodFacts(facts);

    expect(normalizeExtractedFoodFacts(normalized)).toEqual(normalized);
  });
});
