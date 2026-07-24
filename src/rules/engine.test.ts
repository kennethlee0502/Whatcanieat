import { describe, expect, it } from "vitest";

import type { RuleMatch } from "@/domain/evaluation";
import type { ExtractedFoodFacts } from "@/domain/food";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  completeRuleDefinitions,
  createRuleRegistry,
  ENGINE_RULE_SET_VERSION,
  evaluateFood,
  getApplicablePregnancyDimensions,
  getReasonSummary,
  hasCompletePregnancyEvaluationCoverage,
  validateEmittedRuleMatches,
} from "@/rules/engine";
import { evaluatePregnancyRules } from "@/rules/pregnancy";

const evidence = (
  id: string,
  summary: string,
  source:
    | "visibleInImage"
    | "readableOnLabel"
    | "conventionalInference"
    | "userProvided" = "readableOnLabel",
  strength: "confirmed" | "likely" | "possible" | "unknown" = "confirmed",
) => ({ id, source, strength, summary } as const);

const facts = (
  overrides: Partial<ExtractedFoodFacts> = {},
): ExtractedFoodFacts => ({
  schemaVersion: 1,
  imageSuitability: "foodDetected",
  foodCandidates: [
    {
      id: "food-apple",
      displayName: "Apple",
      canonicalName: "apple",
      identityConfidence: "high",
      evidenceIds: ["identity"],
    },
  ],
  primaryFoodId: "food-apple",
  ingredients: [],
  preparation: {
    pasteurization: "notApplicable",
    doneness: "notApplicable",
    rawAnimalProduct: "unknown",
    evidenceIds: [],
  },
  nutrition: {
    sodiumLevel: "unknown",
    highlyProcessed: "unknown",
    evidenceIds: [],
  },
  labels: [],
  evidence: [
    evidence(
      "identity",
      "The apple is clearly visible.",
      "visibleInImage",
    ),
  ],
  uncertainties: [],
  contradictions: [],
  extractionConfidence: "high",
  ...overrides,
});

const withCompleteIngredientLabel = (
  input: ExtractedFoodFacts = facts(),
): ExtractedFoodFacts => {
  const listedIngredients =
    input.ingredients.length > 0
      ? input.ingredients.map((item) => item.displayName).join(", ")
      : "apple";
  return {
    ...input,
    labels: [
      ...input.labels,
      {
        id: "ingredient-label",
        text: `Ingredients: ${listedIngredients}.`,
        legibility: "readable",
        evidenceIds: ["ingredient-list"],
      },
    ],
    evidence: [
      ...input.evidence,
      evidence(
        "ingredient-list",
        `The complete Ingredients list reads: ${listedIngredients}.`,
      ),
    ],
  };
};

const matchingIngredient = (
  ingredientId: string,
  presence: "confirmed" | "likely" | "possible" | "absent" | "unknown",
  evidenceIds: readonly string[],
) => ({
  id: `ingredient-${ingredientId}`,
  ingredientId,
  displayName: ingredientId,
  presence,
  evidenceIds: [...evidenceIds],
});

