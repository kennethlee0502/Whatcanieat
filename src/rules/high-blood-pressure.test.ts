import { describe, expect, it } from "vitest";

import type { ExtractedFoodFacts } from "@/domain/food";
import {
  evaluateHighBloodPressureRules,
  HIGH_SODIUM_MILLIGRAMS_PER_SERVING,
  highBloodPressureRuleDefinitions,
} from "@/rules/high-blood-pressure";
import { safetyRuleDefinitionSchema } from "@/rules/provenance";

const profile = { highBloodPressure: true } as const;

const evidence = (
  id: string,
  summary: string,
  source:
    | "readableOnLabel"
    | "visibleInImage"
    | "conventionalInference"
    | "userProvided" = "readableOnLabel",
  strength: "confirmed" | "likely" | "possible" | "unknown" = "confirmed",
) => ({ id, source, strength, summary } as const);

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

const labeledSodiumFacts = (
  sodiumMilligrams: number,
  summary = `The Nutrition Facts label lists sodium ${sodiumMilligrams} mg per serving.`,
) =>
  facts({
    nutrition: {
      sodiumLevel: sodiumMilligrams >= 460 ? "high" : "moderate",
      sodiumMilligrams,
      servingDescription: "1 serving",
      highlyProcessed: "unknown",
      evidenceIds: ["sodium-label"],
    },
    evidence: [evidence("sodium-label", summary)],
  });

