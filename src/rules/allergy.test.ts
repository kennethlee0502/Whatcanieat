import { describe, expect, it } from "vitest";

import type { ExtractedFoodFacts, IngredientEvidence } from "@/domain/food";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  allergyRuleDefinitions,
  evaluateAllergyRules,
} from "@/rules/allergy";
import { safetyRuleDefinitionSchema } from "@/rules/provenance";

const profile = (
  severity?: "mild" | "moderate" | "severe",
): AnalysisProfileContext => ({
  allergies: [{ allergenId: "peanut", severity }],
});

const ingredient = (
  presence: IngredientEvidence["presence"],
  evidenceIds = ["evidence-1"],
): IngredientEvidence => ({
  id: `peanut-${presence}`,
  ingredientId: "peanut",
  displayName: "Peanut",
  presence,
  evidenceIds,
});

const facts = ({
  ingredients = [],
  evidence = [],
  labels = [],
}: Partial<
  Pick<ExtractedFoodFacts, "ingredients" | "evidence" | "labels">
> = {}): ExtractedFoodFacts => ({
  schemaVersion: 1,
  imageSuitability: "foodDetected",
  foodCandidates: [],
  primaryFoodId: null,
  ingredients,
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
  labels,
  evidence,
  uncertainties: [],
  contradictions: [],
  extractionConfidence: "medium",
});

const confirmedLabelEvidence = {
  id: "evidence-1",
  source: "readableOnLabel",
  strength: "confirmed",
  summary: "The ingredient list provides this fact.",
} as const;

