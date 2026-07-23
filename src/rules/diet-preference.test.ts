import { describe, expect, it } from "vitest";

import type { ExtractedFoodFacts } from "@/domain/food";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  dietPreferenceRuleDefinitions,
  evaluateDietPreferenceRules,
} from "@/rules/diet-preference";
import { safetyRuleDefinitionSchema } from "@/rules/provenance";

const profile = (
  diet: "vegetarian" | "vegan",
): AnalysisProfileContext => ({ diet });

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

const ingredient = (
  ingredientId: string,
  presence: "confirmed" | "likely" | "possible" | "absent" | "unknown",
  evidenceIds = ["ingredient-evidence"],
  displayName = ingredientId,
) => ({
  id: `ingredient-${ingredientId}`,
  ingredientId,
  displayName,
  presence,
  evidenceIds,
} as const);

const facts = (
  overrides: Partial<ExtractedFoodFacts> = {},
): ExtractedFoodFacts => ({
  schemaVersion: 1,
  imageSuitability: "foodDetected",
  foodCandidates: [],
  primaryFoodId: null,
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
  evidence: [],
  uncertainties: [],
  contradictions: [],
  extractionConfidence: "medium",
  ...overrides,
});

describe("diet-preference rules", () => {
  it("ships complete, version-consistent policy provenance", () => {
    expect(dietPreferenceRuleDefinitions).toHaveLength(8);
    for (const definition of dietPreferenceRuleDefinitions) {
      expect(safetyRuleDefinitionSchema.safeParse(definition).success).toBe(
        true,
      );
      expect(definition.version).toBe(definition.provenance.ruleVersion);
    }
  });

  it("returns no evaluations without a selected diet", () => {
    expect(evaluateDietPreferenceRules({}, facts())).toEqual([]);
  });

  it.each([
    "May contain milk.",
    "May contain traces of milk.",
  ])("ignores precautionary milk wording for vegan rules: %s", (summary) => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("milk", "possible")],
        evidence: [evidence("ingredient-evidence", summary)],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "notApplicable",
      recommendedVerdict: null,
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("ignores a shared-facility egg warning", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("egg", "possible")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "Made in a facility that processes egg.",
          ),
        ],
      }),
    );

    expect(evaluation.ruleMatch.status).toBe("notApplicable");
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("ignores shared-equipment dairy wording", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("milk", "possible")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "Manufactured on shared equipment with dairy.",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it("treats affirmative label milk as a vegan conflict", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("milk", "confirmed")],
        evidence: [
          evidence("ingredient-evidence", "Contains milk."),
        ],
      }),
    );
    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "avoid",
      rule: { restriction: "vegan" },
    });
  });

  it("accepts affirmative ingredient-list and made-with wording", () => {
    for (const [ingredientId, summary] of [
      ["milk-powder", "Ingredients: milk powder."],
      ["egg", "Made with eggs."],
    ] as const) {
      const [evaluation] = evaluateDietPreferenceRules(
        profile("vegan"),
        facts({
          ingredients: [ingredient(ingredientId, "confirmed")],
          evidence: [evidence("ingredient-evidence", summary)],
        }),
      );
      expect(evaluation.ruleMatch.status).toBe("triggered");
    }
  });

  it("allows visible chicken to confirm a conflict for both diets", () => {
    for (const diet of ["vegetarian", "vegan"] as const) {
      const [evaluation] = evaluateDietPreferenceRules(
        profile(diet),
        facts({
          ingredients: [ingredient("chicken", "confirmed")],
          evidence: [
            evidence(
              "ingredient-evidence",
              "Chicken is clearly visible.",
              "visibleInImage",
            ),
          ],
        }),
      );
      expect(evaluation.ruleMatch).toMatchObject({
        status: "triggered",
        recommendedVerdict: "avoid",
        rule: { restriction: diet },
      });
    }
  });

  it("does not let visible gelatin confirm a hidden derivative", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegetarian"),
      facts({
        ingredients: [ingredient("gelatin", "confirmed")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "Gelatin appears visible in the dessert.",
            "visibleInImage",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
    });
  });

  it("keeps conventional animal-stock inference uncertain", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegetarian"),
      facts({
        ingredients: [ingredient("chicken-stock", "likely")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "The recipe likely includes chicken stock.",
            "conventionalInference",
            "likely",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
    });
    expect(evaluation.clarificationQuestion).toBeDefined();
  });

  it("uses explicit gelatin label evidence for both diets", () => {
    for (const diet of ["vegetarian", "vegan"] as const) {
      const [evaluation] = evaluateDietPreferenceRules(
        profile(diet),
        facts({
          ingredients: [ingredient("gelatin", "confirmed")],
          evidence: [
            evidence(
              "ingredient-evidence",
              "Ingredients: gelatin.",
            ),
          ],
        }),
      );
      expect(evaluation.ruleMatch).toMatchObject({
        status: "triggered",
        recommendedVerdict: "avoid",
      });
    }
  });

  it("accepts explicit user confirmation for a hidden derivative", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("gelatin", "confirmed")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "The user confirmed gelatin is present.",
            "userProvided",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("triggered");
  });

  it("clears only an explicitly absent gelatin condition", () => {
    const evaluations = evaluateDietPreferenceRules(
      profile("vegetarian"),
      facts({
        ingredients: [ingredient("gelatin", "absent")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "The label confirms this does not contain gelatin.",
          ),
        ],
      }),
    );
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]).toMatchObject({
      ingredientId: "gelatin",
      group: "slaughter-derived",
      ruleMatch: {
        status: "cleared",
        recommendedVerdict: null,
      },
    });
  });

  it("does not emit blanket clearances for absent taxonomy categories", () => {
    const evaluations = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("gelatin", "absent")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "Does not contain gelatin.",
          ),
        ],
      }),
    );
    expect(evaluations).toHaveLength(1);
    expect(evaluations.map((item) => item.ingredientId)).toEqual([
      "gelatin",
    ]);
  });

  it("allows dairy and egg for vegetarian while rejecting them for vegan", () => {
    for (const ingredientId of ["milk", "egg"] as const) {
      const input = facts({
        ingredients: [ingredient(ingredientId, "confirmed")],
        evidence: [
          evidence(
            "ingredient-evidence",
            `Contains ${ingredientId}.`,
          ),
        ],
      });
      expect(
        evaluateDietPreferenceRules(profile("vegetarian"), input)[0]
          .ruleMatch.status,
      ).toBe("notApplicable");
      expect(
        evaluateDietPreferenceRules(profile("vegan"), input)[0].ruleMatch
          .status,
      ).toBe("triggered");
    }
  });

  it("allows honey for vegetarian while rejecting it for vegan", () => {
    const input = facts({
      ingredients: [ingredient("honey", "confirmed")],
      evidence: [
        evidence("ingredient-evidence", "Ingredients: honey."),
      ],
    });
    expect(
      evaluateDietPreferenceRules(profile("vegetarian"), input)[0]
        .ruleMatch.status,
    ).toBe("notApplicable");
    expect(
      evaluateDietPreferenceRules(profile("vegan"), input)[0].ruleMatch
        .status,
    ).toBe("triggered");
  });

  it("does not let one category's evidence validate another", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("gelatin", "confirmed", ["milk-evidence"])],
        evidence: [
          evidence("milk-evidence", "Contains milk."),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("uncertain");
  });

  it("keeps an ingredient-specific contradiction uncertain", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegetarian"),
      facts({
        ingredients: [ingredient("gelatin", "confirmed")],
        evidence: [
          evidence("ingredient-evidence", "Ingredients: gelatin."),
        ],
        contradictions: [
          {
            id: "gelatin-conflict",
            factPath: "ingredients.gelatin",
            description: "Gelatin presence conflicts.",
            competingClaims: [
              { value: "present", evidenceIds: ["ingredient-evidence"] },
              { value: "absent", evidenceIds: [] },
            ],
          },
        ],
      }),
    );
    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      missingFactIds: [
        "ingredient-gelatin",
        "gelatin-conflict",
      ],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("suppresses only the same scoped clarification after an unknown answer", () => {
    const evaluations = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [
          ingredient("gelatin", "unknown", ["gelatin-answer"]),
          ingredient("milk", "possible", ["milk-inference"]),
        ],
        evidence: [
          evidence(
            "gelatin-answer",
            "The user is unknown about gelatin.",
            "userProvided",
            "unknown",
          ),
          evidence(
            "milk-inference",
            "Milk is possibly included.",
            "conventionalInference",
            "possible",
          ),
        ],
      }),
    );
    const gelatin = evaluations.find(
      (item) => item.ingredientId === "gelatin",
    );
    const milk = evaluations.find((item) => item.ingredientId === "dairy");

    expect(gelatin?.clarificationQuestion).toBeUndefined();
    expect(milk?.clarificationQuestion).toBeDefined();
  });

  it("does not infer suitability from the word plant-based", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        evidence: [
          evidence(
            "marketing",
            "Plant-based recipe.",
            "readableOnLabel",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it.each(["vegetarian", "vegan"] as const)(
    "treats a confirmed readable cricket ingredient as a %s conflict",
    (diet) => {
      const [evaluation] = evaluateDietPreferenceRules(
        profile(diet),
        facts({
          ingredients: [ingredient("cricket", "confirmed")],
          evidence: [
            evidence(
              "ingredient-evidence",
              "Ingredients: cricket flour.",
            ),
          ],
        }),
      );
      expect(evaluation.ruleMatch).toMatchObject({
        status: "triggered",
        recommendedVerdict: "avoid",
        rule: { restriction: diet },
      });
    },
  );

  it("allows clearly visible whole insects to confirm a conflict", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegetarian"),
      facts({
        ingredients: [ingredient("crickets", "confirmed")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "Whole crickets are clearly visible.",
            "visibleInImage",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("triggered");
  });

  it.each([
    ["chicken", "Chicken is not visible."],
    ["chicken", "Chicken is not shown."],
    ["chicken", "This is not chicken."],
    ["fish", "The pictured item is not fish."],
    ["cricket", "No identifiable cricket is visible."],
    ["chicken", "It is unclear whether the pieces are chicken."],
  ] as const)(
    "rejects non-affirmative visible identity evidence: %s — %s",
    (ingredientId, summary) => {
      const [evaluation] = evaluateDietPreferenceRules(
        profile("vegetarian"),
        facts({
          ingredients: [ingredient(ingredientId, "confirmed")],
          evidence: [
            evidence(
              "ingredient-evidence",
              summary,
              "visibleInImage",
            ),
          ],
        }),
      );
      expect(evaluation.ruleMatch).toMatchObject({
        status: "uncertain",
        recommendedVerdict: "needMoreInformation",
      });
    },
  );

  it.each([
    ["chicken", "Chicken is clearly visible."],
    ["crickets", "Whole crickets are shown."],
    ["shrimp", "The image clearly shows shrimp."],
    ["fish", "Visible pieces of fish are present."],
  ] as const)(
    "accepts affirmative visible identity evidence: %s — %s",
    (ingredientId, summary) => {
      const [evaluation] = evaluateDietPreferenceRules(
        profile("vegetarian"),
        facts({
          ingredients: [ingredient(ingredientId, "confirmed")],
          evidence: [
            evidence(
              "ingredient-evidence",
              summary,
              "visibleInImage",
            ),
          ],
        }),
      );
      expect(evaluation.ruleMatch).toMatchObject({
        status: "triggered",
        recommendedVerdict: "avoid",
      });
    },
  );

  it("keeps conventional insect-ingredient inference uncertain", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("mealworm", "likely")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "The recipe likely includes mealworm.",
            "conventionalInference",
            "likely",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
    });
  });

  it("clears only a reliably absent insect condition", () => {
    const evaluations = evaluateDietPreferenceRules(
      profile("vegetarian"),
      facts({
        ingredients: [ingredient("insects", "absent")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "The label confirms this does not contain insects.",
          ),
        ],
      }),
    );
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]).toMatchObject({
      ingredientId: "insect",
      ruleMatch: {
        status: "cleared",
        recommendedVerdict: null,
      },
    });
  });

  it("ignores precautionary insect wording", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("cricket", "possible")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "May contain traces of cricket.",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("supports an unambiguously mapped consequential ingredient uncertainty without a matching ingredient record", () => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        uncertainties: [
          {
            id: "gelatin-gap",
            subject: "Gelatin",
            kind: "ingredient",
            description: "Gelatin presence is unknown.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: [],
          },
        ],
      }),
    );
    expect(evaluation).toMatchObject({
      ingredientId: "gelatin",
      ruleMatch: {
        status: "uncertain",
        missingFactIds: ["gelatin-gap"],
      },
    });
    expect(evaluation.clarificationQuestion).toBeDefined();
  });

  it("does not duplicate uncertainty when a matching ingredient record exists", () => {
    const evaluations = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        ingredients: [ingredient("gelatin", "unknown")],
        evidence: [
          evidence(
            "ingredient-evidence",
            "Gelatin presence is unknown.",
            "conventionalInference",
            "unknown",
          ),
        ],
        uncertainties: [
          {
            id: "gelatin-gap",
            subject: "Gelatin",
            kind: "ingredient",
            description: "Gelatin presence is unknown.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: ["ingredient-gelatin"],
          },
        ],
      }),
    );
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].ingredientId).toBe("gelatin");
  });

  it.each([
    "An animal-derived ingredient may be present.",
    "Milk or gelatin may be present.",
    "May contain traces of cricket.",
  ])("ignores vague, ambiguous, or precautionary orphan uncertainty: %s", (text) => {
    const [evaluation] = evaluateDietPreferenceRules(
      profile("vegan"),
      facts({
        uncertainties: [
          {
            id: "unmapped-gap",
            subject: "Ingredients",
            kind: "ingredient",
            description: text,
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: [],
          },
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });
});