describe("high-blood-pressure sodium rules", () => {
  it("ships version-consistent authoritative provenance", () => {
    expect(highBloodPressureRuleDefinitions).toHaveLength(5);
    for (const definition of highBloodPressureRuleDefinitions) {
      expect(safetyRuleDefinitionSchema.safeParse(definition).success).toBe(
        true,
      );
      expect(definition.version).toBe(definition.provenance.ruleVersion);
      expect(definition.restriction).toBe("highBloodPressure");
    }
  });

  it("uses an inclusive 460 mg high-sodium threshold", () => {
    expect(HIGH_SODIUM_MILLIGRAMS_PER_SERVING).toBe(460);

    const [below] = evaluateHighBloodPressureRules(
      profile,
      labeledSodiumFacts(459),
    );
    const [at] = evaluateHighBloodPressureRules(
      profile,
      labeledSodiumFacts(460),
    );

    expect(below.ruleMatch).toMatchObject({
      status: "cleared",
      recommendedVerdict: null,
    });
    expect(at.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "safeWithCaution",
      reasonKey: "high-blood-pressure-high-sodium-label",
    });
  });

  it("returns no evaluation when high blood pressure is not selected", () => {
    expect(evaluateHighBloodPressureRules({}, labeledSodiumFacts(600))).toEqual(
      [],
    );
  });

  it("requires confirmed readable-label evidence for an exact amount", () => {
    for (const [source, strength] of [
      ["visibleInImage", "confirmed"],
      ["readableOnLabel", "likely"],
      ["conventionalInference", "confirmed"],
    ] as const) {
      const input = labeledSodiumFacts(600);
      const [evaluation] = evaluateHighBloodPressureRules(profile, {
        ...input,
        evidence: [
          evidence(
            "sodium-label",
            "Sodium 600 mg per serving.",
            source,
            strength,
          ),
        ],
      });

      expect(evaluation.ruleMatch.status).toBe("notApplicable");
    }
  });

  it.each([
    "Sodium may be 600 mg per serving.",
    "Sodium is approximately 600 mg per serving.",
    "No evidence confirms sodium 600 mg per serving.",
    "Sodium 600 mg, serving basis unknown.",
  ])("rejects non-affirmative exact evidence: %s", (summary) => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      labeledSodiumFacts(600, summary),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it.each([
    "Nutrition Facts: Potassium 600 mg per serving.",
    "Sodium is 100 mg per serving. Potassium is 600 mg per serving.",
    "Calories are 600 per serving; sodium is 100 mg per serving.",
    "Cholesterol is 600 mg per serving and sodium is 100 mg per serving.",
  ])("does not bind another nutrient's value to sodium: %s", (summary) => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      labeledSodiumFacts(600, summary),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it.each([
    "The label lists 600 mg of sodium per serving.",
    "Each serving contains 600 mg sodium.",
  ])("accepts a locally bound reordered sodium amount: %s", (summary) => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      labeledSodiumFacts(600, summary),
    );
    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "safeWithCaution",
    });
  });

  it("distinguishes per-serving evidence from whole-package evidence", () => {
    const [perServing] = evaluateHighBloodPressureRules(
      profile,
      labeledSodiumFacts(600, "Sodium is 600 mg per serving."),
    );
    const [wholePackage] = evaluateHighBloodPressureRules(
      profile,
      labeledSodiumFacts(
        600,
        "Sodium is 600 mg for the whole package.",
      ),
    );

    expect(perServing.ruleMatch.status).toBe("triggered");
    expect(wholePackage.ruleMatch.status).toBe("notApplicable");
  });

  it("requires a serving description for numeric evaluation", () => {
    const input = labeledSodiumFacts(600);
    const [evaluation] = evaluateHighBloodPressureRules(profile, {
      ...input,
      nutrition: {
        sodiumLevel: "high",
        sodiumMilligrams: 600,
        highlyProcessed: "unknown",
        evidenceIds: ["sodium-label"],
      },
    });
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it("gives consequential sodium uncertainty precedence over a coarse high signal", () => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      facts({
        nutrition: {
          sodiumLevel: "high",
          highlyProcessed: "unknown",
          evidenceIds: ["coarse"],
        },
        evidence: [
          evidence(
            "coarse",
            "The food is high in sodium.",
            "visibleInImage",
            "likely",
          ),
        ],
        uncertainties: [
          {
            id: "unreadable-sodium",
            subject: "Nutrition Facts sodium",
            kind: "labelReadability",
            description: "The sodium line is unreadable.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: ["nutrition-sodium"],
          },
        ],
      }),
    );

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      recommendedVerdict: "safeWithCaution",
      reasonKey: "high-blood-pressure-sodium-uncertain",
      missingFactIds: ["unreadable-sodium"],
    });
  });

  it("allows reliable exact label evidence to precede a separate label gap", () => {
    const input = labeledSodiumFacts(500);
    const [evaluation] = evaluateHighBloodPressureRules(profile, {
      ...input,
      uncertainties: [
        {
          id: "unreadable-sodium",
          subject: "Nutrition Facts sodium",
          kind: "labelReadability",
          description: "Another sodium panel is unreadable.",
          safetyRelevance: "consequential",
          resolvableByUser: false,
          relatedFactIds: [],
        },
      ],
    });
    expect(evaluation.ruleMatch.reasonKey).toBe(
      "high-blood-pressure-high-sodium-label",
    );
  });

  it("treats a relevant sodium contradiction as uncertainty", () => {
    const input = labeledSodiumFacts(600);
    const [evaluation] = evaluateHighBloodPressureRules(profile, {
      ...input,
      evidence: [
        ...input.evidence,
        evidence("low-claim", "Sodium is 100 mg per serving."),
      ],
      contradictions: [
        {
          id: "sodium-conflict",
          factPath: "nutrition.sodiumMilligrams",
          description: "Two sodium amounts conflict.",
          competingClaims: [
            { value: "600", evidenceIds: ["sodium-label"] },
            { value: "100", evidenceIds: ["low-claim"] },
          ],
        },
      ],
    });

    expect(evaluation.ruleMatch).toMatchObject({
      status: "uncertain",
      missingFactIds: ["sodium-conflict"],
      recommendedVerdict: "safeWithCaution",
    });
  });

  it("does not let unrelated uncertainty or contradiction contaminate sodium", () => {
    const input = labeledSodiumFacts(500);
    const [evaluation] = evaluateHighBloodPressureRules(profile, {
      ...input,
      uncertainties: [
        {
          id: "ingredient-gap",
          subject: "Tomato garnish",
          kind: "ingredient",
          description: "The garnish ingredient is unknown.",
          safetyRelevance: "consequential",
          resolvableByUser: false,
          relatedFactIds: [],
        },
      ],
      contradictions: [
        {
          id: "ingredient-conflict",
          factPath: "ingredients.tomato",
          description: "Tomato presence conflicts.",
          competingClaims: [
            { value: "present", evidenceIds: [] },
            { value: "absent", evidenceIds: [] },
          ],
        },
      ],
    });
    expect(evaluation.ruleMatch.status).toBe("triggered");
  });

  it("accepts an affirmative coarse high-sodium signal conservatively", () => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      facts({
        nutrition: {
          sodiumLevel: "high",
          highlyProcessed: "unknown",
          evidenceIds: ["coarse"],
        },
        evidence: [
          evidence(
            "coarse",
            "This food is high in sodium.",
            "visibleInImage",
            "likely",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch).toMatchObject({
      status: "triggered",
      recommendedVerdict: "safeWithCaution",
      reasonKey: "high-blood-pressure-coarse-high-sodium",
      evidenceConfidence: "medium",
    });
  });

  it.each([
    "This food is not high in sodium.",
    "This food may be high in sodium.",
    "This food appears high in sodium.",
    "The sodium status is unknown.",
    "There is no evidence this is high in sodium.",
    "This food is high in potassium.",
  ])("rejects non-affirmative or unrelated coarse wording: %s", (summary) => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      facts({
        nutrition: {
          sodiumLevel: "high",
          highlyProcessed: "unknown",
          evidenceIds: ["coarse"],
        },
        evidence: [
          evidence("coarse", summary, "visibleInImage", "likely"),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it("does not use processing alone as a sodium proxy", () => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      facts({
        nutrition: {
          sodiumLevel: "unknown",
          highlyProcessed: "yes",
          evidenceIds: ["processed"],
        },
        evidence: [
          evidence(
            "processed",
            "The food is highly processed.",
            "visibleInImage",
            "confirmed",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it("does not clear from a coarse low signal", () => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      facts({
        nutrition: {
          sodiumLevel: "low",
          highlyProcessed: "unknown",
          evidenceIds: ["coarse-low"],
        },
        evidence: [
          evidence(
            "coarse-low",
            "The food looks low in sodium.",
            "visibleInImage",
            "likely",
          ),
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("notApplicable");
  });

  it("offers one constrained clarification for a resolvable consequential gap", () => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      facts({
        uncertainties: [
          {
            id: "sodium-gap",
            subject: "Sodium on Nutrition Facts",
            kind: "nutrition",
            description: "The sodium level is unclear.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: ["nutrition-sodium-level"],
          },
        ],
      }),
    );
    expect(evaluation.clarificationQuestion?.answerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          patch: expect.objectContaining({
            kind: "setSodiumLevel",
            value: "high",
          }),
        }),
        expect.objectContaining({
          patch: expect.objectContaining({
            kind: "setSodiumLevel",
            value: "moderate",
          }),
        }),
      ]),
    );
  });

  it("suppresses repeated clarification after an unknown user answer", () => {
    const [evaluation] = evaluateHighBloodPressureRules(
      profile,
      facts({
        nutrition: {
          sodiumLevel: "unknown",
          highlyProcessed: "unknown",
          evidenceIds: ["answer"],
        },
        evidence: [
          evidence(
            "answer",
            "The user says the sodium level is unknown.",
            "userProvided",
            "unknown",
          ),
        ],
        uncertainties: [
          {
            id: "sodium-gap",
            subject: "Sodium",
            kind: "nutrition",
            description: "The sodium level is unclear.",
            safetyRelevance: "consequential",
            resolvableByUser: true,
            relatedFactIds: [],
          },
        ],
      }),
    );
    expect(evaluation.ruleMatch.status).toBe("uncertain");
    expect(evaluation.clarificationQuestion).toBeUndefined();
  });

  it("never recommends Avoid", () => {
    for (const input of [
      labeledSodiumFacts(1_000),
      facts({
        nutrition: {
          sodiumLevel: "high",
          highlyProcessed: "unknown",
          evidenceIds: ["coarse"],
        },
        evidence: [
          evidence(
            "coarse",
            "This food is high in sodium.",
            "visibleInImage",
            "likely",
          ),
        ],
      }),
    ]) {
      const [evaluation] = evaluateHighBloodPressureRules(profile, input);
      expect(evaluation.ruleMatch.recommendedVerdict).not.toBe("avoid");
    }
  });
});