describe("complete rule engine", () => {
  it("registers one explicit, complete rule set", () => {
    expect(ENGINE_RULE_SET_VERSION).toBe("1.0.0");
    const registry = createRuleRegistry(completeRuleDefinitions);
    expect(registry.size).toBe(completeRuleDefinitions.length);
    expect(registry.size).toBeGreaterThan(0);
  });

  it("rejects duplicate registered rule IDs deterministically", () => {
    expect(() =>
      createRuleRegistry([
        completeRuleDefinitions[0],
        completeRuleDefinitions[0],
      ]),
    ).toThrow(
      `Duplicate registered rule id: ${completeRuleDefinitions[0].id}`,
    );
  });

  it.each([
    {
      name: "unknown",
      mutate: (match: RuleMatch): RuleMatch => ({
        ...match,
        rule: { ...match.rule, id: "unknown-rule" },
      }),
      message: "Unknown emitted rule id: unknown-rule",
    },
    {
      name: "version-mismatched",
      mutate: (match: RuleMatch): RuleMatch => ({
        ...match,
        rule: { ...match.rule, version: "99.0.0" },
      }),
      message: "Version mismatch for emitted rule",
    },
    {
      name: "restriction-mismatched",
      mutate: (match: RuleMatch): RuleMatch => ({
        ...match,
        rule: { ...match.rule, restriction: "pregnancy" },
      }),
      message: "Restriction mismatch for emitted rule",
    },
  ])("rejects a $name emitted descriptor", ({ mutate, message }) => {
    const valid = evaluateFood(
      { allergies: [{ allergenId: "peanut" }] },
      withCompleteIngredientLabel(),
    ).ruleMatches[0];
    expect(() => validateEmittedRuleMatches([mutate(valid)])).toThrow(
      message,
    );
  });

  it("does not return Safe for confirmed identity without allergy coverage", () => {
    const result = evaluateFood(
      { allergies: [{ allergenId: "peanut" }] },
      facts(),
    );
    expect(result).toMatchObject({
      verdict: "needMoreInformation",
      recommendationConfidence: "low",
    });
    expect(result.missingInformation).toContain(
      "Ingredient coverage for allergy peanut is incomplete.",
    );
  });

  it("does not return Safe for confirmed identity without diet ingredient coverage", () => {
    const result = evaluateFood({ diet: "vegan" }, facts());
    expect(result).toMatchObject({
      verdict: "needMoreInformation",
      recommendationConfidence: "low",
    });
    expect(result.missingInformation).toContain(
      "Complete ingredient coverage for the vegan preference is incomplete.",
    );
  });

  it.each([
    { text: "Ingredients: wheat flour, ...", legibility: "readable" },
    { text: "Ingredients: milk [cropped]", legibility: "readable" },
    { text: "Ingredients: see side panel", legibility: "readable" },
    {
      text: "Ingredients: peanut oil; remaining ingredients unreadable",
      legibility: "readable",
    },
    { text: "Ingredients: wheat flour", legibility: "partial" },
  ] as const)(
    "does not treat an incomplete ingredient label as complete: $text",
    ({ text, legibility }) => {
      const input = facts({
        labels: [
          {
            id: "ingredient-label",
            text,
            legibility,
            evidenceIds: ["ingredient-list"],
          },
        ],
        evidence: [
          ...facts().evidence,
          evidence(
            "ingredient-list",
            "The complete ingredient list is readable.",
          ),
        ],
      });

      for (const selectedProfile of [
        { allergies: [{ allergenId: "peanut" }] },
        { diet: "vegan" },
      ] satisfies AnalysisProfileContext[]) {
        const result = evaluateFood(selectedProfile, input);
        expect(result).toMatchObject({
          verdict: "needMoreInformation",
          recommendationConfidence: "low",
        });
      }
    },
  );

  it("does not return Safe for high blood pressure without sodium coverage", () => {
    const result = evaluateFood({ highBloodPressure: true }, facts());
    expect(result).toMatchObject({
      verdict: "needMoreInformation",
      recommendationConfidence: "low",
    });
    expect(result.missingInformation).toContain(
      "Reliable serving-based sodium information is incomplete.",
    );
  });

  it("does not return Safe for pregnancy with unresolved preparation", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("milk", "confirmed", ["milk-evidence"]),
      ],
      evidence: [
        evidence(
          "identity",
          "The milk is clearly visible.",
          "visibleInImage",
        ),
        evidence("milk-evidence", "Ingredients: milk."),
      ],
    });
    const result = evaluateFood({ pregnancy: {} }, input);
    expect(result.verdict).toBe("needMoreInformation");
    expect(
      result.ruleMatches.some((match) => match.status === "uncertain"),
    ).toBe(true);
  });

  it("does not let one pregnancy-local clearance establish global adequacy", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("milk", "confirmed", ["milk-evidence"]),
      ],
      preparation: {
        pasteurization: "pasteurized",
        doneness: "notApplicable",
        rawAnimalProduct: "unknown",
        evidenceIds: ["pasteurization"],
      },
      evidence: [
        ...facts().evidence,
        evidence("milk-evidence", "Ingredients: milk."),
        evidence(
          "pasteurization",
          "The milk is pasteurized.",
          "userProvided",
        ),
      ],
    });
    const result = evaluateFood({ pregnancy: {} }, input);
    expect(
      result.ruleMatches.some((match) => match.status === "cleared"),
    ).toBe(true);
    expect(result).toMatchObject({
      verdict: "needMoreInformation",
      recommendationConfidence: "low",
    });
  });

  it("does not let pasteurized dairy clear an unrelated animal-preparation gap", () => {
    const base = withCompleteIngredientLabel(
      facts({
        ingredients: [
          matchingIngredient("milk", "confirmed", ["milk-evidence"]),
          matchingIngredient("chicken", "confirmed", ["chicken-evidence"]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "unknown",
          rawAnimalProduct: "unknown",
          evidenceIds: ["pasteurization"],
        },
        evidence: [
          ...facts().evidence,
          evidence("milk-evidence", "Ingredients: milk."),
          evidence("chicken-evidence", "Ingredients: chicken."),
          evidence(
            "pasteurization",
            "The milk is pasteurized.",
            "userProvided",
          ),
        ],
      }),
    );
    const result = evaluateFood({ pregnancy: {} }, base);
    expect(result.verdict).toBe("needMoreInformation");
    expect(
      result.ruleMatches.some(
        (match) =>
          match.reasonKey === "pregnancy-animal-preparation-unknown",
      ),
    ).toBe(true);
  });

  it("returns Safe when all represented pregnancy dimensions are resolved", () => {
    const base = withCompleteIngredientLabel(
      facts({
        ingredients: [
          matchingIngredient("milk", "confirmed", ["milk-evidence"]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: ["pasteurization"],
        },
        evidence: [
          ...facts().evidence,
          evidence("milk-evidence", "Ingredients: milk."),
          evidence(
            "pasteurization",
            "The milk is pasteurized.",
            "userProvided",
          ),
        ],
      }),
    );
    expect(evaluateFood({ pregnancy: {} }, base)).toMatchObject({
      verdict: "safe",
      recommendationConfidence: "high",
    });
  });

  it("represents every applicable pregnancy dimension exactly once", () => {
    const input = withCompleteIngredientLabel(
      facts({
        ingredients: [
          matchingIngredient("milk", "confirmed", ["milk-evidence"]),
          matchingIngredient("chicken", "confirmed", ["chicken-evidence"]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "fullyCooked",
          rawAnimalProduct: "no",
          evidenceIds: ["pasteurization", "doneness"],
        },
        evidence: [
          ...facts().evidence,
          evidence("milk-evidence", "Ingredients: milk."),
          evidence("chicken-evidence", "Ingredients: chicken."),
          evidence(
            "pasteurization",
            "The milk is pasteurized.",
            "userProvided",
          ),
          evidence(
            "doneness",
            "The chicken is fully cooked and has no raw animal product.",
            "userProvided",
          ),
        ],
      }),
    );
    const evaluations = evaluatePregnancyRules({ pregnancy: {} }, input);
    const outcomes = evaluations.map((evaluation) => ({
      dimension: evaluation.concern,
      ruleMatch: evaluation.ruleMatch,
    }));

    expect(getApplicablePregnancyDimensions(input)).toEqual([
      "pasteurization",
      "animal",
    ]);
    expect(outcomes.map((outcome) => outcome.dimension)).toEqual([
      "pasteurization",
      "animal",
    ]);
    expect(
      hasCompletePregnancyEvaluationCoverage(input, outcomes),
    ).toBe(true);
  });

  it("rejects missing, duplicated, and unrelated pregnancy dimension coverage", () => {
    const input = withCompleteIngredientLabel(
      facts({
        ingredients: [
          matchingIngredient("milk", "confirmed", ["milk-evidence"]),
          matchingIngredient("chicken", "confirmed", ["chicken-evidence"]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "fullyCooked",
          rawAnimalProduct: "no",
          evidenceIds: ["pasteurization", "doneness"],
        },
        evidence: [
          ...facts().evidence,
          evidence("milk-evidence", "Ingredients: milk."),
          evidence("chicken-evidence", "Ingredients: chicken."),
          evidence(
            "pasteurization",
            "The milk is pasteurized.",
            "userProvided",
          ),
          evidence(
            "doneness",
            "The chicken is fully cooked and has no raw animal product.",
            "userProvided",
          ),
        ],
      }),
    );
    const outcomes = evaluatePregnancyRules({ pregnancy: {} }, input).map(
      (evaluation) => ({
        dimension: evaluation.concern,
        ruleMatch: evaluation.ruleMatch,
      }),
    );
    const missing = outcomes.slice(0, 1);
    const duplicated = [outcomes[0], outcomes[0]];
    const unrelated = [
      outcomes[0],
      { ...outcomes[1], dimension: "sproutOrDough" as const },
    ];

    expect(hasCompletePregnancyEvaluationCoverage(input, missing)).toBe(
      false,
    );
    expect(hasCompletePregnancyEvaluationCoverage(input, duplicated)).toBe(
      false,
    );
    expect(hasCompletePregnancyEvaluationCoverage(input, unrelated)).toBe(
      false,
    );
  });

  it("returns Safe when every applicable pregnancy dimension is cleared with complete evidence", () => {
    const input = withCompleteIngredientLabel(
      facts({
        ingredients: [
          matchingIngredient("milk", "confirmed", ["milk-evidence"]),
          matchingIngredient("chicken", "confirmed", ["chicken-evidence"]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "fullyCooked",
          rawAnimalProduct: "no",
          evidenceIds: ["pasteurization", "doneness"],
        },
        evidence: [
          ...facts().evidence,
          evidence("milk-evidence", "Ingredients: milk."),
          evidence("chicken-evidence", "Ingredients: chicken."),
          evidence(
            "pasteurization",
            "The milk is pasteurized.",
            "userProvided",
          ),
          evidence(
            "doneness",
            "The chicken is fully cooked and has no raw animal product.",
            "userProvided",
          ),
        ],
      }),
    );
    expect(evaluateFood({ pregnancy: {} }, input).verdict).toBe("safe");
  });

  it("changes Safe to Need more information when a newly applicable pregnancy dimension is unresolved", () => {
    const safeInput = withCompleteIngredientLabel(
      facts({
        ingredients: [
          matchingIngredient("milk", "confirmed", ["milk-evidence"]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: ["pasteurization"],
        },
        evidence: [
          ...facts().evidence,
          evidence("milk-evidence", "Ingredients: milk."),
          evidence(
            "pasteurization",
            "The milk is pasteurized.",
            "userProvided",
          ),
        ],
      }),
    );
    const unresolvedInput = withCompleteIngredientLabel({
      ...safeInput,
      labels: [],
      ingredients: [
        ...safeInput.ingredients,
        matchingIngredient("chicken", "confirmed", ["chicken-evidence"]),
      ],
      preparation: {
        ...safeInput.preparation,
        doneness: "unknown",
      },
      evidence: [
        ...safeInput.evidence.filter(
          (item) => item.id !== "ingredient-list",
        ),
        evidence("chicken-evidence", "Ingredients: chicken."),
      ],
    });

    expect(evaluateFood({ pregnancy: {} }, safeInput).verdict).toBe("safe");
    expect(evaluateFood({ pregnancy: {} }, unresolvedInput).verdict).toBe(
      "needMoreInformation",
    );
  });

  it("checks pregnancy completeness deterministically across repeated evaluation", () => {
    const input = withCompleteIngredientLabel(
      facts({
        ingredients: [
          matchingIngredient("milk", "confirmed", ["milk-evidence"]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: ["pasteurization"],
        },
        evidence: [
          ...facts().evidence,
          evidence("milk-evidence", "Ingredients: milk."),
          evidence(
            "pasteurization",
            "The milk is pasteurized.",
            "userProvided",
          ),
        ],
      }),
    );
    const first = evaluateFood({ pregnancy: {} }, input);
    const second = evaluateFood({ pregnancy: {} }, input);
    expect(first).toEqual(second);
    expect(getApplicablePregnancyDimensions(input)).toEqual(
      getApplicablePregnancyDimensions(input),
    );
  });

  it("does not let a neutral pregnancy match establish adequacy without coverage", () => {
    const result = evaluateFood({ pregnancy: {} }, facts());
    expect(
      result.ruleMatches.every(
        (match) =>
          match.status === "cleared" ||
          match.status === "notApplicable",
      ),
    ).toBe(true);
    expect(result).toMatchObject({
      verdict: "needMoreInformation",
      recommendationConfidence: "low",
    });
  });

  it("requires every selected restriction to be adequate", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("peanut", "absent", ["peanut-absence"]),
      ],
      evidence: [
        ...facts().evidence,
        evidence(
          "peanut-absence",
          "The user confirmed the food does not contain peanut.",
          "userProvided",
        ),
      ],
    });
    const result = evaluateFood(
      {
        allergies: [{ allergenId: "peanut" }],
        diet: "vegan",
      },
      input,
    );
    expect(result).toMatchObject({
      verdict: "needMoreInformation",
      recommendationConfidence: "low",
    });
    expect(result.missingInformation).toContain(
      "Complete ingredient coverage for the vegan preference is incomplete.",
    );
  });

  it("does not let a caution match conceal inadequate allergy coverage", () => {
    const input = facts({
      nutrition: {
        sodiumLevel: "high",
        highlyProcessed: "unknown",
        evidenceIds: ["sodium"],
      },
      evidence: [
        ...facts().evidence,
        evidence(
          "sodium",
          "This food is high in sodium.",
          "visibleInImage",
          "likely",
        ),
      ],
    });
    const result = evaluateFood(
      {
        allergies: [{ allergenId: "peanut" }],
        highBloodPressure: true,
      },
      input,
    );
    expect(result).toMatchObject({
      verdict: "needMoreInformation",
      recommendationConfidence: "low",
    });
    expect(result.missingInformation).toContain(
      "Ingredient coverage for allergy peanut is incomplete.",
    );
  });

  it("returns Safe when every selected restriction has adequate coverage", () => {
    const result = evaluateFood(
      {
        allergies: [{ allergenId: "peanut" }],
        diet: "vegan",
      },
      withCompleteIngredientLabel(),
    );
    expect(result).toMatchObject({
      verdict: "safe",
      recommendationConfidence: "high",
      ruleSetVersion: ENGINE_RULE_SET_VERSION,
    });
  });

  it("does not let neutral matches alone satisfy restriction adequacy", () => {
    const result = evaluateFood(
      {
        allergies: [{ allergenId: "peanut" }],
        diet: "vegan",
      },
      facts(),
    );
    expect(
      result.ruleMatches.every(
        (match) =>
          match.status === "cleared" ||
          match.status === "notApplicable",
      ),
    ).toBe(true);
    expect(result.verdict).toBe("needMoreInformation");
  });

  it("emits matches only for selected restrictions", () => {
    const result = evaluateFood(
      { allergies: [{ allergenId: "peanut" }] },
      withCompleteIngredientLabel(),
    );
    expect(result.ruleMatches).not.toHaveLength(
      completeRuleDefinitions.length,
    );
    expect(
      new Set(result.ruleMatches.map((match) => match.rule.restriction)),
    ).toEqual(new Set(["allergy"]));
  });

  it("uses Avoid over Need more information and Safe with caution", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("peanut", "confirmed", ["peanut"]),
        matchingIngredient("gelatin", "possible", ["gelatin"]),
      ],
      nutrition: {
        sodiumLevel: "high",
        highlyProcessed: "unknown",
        evidenceIds: ["sodium"],
      },
      evidence: [
        ...facts().evidence,
        evidence("peanut", "Contains peanut."),
        evidence(
          "gelatin",
          "Gelatin is possibly included.",
          "conventionalInference",
          "possible",
        ),
        evidence(
          "sodium",
          "This food is high in sodium.",
          "visibleInImage",
          "likely",
        ),
      ],
    });
    const result = evaluateFood(
      {
        pregnancy: {},
        allergies: [{ allergenId: "peanut" }],
        highBloodPressure: true,
        diet: "vegan",
      },
      input,
    );
    expect(result.verdict).toBe("avoid");
    expect(result.clarificationQuestions).toEqual([]);
    expect(
      new Set(
        result.ruleMatches.flatMap(({ recommendedVerdict }) =>
          recommendedVerdict === null ? [] : [recommendedVerdict],
        ),
      ),
    ).toEqual(
      new Set(["avoid", "needMoreInformation", "safeWithCaution"]),
    );
  });

  it("keeps high-confidence Avoid high without contradictions", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("peanut", "confirmed", ["peanut"]),
      ],
      evidence: [
        ...facts().evidence,
        evidence("peanut", "Contains peanut."),
      ],
    });
    expect(
      evaluateFood(
        { allergies: [{ allergenId: "peanut" }] },
        input,
      ),
    ).toMatchObject({
      verdict: "avoid",
      recommendationConfidence: "high",
    });
  });

  it("caps high-confidence Avoid at medium when any contradiction remains", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("peanut", "confirmed", ["peanut"]),
      ],
      evidence: [
        ...facts().evidence,
        evidence("peanut", "Contains peanut."),
      ],
      contradictions: [
        {
          id: "unrelated-conflict",
          factPath: "preparation.cookingMethod",
          description: "Cooking method evidence conflicts.",
          competingClaims: [
            { value: "baked", evidenceIds: [] },
            { value: "fried", evidenceIds: [] },
          ],
        },
      ],
    });
    const result = evaluateFood(
      { allergies: [{ allergenId: "peanut" }] },
      input,
    );
    expect(result).toMatchObject({
      verdict: "avoid",
      recommendationConfidence: "medium",
    });
    expect(result.ruleMatches[0].risk).toBe("critical");
  });

  it("uses Need more information over Safe with caution", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("gelatin", "possible", ["gelatin"]),
      ],
      nutrition: {
        sodiumLevel: "high",
        highlyProcessed: "unknown",
        evidenceIds: ["sodium"],
      },
      evidence: [
        ...facts().evidence,
        evidence(
          "gelatin",
          "Gelatin is possibly included.",
          "conventionalInference",
          "possible",
        ),
        evidence(
          "sodium",
          "This food is high in sodium.",
          "visibleInImage",
          "likely",
        ),
      ],
    });
    const result = evaluateFood(
      { highBloodPressure: true, diet: "vegan" },
      input,
    );
    expect(result.verdict).toBe("needMoreInformation");
    expect(result.clarificationQuestions).toHaveLength(1);
  });

  it("deduplicates evidence and missing facts deterministically", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("gelatin", "possible", ["shared"]),
        matchingIngredient("milk", "possible", ["shared"]),
      ],
      evidence: [
        ...facts().evidence,
        evidence(
          "shared",
          "Gelatin and milk are possibly included.",
          "conventionalInference",
          "possible",
        ),
      ],
    });
    const result = evaluateFood({ diet: "vegan" }, input);
    expect(result.evidence.filter((item) => item.id === "shared")).toHaveLength(
      1,
    );
    expect(new Set(result.missingInformation).size).toBe(
      result.missingInformation.length,
    );
  });

  it("caps reasons at three and preserves deterministic repeated output", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("peanut", "confirmed", ["peanut"]),
        matchingIngredient("milk", "confirmed", ["milk"]),
        matchingIngredient("gelatin", "confirmed", ["gelatin"]),
        matchingIngredient("honey", "confirmed", ["honey"]),
      ],
      evidence: [
        ...facts().evidence,
        evidence("peanut", "Contains peanut."),
        evidence("milk", "Contains milk."),
        evidence("gelatin", "Ingredients: gelatin."),
        evidence("honey", "Ingredients: honey."),
      ],
    });
    const profileInput: AnalysisProfileContext = {
      allergies: [{ allergenId: "peanut" }],
      diet: "vegan",
    };
    const first = evaluateFood(profileInput, input);
    const second = evaluateFood(profileInput, input);
    expect(first).toEqual(second);
    expect(first.reasons).toHaveLength(3);
  });

  it("uses stable reason copy instead of exposing internal keys", () => {
    const input = facts({
      ingredients: [
        matchingIngredient("peanut", "confirmed", ["peanut"]),
      ],
      evidence: [
        ...facts().evidence,
        evidence("peanut", "Contains peanut."),
      ],
    });
    const result = evaluateFood(
      { allergies: [{ allergenId: "peanut" }] },
      input,
    );
    expect(result.reasons[0].summary).toBe(
      "A selected allergen is confirmed as an ingredient.",
    );
    expect(result.reasons[0].summary).not.toContain(
      "allergy-confirmed-ingredient",
    );
  });

  it("uses controlled generic copy for an unknown reason key", () => {
    expect(getReasonSummary("future-unknown-reason")).toBe(
      "A supported rule affected this recommendation.",
    );
  });

  it("does not mutate profile or facts", () => {
    const profileInput: AnalysisProfileContext = {
      allergies: [{ allergenId: "peanut" }],
      diet: "vegan",
    };
    const input = withCompleteIngredientLabel();
    const profileSnapshot = structuredClone(profileInput);
    const factsSnapshot = structuredClone(input);
    evaluateFood(profileInput, input);
    expect(profileInput).toEqual(profileSnapshot);
    expect(input).toEqual(factsSnapshot);
  });
});