describe("allergy rules", () => {
  it("ships only complete, version-consistent provenance", () => {
    expect(allergyRuleDefinitions).toHaveLength(5);

    for (const definition of allergyRuleDefinitions) {
      expect(safetyRuleDefinitionSchema.safeParse(definition).success).toBe(
        true,
      );
      expect(definition.provenance.ruleVersion).toBe(definition.version);
    }
  });

  it.each(["mild", "moderate", "severe"] as const)(
    "returns Avoid for confirmed presence regardless of %s severity",
    (severity) => {
      const [evaluation] = evaluateAllergyRules(
        profile(severity),
        facts({
          ingredients: [ingredient("confirmed")],
          evidence: [confirmedLabelEvidence],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "triggered",
        risk: "critical",
        recommendedVerdict: "avoid",
        evidenceIds: ["evidence-1"],
      });
      expect(evaluation.clarificationQuestion).toBeUndefined();
    },
  );

  it("returns Avoid for confirmed presence with unspecified severity", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("confirmed")],
        evidence: [confirmedLabelEvidence],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      risk: "critical",
      recommendedVerdict: "avoid",
    });
  });

  it.each(["likely", "possible", "unknown"] as const)(
    "keeps %s presence uncertain",
    (presence) => {
      const [evaluation] = evaluateAllergyRules(
        profile(),
        facts({
          ingredients: [ingredient(presence)],
          evidence: [
            {
              ...confirmedLabelEvidence,
              strength: presence === "likely" ? "likely" : "possible",
            },
          ],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "uncertain",
        recommendedVerdict: "needMoreInformation",
      });
      expect(evaluation.clarificationQuestion).toBeDefined();
    },
  );

  it("returns Avoid for an explicit matching may-contain advisory", () => {
    const advisoryEvidence = {
      id: "evidence-1",
      source: "readableOnLabel",
      strength: "possible",
      summary: "The package says it may contain peanut.",
    } as const;
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("possible")],
        evidence: [advisoryEvidence],
        labels: [
          {
            id: "label-1",
            text: "May contain peanuts.",
            legibility: "readable",
            evidenceIds: ["evidence-1"],
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "avoid",
      reasonKey: "allergy-explicit-advisory",
      evidenceIds: ["evidence-1"],
    });
    expect(evaluation.evidence).toEqual([advisoryEvidence]);
    expect(evaluation.ruleMatch.reasonKey).not.toBe(
      "allergy-confirmed-ingredient",
    );
  });

  it.each([
    "Made in a facility that also processes peanuts.",
    "Manufactured in a facility where peanuts are processed.",
    "Produced in a facility with peanuts.",
  ])("returns Avoid for an explicit matching facility advisory: %s", (text) => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        labels: [
          {
            id: "label-1",
            text,
            legibility: "readable",
            evidenceIds: ["evidence-1"],
          },
        ],
        evidence: [
          {
            id: "evidence-1",
            source: "readableOnLabel",
            strength: "confirmed",
            summary: "A facility advisory explicitly names peanuts.",
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "avoid",
      reasonKey: "allergy-explicit-advisory",
    });
  });

  it.each([
    "Made in a facility free from peanuts.",
    "Made in a facility that does not process peanuts.",
    "Produced in a facility with no peanuts.",
    "Made in a peanut-free facility.",
  ])("does not treat negated facility wording as an advisory: %s", (text) => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        labels: [
          {
            id: "label-1",
            text,
            legibility: "readable",
            evidenceIds: ["evidence-1"],
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "notApplicable",
      recommendedVerdict: null,
    });
  });

  it("keeps a general or inferred cross-contact possibility uncertain", () => {
    const baseFacts = facts({
      evidence: [
          {
            id: "evidence-1",
            source: "conventionalInference",
            strength: "possible",
            summary: "Shared equipment is possible, but no advisory is visible.",
          },
        ],
    });
    const [evaluation] = evaluateAllergyRules(profile(), {
      ...baseFacts,
      uncertainties: [
        {
          id: "uncertainty-cross-contact",
          subject: "Peanut cross-contact",
          kind: "ingredient",
          description: "Shared equipment use cannot be ruled out.",
          safetyRelevance: "consequential",
          resolvableByUser: false,
          relatedFactIds: ["evidence-1"],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      evidenceIds: ["evidence-1"],
      missingFactIds: ["uncertainty-cross-contact"],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("clears only explicit absence supported by reliable evidence", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent")],
        evidence: [confirmedLabelEvidence],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
      evidenceConfidence: "high",
    });
    expect(evaluation).not.toHaveProperty("verdict");
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("clears user-confirmed absence when no independent risk remains", () => {
    const userEvidence = {
      id: "evidence-user",
      source: "userProvided",
      strength: "confirmed",
      summary: "The preparer confirmed peanut is absent.",
    } as const;
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent", ["evidence-user"])],
        evidence: [userEvidence],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
      evidenceIds: ["evidence-user"],
    });
    expect(evaluation.evidence).toEqual([userEvidence]);
  });

  it("lets reliable absence resolve partial ingredient information", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent")],
        evidence: [confirmedLabelEvidence],
        labels: [
          {
            id: "label-partial",
            text: "Ingredients: rice,",
            legibility: "partial",
            evidenceIds: ["evidence-1"],
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
      missingFactIds: [],
    });
  });

  it("does not let reliable absence override a relevant contradiction", () => {
    const competingEvidence = {
      id: "evidence-2",
      source: "conventionalInference",
      strength: "possible",
      summary: "Another observation indicates peanut may be present.",
    } as const;
    const baseFacts = facts({
      ingredients: [ingredient("absent")],
      evidence: [confirmedLabelEvidence, competingEvidence],
    });
    const [evaluation] = evaluateAllergyRules(profile(), {
      ...baseFacts,
      contradictions: [
        {
          id: "contradiction-peanut",
          factPath: "ingredients.peanut",
          description: "Peanut claims conflict.",
          competingClaims: [
            { value: "absent", evidenceIds: ["evidence-1"] },
            { value: "possible", evidenceIds: ["evidence-2"] },
          ],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["contradiction-peanut"],
      evidenceIds: ["evidence-1", "evidence-2"],
    });
    expect(evaluation.evidence).toEqual([
      confirmedLabelEvidence,
      competingEvidence,
    ]);
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("does not let reliable absence override inferred cross-contact uncertainty", () => {
    const baseFacts = facts({
      ingredients: [ingredient("absent")],
      evidence: [confirmedLabelEvidence],
    });
    const [evaluation] = evaluateAllergyRules(profile(), {
      ...baseFacts,
      uncertainties: [
        {
          id: "uncertainty-cross-contact",
          subject: "Cross-contact",
          kind: "ingredient",
          description: "Shared processing for peanut could not be ruled out.",
          safetyRelevance: "consequential",
          resolvableByUser: true,
          relatedFactIds: ["peanut-absent"],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["uncertainty-cross-contact"],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("lets an explicit advisory take priority over reliable absence", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent")],
        evidence: [confirmedLabelEvidence],
        labels: [
          {
            id: "label-advisory",
            text: "May contain peanuts.",
            legibility: "readable",
            evidenceIds: ["evidence-1"],
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "avoid",
      reasonKey: "allergy-explicit-advisory",
    });
  });

  it("does not claim explicit absence guarantees overall safety", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent")],
        evidence: [confirmedLabelEvidence],
      }),
    );
    const absenceDefinition = allergyRuleDefinitions.find(
      (definition) => definition.id === evaluation.ruleMatch.rule.id,
    );

    expect(evaluation.ruleMatch.status).toBe("cleared");
    expect(evaluation).not.toHaveProperty("verdict");
    expect(
      absenceDefinition?.provenance.scopeLimitations.join(" "),
    ).toMatch(/does not guarantee/i);
  });

  it.each([
    {
      source: "visibleInImage",
      strength: "confirmed",
      summary: "Peanut is not visible.",
    },
    {
      source: "readableOnLabel",
      strength: "possible",
      summary: "Only part of the label is readable.",
    },
  ] as const)(
    "does not clear absence from $source/$strength evidence",
    (unsupportedEvidence) => {
      const [evaluation] = evaluateAllergyRules(
        profile(),
        facts({
          ingredients: [ingredient("absent")],
          evidence: [{ id: "evidence-1", ...unsupportedEvidence }],
        }),
      );

      expect(evaluation.ruleMatch).toMatchObject({
        status: "uncertain",
        recommendedVerdict: "needMoreInformation",
      });
    },
  );

  it("treats missing, unreadable, and unobserved information as unknown", () => {
    const unreadableEvidence = {
      id: "evidence-unreadable",
      source: "visibleInImage",
      strength: "confirmed",
      summary: "A label is present but cannot be read.",
    } as const;
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        labels: [
          {
            id: "label-1",
            legibility: "unreadable",
            evidenceIds: ["evidence-unreadable"],
          },
        ],
        evidence: [unreadableEvidence],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      evidenceIds: ["evidence-unreadable"],
      missingFactIds: ["label-1"],
    });
    expect(evaluation.evidence).toEqual([unreadableEvidence]);
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("does not let reliable absence resolve an unreadable unknown-scope label", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent")],
        evidence: [confirmedLabelEvidence],
        labels: [
          {
            id: "label-unreadable",
            legibility: "unreadable",
            evidenceIds: [],
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["label-unreadable"],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("treats a partial matching advisory as independent uncertainty", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent")],
        evidence: [confirmedLabelEvidence],
        labels: [
          {
            id: "label-partial-advisory",
            text: "May contain peanut…",
            legibility: "partial",
            evidenceIds: ["evidence-1"],
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["label-partial-advisory"],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("returns a non-contributing match for a fully characterized non-match", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [
          {
            id: "ingredient-rice",
            ingredientId: "rice",
            displayName: "Rice",
            presence: "confirmed",
            evidenceIds: ["evidence-1"],
          },
        ],
        labels: [
          {
            id: "label-1",
            text: "Ingredients: rice.",
            legibility: "readable",
            evidenceIds: ["evidence-1"],
          },
        ],
        evidence: [confirmedLabelEvidence],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "notApplicable",
      recommendedVerdict: null,
      missingFactIds: [],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("asks for more information for a plausible hidden-ingredient gap", () => {
    const incompleteFacts = facts();
    const [evaluation] = evaluateAllergyRules(profile(), {
      ...incompleteFacts,
      uncertainties: [
        {
          id: "uncertainty-sauce",
          subject: "Sauce ingredients",
          kind: "ingredient",
          description: "The ingredients in the sauce are unknown.",
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
    expect(evaluation.clarificationQuestion).toBeDefined();
  });

  it("applies an uncertainty linked to a peanut ingredient only to peanut", () => {
    const baseFacts = facts({
      ingredients: [
        {
          id: "ingredient-peanut",
          ingredientId: "peanut",
          displayName: "Peanut",
          presence: "unknown",
          evidenceIds: [],
        },
      ],
    });
    const evaluations = evaluateAllergyRules(
      {
        allergies: [{ allergenId: "peanut" }, { allergenId: "milk" }],
      },
      {
        ...baseFacts,
        uncertainties: [
          {
            id: "uncertainty-peanut",
            subject: "Ingredient detail",
            kind: "ingredient",
            description: "The linked ingredient remains unknown.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: ["ingredient-peanut"],
          },
        ],
      },
    );

    expect(evaluations[0].ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
    });
    expect(evaluations[1].ruleMatch).toMatchObject({
      status: "notApplicable",
      recommendedVerdict: null,
    });
  });

  it("does not apply a specifically linked garnish uncertainty to any allergy", () => {
    const baseFacts = facts();
    const evaluations = evaluateAllergyRules(
      {
        allergies: [{ allergenId: "peanut" }, { allergenId: "milk" }],
      },
      {
        ...baseFacts,
        uncertainties: [
          {
            id: "uncertainty-garnish",
            subject: "tomato garnish",
            kind: "ingredient",
            description: "Unknown ingredient in garnish",
            safetyRelevance: "relevant",
            resolvableByUser: false,
            relatedFactIds: ["ingredient-tomato-garnish"],
          },
        ],
      },
    );

    expect(evaluations).toHaveLength(2);
    for (const evaluation of evaluations) {
      expect(evaluation.ruleMatch).toMatchObject({
        status: "notApplicable",
        recommendedVerdict: null,
      });
    }
  });

  it("applies a broad hidden-ingredient uncertainty to all selected allergies", () => {
    const baseFacts = facts();
    const evaluations = evaluateAllergyRules(
      {
        allergies: [{ allergenId: "peanut" }, { allergenId: "milk" }],
      },
      {
        ...baseFacts,
        uncertainties: [
          {
            id: "uncertainty-ingredients",
            subject: "Ingredients",
            kind: "ingredient",
            description: "Complete ingredient information is unavailable.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: [],
          },
        ],
      },
    );

    expect(evaluations).toHaveLength(2);
    for (const evaluation of evaluations) {
      expect(evaluation.ruleMatch).toMatchObject({
        status: "uncertain",
        recommendedVerdict: "needMoreInformation",
        missingFactIds: ["uncertainty-ingredients"],
      });
    }
  });

  it("applies an explicitly milk-specific uncertainty only to milk", () => {
    const evaluations = evaluateAllergyRules(
      {
        allergies: [{ allergenId: "peanut" }, { allergenId: "milk" }],
      },
      {
        ...facts(),
        uncertainties: [
          {
            id: "uncertainty-milk",
            subject: "Milk",
            kind: "ingredient",
            description: "Milk presence is unknown.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: [],
          },
        ],
      },
    );

    expect(evaluations[0].ruleMatch).toMatchObject({
      status: "notApplicable",
      recommendedVerdict: null,
    });
    expect(evaluations[1].ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
    });
  });

  it("clears a presence gap after applying confirmed-absent clarification", () => {
    const incompleteFacts = facts();
    const factsWithGap: ExtractedFoodFacts = {
      ...incompleteFacts,
      labels: [
        {
          id: "label-partial",
          text: "Ingredients:",
          legibility: "partial",
          evidenceIds: [],
        },
      ],
    };
    const [initialEvaluation] = evaluateAllergyRules(profile(), factsWithGap);
    const absencePatch =
      initialEvaluation.clarificationQuestion?.answerOptions.find(
        (option) => option.patch.value === "absent",
      )?.patch;

    expect(initialEvaluation.ruleMatch.recommendedVerdict).toBe(
      "needMoreInformation",
    );
    expect(absencePatch).toMatchObject({
      kind: "setIngredientPresence",
      ingredientId: "peanut",
      value: "absent",
      source: "userProvided",
    });

    const factsAfterAnswer: ExtractedFoodFacts = {
      ...factsWithGap,
      ingredients: [
        {
          id: "peanut-user-answer",
          ingredientId: "peanut",
          displayName: "Peanut",
          presence: "absent",
          evidenceIds: ["evidence-user-answer"],
        },
      ],
      evidence: [
        {
          id: "evidence-user-answer",
          source: "userProvided",
          strength: "confirmed",
          summary: "The user confirmed peanut is absent.",
        },
      ],
    };
    const [revisedEvaluation] = evaluateAllergyRules(
      profile(),
      factsAfterAnswer,
    );

    expect(revisedEvaluation.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
    });
  });

  it("does not let confirmed absence clear allergen-specific cross-contact risk", () => {
    const baseFacts = facts({
      ingredients: [ingredient("absent", ["evidence-user-answer"])],
      evidence: [
        {
          id: "evidence-user-answer",
          source: "userProvided",
          strength: "confirmed",
          summary: "The user confirmed peanut is absent as an ingredient.",
        },
      ],
    });
    const [evaluation] = evaluateAllergyRules(profile(), {
      ...baseFacts,
      uncertainties: [
        {
          id: "uncertainty-cross-contact",
          subject: "Peanut cross-contact",
          kind: "ingredient",
          description: "Shared equipment cannot be ruled out.",
          safetyRelevance: "consequential",
          resolvableByUser: false,
          relatedFactIds: ["peanut-absent"],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["uncertainty-cross-contact"],
    });
  });

  it("omits a presence clarification when an independent risk also remains", () => {
    const baseFacts = facts({
      ingredients: [ingredient("unknown", [])],
    });
    const [evaluation] = evaluateAllergyRules(profile(), {
      ...baseFacts,
      uncertainties: [
        {
          id: "uncertainty-cross-contact",
          subject: "Peanut cross-contact",
          kind: "ingredient",
          description: "Shared equipment cannot be ruled out.",
          safetyRelevance: "consequential",
          resolvableByUser: false,
          relatedFactIds: ["peanut-unknown"],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "needMoreInformation",
      missingFactIds: ["uncertainty-cross-contact", "peanut-unknown"],
    });
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("lets confirmed presence dominate conflicting absent evidence", () => {
    const [evaluation] = evaluateAllergyRules(
      profile(),
      facts({
        ingredients: [ingredient("absent"), ingredient("confirmed")],
        evidence: [confirmedLabelEvidence],
      }),
    );

    expect(evaluation.ruleMatch.recommendedVerdict).toBe("avoid");
  });

  it("produces a constrained clarification that preserves uncertainty", () => {
    const incompleteFacts = facts();
    const [evaluation] = evaluateAllergyRules(profile(), {
      ...incompleteFacts,
      uncertainties: [
        {
          id: "uncertainty-ingredients",
          subject: "Ingredients",
          kind: "ingredient",
          description: "The complete ingredient information is unavailable.",
          safetyRelevance: "consequential",
          resolvableByUser: true,
          relatedFactIds: [],
        },
      ],
    });

    expect(evaluation.clarificationQuestion).toMatchObject({
      relatedRuleIds: ["allergy-ingredient-uncertain"],
      relatedFactIds: ["uncertainty-ingredients"],
      answerOptions: [
        {
          patch: {
            kind: "setIngredientPresence",
            ingredientId: "peanut",
            value: "confirmed",
            source: "userProvided",
          },
        },
        {
          patch: {
            kind: "setIngredientPresence",
            ingredientId: "peanut",
            value: "absent",
            source: "userProvided",
          },
        },
        {
          patch: {
            kind: "setIngredientPresence",
            ingredientId: "peanut",
            value: "unknown",
            source: "userProvided",
          },
        },
      ],
    });
  });

  it("evaluates each selected allergy independently", () => {
    const evaluations = evaluateAllergyRules(
      {
        allergies: [{ allergenId: "peanut" }, { allergenId: "sesame" }],
      },
      {
        ...facts({
        ingredients: [ingredient("confirmed")],
        evidence: [confirmedLabelEvidence],
        }),
        uncertainties: [
          {
            id: "uncertainty-sesame",
            subject: "Other ingredients",
            kind: "ingredient",
            description: "Other ingredients may not be visible.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: [],
          },
        ],
      },
    );

    expect(evaluations).toHaveLength(2);
    expect(evaluations[0].ruleMatch.recommendedVerdict).toBe("avoid");
    expect(evaluations[1].ruleMatch.recommendedVerdict).toBe(
      "needMoreInformation",
    );
  });

  it("returns no matches when the profile has no allergies", () => {
    expect(evaluateAllergyRules({}, facts())).toEqual([]);
  });
});
