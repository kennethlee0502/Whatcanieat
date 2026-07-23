import { describe, expect, it } from "vitest";

import type { ExtractedFoodFacts } from "@/domain/food";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  evaluatePregnancyRules,
  pregnancyRuleDefinitions,
} from "@/rules/pregnancy";
import { safetyRuleDefinitionSchema } from "@/rules/provenance";

const pregnancyProfile = (
  week?: number,
): AnalysisProfileContext => ({ pregnancy: { week } });

const evidence = (
  id: string,
  source: "readableOnLabel" | "userProvided" = "userProvided",
  strength: "confirmed" | "likely" | "possible" | "unknown" = "confirmed",
  summary = `Evidence ${id}.`,
) => ({
  id,
  source,
  strength,
  summary,
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

const ingredient = (
  ingredientId: string,
  presence: "confirmed" | "likely" | "possible" | "absent" | "unknown" =
    "confirmed",
  evidenceIds = ["category-evidence"],
) => ({
  id: `ingredient-${ingredientId}`,
  ingredientId,
  displayName: ingredientId,
  presence,
  evidenceIds,
} as const);

describe("pregnancy rules", () => {
  it("ships complete, version-consistent provenance", () => {
    expect(pregnancyRuleDefinitions.length).toBeGreaterThan(0);

    for (const definition of pregnancyRuleDefinitions) {
      expect(safetyRuleDefinitionSchema.safeParse(definition).success).toBe(
        true,
      );
      expect(definition.provenance.ruleVersion).toBe(definition.version);
    }
  });

  it("returns no evaluations without a pregnancy restriction", () => {
    expect(evaluatePregnancyRules({}, facts())).toEqual([]);
  });

  it.each(["apple", "banana", "rice", "broccoli"] as const)(
    "returns notApplicable for characterized %s",
    (food) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient(food)],
          evidence: [evidence("category-evidence")],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "notApplicable",
        risk: "informational",
        recommendedVerdict: null,
        missingFactIds: [],
      });
      expect(evaluation.clarificationQuestion).toBeUndefined();
    },
  );

  it.each(["milk", "apple-juice"] as const)(
    "returns Avoid for confirmed unpasteurized %s",
    (category) => {
      const evaluations = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient(category)],
          preparation: {
            pasteurization: "unpasteurized",
            doneness: "notApplicable",
            rawAnimalProduct: "unknown",
            evidenceIds: ["preparation-evidence"],
          },
          evidence: [
            evidence("category-evidence", "readableOnLabel"),
            evidence(
              "preparation-evidence",
              "readableOnLabel",
              "confirmed",
              "The product is unpasteurized.",
            ),
          ],
        }),
      );

      expect(evaluations[0].ruleMatch).toMatchObject({
        status: "triggered",
        risk: "critical",
        recommendedVerdict: "avoid",
        reasonKey: "pregnancy-unpasteurized-product",
      });
    },
  );

  it("returns Avoid for a readable explicit unpasteurized warning", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        labels: [
          {
            id: "label-warning",
            text: "Made with unpasteurized milk.",
            legibility: "readable",
            evidenceIds: ["warning-evidence"],
          },
        ],
        evidence: [
          evidence("category-evidence"),
          evidence("warning-evidence", "readableOnLabel"),
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "avoid",
      evidenceIds: ["category-evidence", "warning-evidence"],
    });
  });

  it("lets an explicit warning establish the applicable dairy category", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        labels: [
          {
            id: "label-warning",
            text: "Made with unpasteurized milk.",
            legibility: "readable",
            evidenceIds: ["warning-evidence"],
          },
        ],
        evidence: [evidence("warning-evidence", "readableOnLabel")],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "avoid",
      evidenceIds: ["warning-evidence"],
    });
  });

  it.each([
    "Not made with unpasteurized milk.",
    "Made with pasteurized milk.",
    "No raw milk.",
  ])("does not trigger Avoid for negated wording: %s", (text) => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        labels: [
          {
            id: "label",
            text,
            legibility: "readable",
            evidenceIds: ["category-evidence"],
          },
        ],
        evidence: [evidence("category-evidence", "readableOnLabel")],
      }),
    );

    expect(evaluation.ruleMatch.recommendedVerdict).not.toBe("avoid");
  });

  it("returns cleared with null for confirmed pasteurized dairy", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: ["preparation-evidence"],
        },
        evidence: [
          evidence("category-evidence"),
          evidence(
            "preparation-evidence",
            "readableOnLabel",
            "confirmed",
            "The product is pasteurized.",
          ),
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
      missingFactIds: [],
    });
  });

  it.each([
    {
      name: "no preparation evidence",
      evidenceIds: [] as string[],
      preparationEvidence: [] as ExtractedFoodFacts["evidence"],
    },
    {
      name: "evidence that says pasteurization is unknown",
      evidenceIds: ["preparation-evidence"],
      preparationEvidence: [
        evidence(
          "preparation-evidence",
          "userProvided",
          "confirmed",
          "Pasteurization is unknown.",
        ),
      ],
    },
  ])(
    "keeps nominally pasteurized dairy uncertain with $name",
    ({ evidenceIds, preparationEvidence }) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient("milk")],
          preparation: {
            pasteurization: "pasteurized",
            doneness: "notApplicable",
            rawAnimalProduct: "unknown",
            evidenceIds,
          },
          evidence: [evidence("category-evidence"), ...preparationEvidence],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "uncertain",
        risk: "high",
        recommendedVerdict: "needMoreInformation",
        missingFactIds: ["preparation-pasteurization"],
      });
    },
  );

  it("keeps nominally unpasteurized dairy uncertain without matching evidence", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        preparation: {
          pasteurization: "unpasteurized",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: [],
        },
        evidence: [evidence("category-evidence")],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-pasteurization"],
    });
  });

  it("asks about unknown pasteurization only for an applicable category", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        preparation: {
          pasteurization: "unknown",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: [],
        },
        evidence: [evidence("category-evidence")],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-pasteurization"],
    });
    expect(evaluation.clarificationQuestion?.answerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          patch: expect.objectContaining({
            kind: "setPasteurization",
            value: "pasteurized",
          }),
        }),
        expect.objectContaining({
          patch: expect.objectContaining({
            kind: "setPasteurization",
            value: "unpasteurized",
          }),
        }),
      ]),
    );
  });

  it("tracks a partial label as a resolvable pasteurization gap", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        preparation: {
          pasteurization: "unknown",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: [],
        },
        labels: [
          {
            id: "label-partial",
            text: "Pasteurization: unknown…",
            legibility: "partial",
            evidenceIds: ["label-evidence"],
          },
        ],
        evidence: [
          evidence("category-evidence"),
          evidence("label-evidence", "readableOnLabel", "unknown"),
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: [
        "label-partial",
        "preparation-pasteurization",
      ],
      evidenceIds: ["category-evidence", "label-evidence"],
    });
    expect(evaluation.clarificationQuestion).toBeDefined();
  });

  it("ignores partial label text that is clearly unrelated to pasteurization", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: ["preparation-evidence"],
        },
        labels: [
          {
            id: "label-nutrition",
            text: "Calories 120…",
            legibility: "partial",
            evidenceIds: ["label-evidence"],
          },
        ],
        evidence: [
          evidence("category-evidence"),
          evidence(
            "preparation-evidence",
            "readableOnLabel",
            "confirmed",
            "The product is pasteurized.",
          ),
          evidence("label-evidence", "readableOnLabel", "unknown"),
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
      missingFactIds: [],
    });
  });

  it.each([
    { category: "chicken", rawAnimalProduct: "yes", doneness: "unknown" },
    { category: "salmon", rawAnimalProduct: "unknown", doneness: "raw" },
    {
      category: "beef",
      rawAnimalProduct: "unknown",
      doneness: "undercooked",
    },
    { category: "egg", rawAnimalProduct: "yes", doneness: "notApplicable" },
  ] as const)(
    "returns Avoid for confirmed hazardous animal preparation: $category",
    ({ category, rawAnimalProduct, doneness }) => {
      const preparationSummary =
        rawAnimalProduct === "yes"
          ? "The food contains a raw animal product."
          : doneness === "raw"
            ? "The food is raw."
            : "The food is undercooked.";
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient(category)],
          preparation: {
            pasteurization: "notApplicable",
            doneness,
            rawAnimalProduct,
            evidenceIds: ["preparation-evidence"],
          },
          evidence: [
            evidence("category-evidence"),
            evidence(
              "preparation-evidence",
              "userProvided",
              "confirmed",
              preparationSummary,
            ),
          ],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "triggered",
        risk: "critical",
        recommendedVerdict: "avoid",
      });
    },
  );

  it("returns cleared with null for confirmed fully cooked meat", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("chicken")],
        preparation: {
          pasteurization: "notApplicable",
          doneness: "fullyCooked",
          rawAnimalProduct: "no",
          evidenceIds: ["preparation-evidence"],
        },
        evidence: [
          evidence("category-evidence"),
          evidence(
            "preparation-evidence",
            "userProvided",
            "confirmed",
            "The food is fully cooked and has no raw animal product.",
          ),
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
    });
  });

  it.each([
    {
      name: "no preparation evidence",
      preparationEvidence: undefined,
    },
    {
      name: "evidence that says not fully cooked",
      preparationEvidence: evidence(
        "preparation-evidence",
        "userProvided",
        "confirmed",
        "The food is not fully cooked.",
      ),
    },
  ])(
    "keeps nominally fully cooked meat uncertain with $name",
    ({ preparationEvidence }) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient("chicken")],
          preparation: {
            pasteurization: "notApplicable",
            doneness: "fullyCooked",
            rawAnimalProduct: "unknown",
            evidenceIds: preparationEvidence
              ? ["preparation-evidence"]
              : [],
          },
          evidence: [
            evidence("category-evidence"),
            ...(preparationEvidence ? [preparationEvidence] : []),
          ],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "uncertain",
        risk: "high",
        recommendedVerdict: "needMoreInformation",
        missingFactIds: ["preparation-doneness"],
      });
    },
  );

  it.each(["raw", "undercooked"] as const)(
    "keeps nominally %s meat uncertain without matching evidence",
    (doneness) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient("beef")],
          preparation: {
            pasteurization: "notApplicable",
            doneness,
            rawAnimalProduct: "unknown",
            evidenceIds: [],
          },
          evidence: [evidence("category-evidence")],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "uncertain",
        recommendedVerdict: "needMoreInformation",
        missingFactIds: ["preparation-doneness"],
      });
    },
  );

  it("requires evidence specifically supporting no raw animal product to clear", () => {
    const input = facts({
      ingredients: [ingredient("egg")],
      preparation: {
        pasteurization: "notApplicable",
        doneness: "notApplicable",
        rawAnimalProduct: "no",
        evidenceIds: [],
      },
      evidence: [evidence("category-evidence")],
    });
    const [unsupported] = evaluatePregnancyRules(
      pregnancyProfile(),
      input,
    );
    const [supported] = evaluatePregnancyRules(pregnancyProfile(), {
      ...input,
      preparation: {
        ...input.preparation,
        evidenceIds: ["preparation-evidence"],
      },
      evidence: [
        ...input.evidence,
        evidence(
          "preparation-evidence",
          "userProvided",
          "confirmed",
          "The food has no raw animal product.",
        ),
      ],
    });

    expect(unsupported.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-raw-animal-product"],
    });
    expect(supported.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
    });
  });

  it("does not use no-raw-animal evidence to validate raw-animal presence", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("egg")],
        preparation: {
          pasteurization: "notApplicable",
          doneness: "notApplicable",
          rawAnimalProduct: "yes",
          evidenceIds: ["preparation-evidence"],
        },
        evidence: [
          evidence("category-evidence"),
          evidence(
            "preparation-evidence",
            "userProvided",
            "confirmed",
            "The food has no raw animal product.",
          ),
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-raw-animal-product"],
    });
  });

  it("asks about unknown doneness for a confirmed animal category", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("chicken")],
        preparation: {
          pasteurization: "notApplicable",
          doneness: "unknown",
          rawAnimalProduct: "unknown",
          evidenceIds: [],
        },
        evidence: [evidence("category-evidence")],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-doneness"],
    });
    expect(
      evaluation.clarificationQuestion?.answerOptions[0].patch.kind,
    ).toBe("setDoneness");
  });

  it.each(["sprouts", "dough", "batter"] as const)(
    "returns Avoid for confirmed raw %s",
    (category) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient(category)],
          preparation: {
            pasteurization: "notApplicable",
            doneness: "raw",
            rawAnimalProduct: "no",
            evidenceIds: ["preparation-evidence"],
          },
          evidence: [
            evidence("category-evidence"),
            evidence(
              "preparation-evidence",
              "userProvided",
              "confirmed",
              "The food is raw.",
            ),
          ],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "triggered",
        risk: "high",
        recommendedVerdict: "avoid",
        reasonKey: "pregnancy-raw-sprout-or-dough",
      });
    },
  );

  it("requires matching fully-cooked evidence to clear sprouts", () => {
    const input = facts({
      ingredients: [ingredient("sprouts")],
      preparation: {
        pasteurization: "notApplicable",
        doneness: "fullyCooked",
        rawAnimalProduct: "no",
        evidenceIds: [],
      },
      evidence: [evidence("category-evidence")],
    });
    const [unsupported] = evaluatePregnancyRules(
      pregnancyProfile(),
      input,
    );
    const [supported] = evaluatePregnancyRules(pregnancyProfile(), {
      ...input,
      preparation: {
        ...input.preparation,
        evidenceIds: ["preparation-evidence"],
      },
      evidence: [
        ...input.evidence,
        evidence(
          "preparation-evidence",
          "userProvided",
          "confirmed",
          "The sprouts are fully cooked.",
        ),
      ],
    });

    expect(unsupported.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-doneness"],
    });
    expect(supported.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
    });
  });

  it("does not use unrelated cooking evidence to clear a sprout concern", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("sprouts")],
        preparation: {
          pasteurization: "notApplicable",
          doneness: "fullyCooked",
          rawAnimalProduct: "no",
          evidenceIds: ["preparation-evidence"],
        },
        evidence: [
          evidence("category-evidence"),
          evidence(
            "preparation-evidence",
            "userProvided",
            "confirmed",
            "The unrelated chicken is fully cooked.",
          ),
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-doneness"],
    });
  });

  it("does not treat an unrelated uncertainty as pregnancy-relevant", () => {
    const baseFacts = facts({
      ingredients: [ingredient("rice")],
      evidence: [evidence("category-evidence")],
    });
    const [evaluation] = evaluatePregnancyRules(pregnancyProfile(), {
      ...baseFacts,
      uncertainties: [
        {
          id: "uncertainty-color",
          subject: "Plate color",
          kind: "other",
          description: "The plate color is unclear.",
          safetyRelevance: "relevant",
          resolvableByUser: false,
          relatedFactIds: [],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "notApplicable",
      recommendedVerdict: null,
    });
  });

  it("applies an unlinked broad preparation gap only to applicable categories", () => {
    const baseFacts = facts({
      ingredients: [ingredient("chicken")],
      preparation: {
        pasteurization: "notApplicable",
        doneness: "unknown",
        rawAnimalProduct: "unknown",
        evidenceIds: [],
      },
      evidence: [evidence("category-evidence")],
    });
    const [evaluation] = evaluatePregnancyRules(pregnancyProfile(), {
      ...baseFacts,
      uncertainties: [
        {
          id: "uncertainty-preparation",
          subject: "Preparation",
          kind: "preparation",
          description: "Preparation is unknown.",
          safetyRelevance: "consequential",
          resolvableByUser: true,
          relatedFactIds: [],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
    });

    const unrelatedBase = facts({
      ingredients: [ingredient("rice")],
    });
    const [unrelatedEvaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      {
        ...unrelatedBase,
        uncertainties: [
          {
            id: "uncertainty-preparation",
            subject: "Preparation",
            kind: "preparation",
            description: "Preparation is unknown.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: [],
          },
        ],
      },
    );

    expect(unrelatedEvaluation.ruleMatch.status).toBe("notApplicable");
  });

  it("does not let a cleared pasteurization concern hide a raw egg hazard", () => {
    const evaluations = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk"), ingredient("egg")],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "raw",
          rawAnimalProduct: "yes",
          evidenceIds: ["preparation-evidence"],
        },
        evidence: [
          evidence("category-evidence"),
          evidence(
            "preparation-evidence",
            "userProvided",
            "confirmed",
            "The milk is pasteurized, but the food contains a raw egg.",
          ),
        ],
      }),
    );

    expect(evaluations).toHaveLength(2);
    expect(evaluations[0].ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
    });
    expect(evaluations[1].ruleMatch.recommendedVerdict).toBe("avoid");
  });

  it("does not let a user pasteurization answer clear an animal preparation gap", () => {
    const evaluations = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk"), ingredient("egg")],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "unknown",
          rawAnimalProduct: "unknown",
          evidenceIds: ["pasteurization-answer"],
        },
        evidence: [
          evidence("category-evidence"),
          {
            ...evidence("pasteurization-answer"),
            summary: "The user confirmed the product is pasteurized.",
          },
        ],
      }),
    );

    expect(evaluations[0].ruleMatch.status).toBe("cleared");
    expect(evaluations[1].ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["preparation-doneness"],
    });
  });

  it("keeps a relevant contradiction uncertain and includes competing evidence", () => {
    const baseFacts = facts({
      ingredients: [ingredient("milk")],
      preparation: {
        pasteurization: "pasteurized",
        doneness: "notApplicable",
        rawAnimalProduct: "unknown",
        evidenceIds: ["preparation-evidence"],
      },
      evidence: [
        evidence("category-evidence"),
        evidence(
          "preparation-evidence",
          "userProvided",
          "confirmed",
          "The product is pasteurized.",
        ),
        evidence("contradiction-evidence"),
      ],
    });
    const [evaluation] = evaluatePregnancyRules(pregnancyProfile(), {
      ...baseFacts,
      contradictions: [
        {
          id: "contradiction-pasteurization",
          factPath: "preparation.pasteurization",
          description: "Pasteurization claims conflict.",
          competingClaims: [
            {
              value: "pasteurized",
              evidenceIds: ["preparation-evidence"],
            },
            {
              value: "unpasteurized",
              evidenceIds: ["contradiction-evidence"],
            },
          ],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["contradiction-pasteurization"],
      evidenceIds: [
        "category-evidence",
        "preparation-evidence",
        "contradiction-evidence",
      ],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("deduplicates evidence and does not invent missing evidence", () => {
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [
          ingredient("milk", "confirmed", [
            "category-evidence",
            "category-evidence",
            "missing-evidence",
          ]),
        ],
        preparation: {
          pasteurization: "pasteurized",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: ["preparation-evidence", "preparation-evidence"],
        },
        evidence: [
          evidence("category-evidence"),
          evidence(
            "preparation-evidence",
            "userProvided",
            "confirmed",
            "The product is pasteurized.",
          ),
        ],
      }),
    );

    expect(evaluation.ruleMatch.evidenceIds).toEqual([
      "category-evidence",
      "missing-evidence",
      "preparation-evidence",
    ]);
    expect(evaluation.evidence.map(({ id }) => id)).toEqual([
      "category-evidence",
      "preparation-evidence",
    ]);
  });

  it("does not repeat a clarification after a user answers unknown", () => {
    const unknownAnswerEvidence = {
      ...evidence("unknown-answer", "userProvided", "unknown"),
      summary: "The user remains unsure about pasteurization.",
    } as const;
    const [evaluation] = evaluatePregnancyRules(
      pregnancyProfile(),
      facts({
        ingredients: [ingredient("milk")],
        preparation: {
          pasteurization: "unknown",
          doneness: "notApplicable",
          rawAnimalProduct: "unknown",
          evidenceIds: ["unknown-answer"],
        },
        evidence: [
          evidence("category-evidence"),
          unknownAnswerEvidence,
        ],
      }),
    );

    expect(evaluation.ruleMatch.recommendedVerdict).toBe(
      "needMoreInformation",
    );
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it.each([
    {
      category: "chicken",
      doneness: "unknown",
      rawAnimalProduct: "unknown",
      summary: "The user remains unsure about doneness.",
    },
    {
      category: "egg",
      doneness: "notApplicable",
      rawAnimalProduct: "unknown",
      summary: "The user remains unsure about a raw animal product.",
    },
  ] as const)(
    "does not repeat an animal clarification after an unknown answer",
    ({ category, doneness, rawAnimalProduct, summary }) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient(category)],
          preparation: {
            pasteurization: "notApplicable",
            doneness,
            rawAnimalProduct,
            evidenceIds: ["unknown-answer"],
          },
          evidence: [
            evidence("category-evidence"),
            {
              ...evidence(
                "unknown-answer",
                "userProvided",
                "unknown",
              ),
              summary,
            },
          ],
        }),
      );

      expect(evaluation.ruleMatch.recommendedVerdict).toBe(
        "needMoreInformation",
      );
      expect(evaluation.clarificationQuestion).toBeUndefined();
    },
  );

  it("keeps pregnancy week out of rule behavior", () => {
    const input = facts({
      ingredients: [ingredient("milk")],
      preparation: {
        pasteurization: "unpasteurized",
        doneness: "notApplicable",
        rawAnimalProduct: "unknown",
        evidenceIds: ["preparation-evidence"],
      },
      evidence: [
        evidence("category-evidence"),
        evidence(
          "preparation-evidence",
          "userProvided",
          "confirmed",
          "The product is unpasteurized.",
        ),
      ],
    });

    expect(evaluatePregnancyRules(pregnancyProfile(5), input)).toEqual(
      evaluatePregnancyRules(pregnancyProfile(35), input),
    );
  });

  it("supports pasteurization clarification round trips", () => {
    const unknownFacts = facts({
      ingredients: [ingredient("milk")],
      preparation: {
        pasteurization: "unknown",
        doneness: "notApplicable",
        rawAnimalProduct: "unknown",
        evidenceIds: [],
      },
      evidence: [evidence("category-evidence")],
    });
    const [initial] = evaluatePregnancyRules(
      pregnancyProfile(),
      unknownFacts,
    );

    expect(initial.clarificationQuestion).toBeDefined();

    const [cleared] = evaluatePregnancyRules(pregnancyProfile(), {
      ...unknownFacts,
      preparation: {
        ...unknownFacts.preparation,
        pasteurization: "pasteurized",
        evidenceIds: ["answer"],
      },
      evidence: [
        ...unknownFacts.evidence,
        {
          ...evidence("answer"),
          summary: "The user confirmed the product is pasteurized.",
        },
      ],
    });
    const [triggered] = evaluatePregnancyRules(pregnancyProfile(), {
      ...unknownFacts,
      preparation: {
        ...unknownFacts.preparation,
        pasteurization: "unpasteurized",
        evidenceIds: ["answer"],
      },
      evidence: [
        ...unknownFacts.evidence,
        {
          ...evidence("answer"),
          summary: "The user confirmed unpasteurized status.",
        },
      ],
    });

    expect(cleared.ruleMatch.status).toBe("cleared");
    expect(triggered.ruleMatch.recommendedVerdict).toBe("avoid");
  });

  it("supports doneness clarification round trips", () => {
    const unknownFacts = facts({
      ingredients: [ingredient("chicken")],
      preparation: {
        pasteurization: "notApplicable",
        doneness: "unknown",
        rawAnimalProduct: "unknown",
        evidenceIds: [],
      },
      evidence: [evidence("category-evidence")],
    });
    const [initial] = evaluatePregnancyRules(
      pregnancyProfile(),
      unknownFacts,
    );
    const [cleared] = evaluatePregnancyRules(pregnancyProfile(), {
      ...unknownFacts,
      preparation: {
        ...unknownFacts.preparation,
        doneness: "fullyCooked",
        evidenceIds: ["answer"],
      },
      evidence: [
        ...unknownFacts.evidence,
        {
          ...evidence("answer"),
          summary: "The user confirmed the food is fully cooked.",
        },
      ],
    });
    const [triggered] = evaluatePregnancyRules(pregnancyProfile(), {
      ...unknownFacts,
      preparation: {
        ...unknownFacts.preparation,
        doneness: "undercooked",
        evidenceIds: ["answer"],
      },
      evidence: [
        ...unknownFacts.evidence,
        {
          ...evidence("answer"),
          summary: "The user confirmed the food is undercooked.",
        },
      ],
    });

    expect(initial.clarificationQuestion).toBeDefined();
    expect(cleared.ruleMatch.status).toBe("cleared");
    expect(triggered.ruleMatch.recommendedVerdict).toBe("avoid");
  });

  it("supports raw-animal-status clarification round trips", () => {
    const unknownFacts = facts({
      ingredients: [ingredient("egg")],
      preparation: {
        pasteurization: "notApplicable",
        doneness: "notApplicable",
        rawAnimalProduct: "unknown",
        evidenceIds: [],
      },
      evidence: [evidence("category-evidence")],
    });
    const [initial] = evaluatePregnancyRules(
      pregnancyProfile(),
      unknownFacts,
    );
    const [cleared] = evaluatePregnancyRules(pregnancyProfile(), {
      ...unknownFacts,
      preparation: {
        ...unknownFacts.preparation,
        rawAnimalProduct: "no",
        evidenceIds: ["answer"],
      },
      evidence: [
        ...unknownFacts.evidence,
        {
          ...evidence("answer"),
          summary: "The user confirmed there is no raw animal product.",
        },
      ],
    });
    const [triggered] = evaluatePregnancyRules(pregnancyProfile(), {
      ...unknownFacts,
      preparation: {
        ...unknownFacts.preparation,
        rawAnimalProduct: "yes",
        evidenceIds: ["answer"],
      },
      evidence: [
        ...unknownFacts.evidence,
        {
          ...evidence("answer"),
          summary: "The user confirmed the food contains a raw animal product.",
        },
      ],
    });

    expect(
      initial.clarificationQuestion?.answerOptions[0].patch.kind,
    ).toBe("setRawAnimalProduct");
    expect(cleared.ruleMatch.status).toBe("cleared");
    expect(triggered.ruleMatch.recommendedVerdict).toBe("avoid");
  });

  it.each([
    {
      name: "negated raw presence",
      category: "egg",
      pasteurization: "notApplicable",
      doneness: "raw",
      rawAnimalProduct: "unknown",
      summary: "The food does not contain raw egg.",
    },
    {
      name: "absent raw ingredient",
      category: "egg",
      pasteurization: "notApplicable",
      doneness: "raw",
      rawAnimalProduct: "unknown",
      summary: "Raw egg is absent.",
    },
    {
      name: "unknown raw status",
      category: "egg",
      pasteurization: "notApplicable",
      doneness: "raw",
      rawAnimalProduct: "unknown",
      summary: "Raw status is unknown.",
    },
    {
      name: "unconfirmed raw status",
      category: "egg",
      pasteurization: "notApplicable",
      doneness: "raw",
      rawAnimalProduct: "unknown",
      summary: "Not confirmed to be raw.",
    },
    {
      name: "unknown undercooked status",
      category: "meat",
      pasteurization: "notApplicable",
      doneness: "undercooked",
      rawAnimalProduct: "unknown",
      summary: "Undercooked status unknown.",
    },
    {
      name: "unconfirmed undercooked status",
      category: "meat",
      pasteurization: "notApplicable",
      doneness: "undercooked",
      rawAnimalProduct: "unknown",
      summary: "Not confirmed undercooked.",
    },
    {
      name: "unknown fully cooked status",
      category: "chicken",
      pasteurization: "notApplicable",
      doneness: "fullyCooked",
      rawAnimalProduct: "unknown",
      summary: "Fully cooked status unknown.",
    },
    {
      name: "possible fully cooked status",
      category: "chicken",
      pasteurization: "notApplicable",
      doneness: "fullyCooked",
      rawAnimalProduct: "unknown",
      summary: "The chicken may be fully cooked.",
    },
    {
      name: "unknown pasteurized status",
      category: "milk",
      pasteurization: "pasteurized",
      doneness: "notApplicable",
      rawAnimalProduct: "unknown",
      summary: "Pasteurized status unknown.",
    },
    {
      name: "possible pasteurized status",
      category: "milk",
      pasteurization: "pasteurized",
      doneness: "notApplicable",
      rawAnimalProduct: "unknown",
      summary: "The milk may be pasteurized.",
    },
    {
      name: "absence of unpasteurized ingredients",
      category: "milk",
      pasteurization: "unpasteurized",
      doneness: "notApplicable",
      rawAnimalProduct: "unknown",
      summary: "No unpasteurized ingredients.",
    },
    {
      name: "unknown unpasteurized status",
      category: "milk",
      pasteurization: "unpasteurized",
      doneness: "notApplicable",
      rawAnimalProduct: "unknown",
      summary: "Unpasteurized status unknown.",
    },
  ] as const)(
    "rejects $name as exact preparation evidence",
    ({
      category,
      pasteurization,
      doneness,
      rawAnimalProduct,
      summary,
    }) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient(category)],
          preparation: {
            pasteurization,
            doneness,
            rawAnimalProduct,
            evidenceIds: ["preparation-evidence"],
          },
          evidence: [
            evidence("category-evidence"),
            evidence(
              "preparation-evidence",
              "userProvided",
              "confirmed",
              summary,
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
    {
      name: "pasteurized",
      category: "milk",
      pasteurization: "pasteurized",
      doneness: "notApplicable",
      rawAnimalProduct: "unknown",
      summary: "Made with pasteurized milk.",
      expectedStatus: "cleared",
      expectedVerdict: null,
    },
    {
      name: "unpasteurized",
      category: "juice",
      pasteurization: "unpasteurized",
      doneness: "notApplicable",
      rawAnimalProduct: "unknown",
      summary: "This juice is unpasteurized.",
      expectedStatus: "triggered",
      expectedVerdict: "avoid",
    },
    {
      name: "fully cooked",
      category: "chicken",
      pasteurization: "notApplicable",
      doneness: "fullyCooked",
      rawAnimalProduct: "unknown",
      summary: "The chicken is fully cooked.",
      expectedStatus: "cleared",
      expectedVerdict: null,
    },
    {
      name: "undercooked",
      category: "meat",
      pasteurization: "notApplicable",
      doneness: "undercooked",
      rawAnimalProduct: "unknown",
      summary: "The meat is undercooked.",
      expectedStatus: "triggered",
      expectedVerdict: "avoid",
    },
    {
      name: "raw animal product present",
      category: "egg",
      pasteurization: "notApplicable",
      doneness: "notApplicable",
      rawAnimalProduct: "yes",
      summary: "Contains raw egg.",
      expectedStatus: "triggered",
      expectedVerdict: "avoid",
    },
    {
      name: "raw animal product absent",
      category: "egg",
      pasteurization: "notApplicable",
      doneness: "notApplicable",
      rawAnimalProduct: "no",
      summary: "Does not contain raw egg.",
      expectedStatus: "cleared",
      expectedVerdict: null,
    },
  ] as const)(
    "accepts explicit affirmative $name evidence",
    ({
      category,
      pasteurization,
      doneness,
      rawAnimalProduct,
      summary,
      expectedStatus,
      expectedVerdict,
    }) => {
      const [evaluation] = evaluatePregnancyRules(
        pregnancyProfile(),
        facts({
          ingredients: [ingredient(category)],
          preparation: {
            pasteurization,
            doneness,
            rawAnimalProduct,
            evidenceIds: ["preparation-evidence"],
          },
          evidence: [
            evidence("category-evidence"),
            evidence(
              "preparation-evidence",
              "userProvided",
              "confirmed",
              summary,
            ),
          ],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: expectedStatus,
        recommendedVerdict: expectedVerdict,
      });
    },
  );
});
