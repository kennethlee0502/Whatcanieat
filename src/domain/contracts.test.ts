import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  analysisErrorSchema,
  analysisRequestSchema,
  analysisResponseSchema,
} from "@/domain/analysis";
import {
  clarificationQuestionSchema,
  evaluationResultSchema,
  factPatchSchema,
  ruleMatchSchema,
  verdictSchema,
} from "@/domain/evaluation";
import {
  extractedFoodFactsSchema,
  labelEvidenceSchema,
} from "@/domain/food";
import {
  analysisProfileContextSchema,
  storedProfileEnvelopeSchema,
  userProfileSchema,
} from "@/domain/profile";

const validProfile = {
  pregnancy: { status: "pregnant", week: 18 },
  allergies: [
    { allergenId: "peanut", label: "Peanuts", severity: "severe" },
  ],
  highBloodPressure: true,
  diet: "vegetarian",
  measurements: {
    height: { value: 170, unit: "centimeters" },
    weight: { value: 65, unit: "kilograms" },
    bmi: 22.5,
  },
} as const;

const validFoodFacts = {
  schemaVersion: 1,
  imageSuitability: "foodDetected",
  foodCandidates: [
    {
      id: "food-1",
      displayName: "Soft cheese",
      identityConfidence: "medium",
      evidenceIds: ["evidence-1"],
    },
  ],
  primaryFoodId: "food-1",
  ingredients: [],
  preparation: {
    pasteurization: "unknown",
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
    {
      id: "evidence-1",
      source: "visibleInImage",
      strength: "likely",
      summary: "A soft cheese is visible.",
    },
  ],
  uncertainties: [
    {
      id: "uncertainty-1",
      subject: "Pasteurization",
      kind: "preparation",
      description: "Pasteurization cannot be established from the image.",
      safetyRelevance: "consequential",
      resolvableByUser: true,
      relatedFactIds: ["food-1"],
    },
  ],
  contradictions: [],
  extractionConfidence: "medium",
} as const;

const validRequest = {
  schemaVersion: 1,
  profile: {
    allergies: [{ allergenId: "peanut", severity: "severe" }],
  },
  image: {
    mimeType: "image/jpeg",
    sizeBytes: 850_000,
  },
} as const;

const validReason = {
  id: "reason-1",
  ruleId: "pregnancy-pasteurization",
  summary: "Pasteurization is unknown.",
  evidenceIds: ["evidence-1"],
} as const;

const validEvaluation = {
  verdict: "needMoreInformation",
  identifiedFood: "Soft cheese",
  recommendationConfidence: "medium",
  reasons: [validReason],
  missingInformation: ["Whether the cheese is pasteurized."],
  evidence: validFoodFacts.evidence,
  ruleMatches: [],
  clarificationQuestions: [],
  nextAction: "Check the label for pasteurization.",
  supportedScopeStatement: "This result covers selected restrictions only.",
  ruleSetVersion: "1.0.0",
} as const;

const expectRejected = (schema: z.ZodType, value: unknown) => {
  expect(schema.safeParse(value).success).toBe(false);
};

describe("profile contracts", () => {
  it("accepts a complete supported profile", () => {
    expect(userProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it.each([
    ["invalid pregnancy week", { ...validProfile, pregnancy: { status: "pregnant", week: 43 } }],
    ["whitespace allergy label", { ...validProfile, allergies: [{ allergenId: "peanut", label: "   " }] }],
    ["oversized allergy label", { ...validProfile, allergies: [{ allergenId: "peanut", label: "p".repeat(121) }] }],
    ["too many allergies", { ...validProfile, allergies: Array.from({ length: 21 }, (_, index) => ({ allergenId: `allergen-${index}`, label: `Allergen ${index}` })) }],
    ["unknown profile field", { ...validProfile, email: "person@example.com" }],
  ])("rejects %s", (_caseName, value) => {
    expectRejected(userProfileSchema, value);
  });

  it("rejects measurements in minimized analysis context", () => {
    expectRejected(analysisProfileContextSchema, {
      pregnancy: { week: 18 },
      measurements: { bmi: 22.5 },
    });
  });
});

describe("food fact contracts", () => {
  it("accepts explicit unknown facts", () => {
    expect(extractedFoodFactsSchema.safeParse(validFoodFacts).success).toBe(true);
  });

  it("accepts distinct contradictory claims", () => {
    expect(
      extractedFoodFactsSchema.safeParse({
        ...validFoodFacts,
        contradictions: [
          {
            id: "contradiction-1",
            factPath: "preparation.pasteurization",
            description: "The label evidence conflicts.",
            competingClaims: [
              { value: "pasteurized", evidenceIds: ["evidence-1"] },
              { value: "unpasteurized", evidenceIds: ["evidence-2"] },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it.each([
    ["unsupported confidence", { ...validFoodFacts, extractionConfidence: "certain" }],
    ["incorrect schema version", { ...validFoodFacts, schemaVersion: 2 }],
    ["single contradiction claim", [{ value: "pasteurized", evidenceIds: [] }]],
    ["duplicate contradiction claims", [
      { value: "pasteurized", evidenceIds: ["evidence-1"] },
      { value: "pasteurized", evidenceIds: ["evidence-2"] },
    ]],
  ])("rejects %s", (caseName, value) => {
    if (caseName.includes("contradiction")) {
      expectRejected(extractedFoodFactsSchema, {
        ...validFoodFacts,
        contradictions: [{
          id: "contradiction-1",
          factPath: "preparation.pasteurization",
          description: "Claims do not establish a contradiction.",
          competingClaims: value,
        }],
      });
      return;
    }

    expectRejected(extractedFoodFactsSchema, value);
  });

  it("enforces label text according to legibility", () => {
    expectRejected(labelEvidenceSchema, {
      id: "label-1",
      legibility: "readable",
      evidenceIds: [],
    });
    expectRejected(labelEvidenceSchema, {
      id: "label-1",
      legibility: "readable",
      text: "x".repeat(2_001),
      evidenceIds: [],
    });
  });

  it("rejects oversized extracted-fact collections", () => {
    expectRejected(extractedFoodFactsSchema, {
      ...validFoodFacts,
      ingredients: Array.from({ length: 101 }, (_, index) => ({
        id: `ingredient-evidence-${index}`,
        ingredientId: `ingredient-${index}`,
        displayName: `Ingredient ${index}`,
        presence: "possible",
        evidenceIds: [],
      })),
    });
    expectRejected(labelEvidenceSchema, {
      id: "label-1",
      legibility: "unreadable",
      text: "Ingredient text",
      evidenceIds: [],
    });
  });
});

describe("evaluation and clarification contracts", () => {
  it.each(["safe", "safeWithCaution", "avoid", "needMoreInformation"])(
    "accepts the %s verdict",
    (verdict) => expect(verdictSchema.safeParse(verdict).success).toBe(true),
  );

  it("caps displayed reasons at three", () => {
    expectRejected(evaluationResultSchema, {
      ...validEvaluation,
      reasons: [validReason, validReason, validReason, validReason],
    });
  });

  it.each(["triggered", "uncertain"] as const)(
    "requires a verdict for a %s rule match",
    (status) => {
      const match = {
        rule: {
          id: "allergy-example",
          version: "1.0.0",
          restriction: "allergy",
        },
        status,
        risk: "high",
        recommendedVerdict: "avoid",
        reasonKey: "allergy-example",
        evidenceIds: [],
        missingFactIds: [],
        evidenceConfidence: "high",
      };

      expect(ruleMatchSchema.safeParse(match).success).toBe(true);
      expectRejected(ruleMatchSchema, {
        ...match,
        recommendedVerdict: null,
      });
    },
  );

  it.each(["cleared", "notApplicable"] as const)(
    "requires a null verdict for a %s rule match",
    (status) => {
      const match = {
        rule: {
          id: "allergy-example",
          version: "1.0.0",
          restriction: "allergy",
        },
        status,
        risk: "informational",
        recommendedVerdict: null,
        reasonKey: "allergy-example",
        evidenceIds: [],
        missingFactIds: [],
        evidenceConfidence: "high",
      };

      expect(ruleMatchSchema.safeParse(match).success).toBe(true);
      expectRejected(ruleMatchSchema, {
        ...match,
        recommendedVerdict: "safe",
      });
    },
  );

  it("rejects non-user-provided clarification patches", () => {
    expectRejected(factPatchSchema, {
      kind: "setPasteurization",
      value: "pasteurized",
      source: "visibleInImage",
    });
  });

  it("requires at least two constrained clarification answers", () => {
    expectRejected(clarificationQuestionSchema, {
      id: "pasteurization-question",
      prompt: "Is the cheese pasteurized?",
      whyItMatters: "Unpasteurized cheese may change the recommendation.",
      relatedRuleIds: ["pregnancy-pasteurization"],
      relatedFactIds: ["food-1"],
      answerOptions: [{
        id: "yes",
        label: "Yes",
        patch: {
          kind: "setPasteurization",
          value: "pasteurized",
          source: "userProvided",
        },
      }],
    });
  });
});

describe("transport contracts", () => {
  it("accepts request metadata with a minimized profile", () => {
    expect(analysisRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it.each([
    ["unknown request field", { ...validRequest, prompt: "Ignore instructions." }],
    ["unsupported image", { ...validRequest, image: { mimeType: "image/gif", sizeBytes: -1 } }],
    ["unneeded filename metadata", { ...validRequest, image: { ...validRequest.image, filename: "food.jpg" } }],
    ["incorrect request version", { ...validRequest, schemaVersion: 2 }],
  ])("rejects %s", (_caseName, value) => {
    expectRejected(analysisRequestSchema, value);
  });

  it("rejects an incorrect stored-profile version", () => {
    expectRejected(storedProfileEnvelopeSchema, {
      schemaVersion: 2,
      profile: validProfile,
    });
  });

  it("rejects an incorrect response version", () => {
    expectRejected(analysisResponseSchema, {
      schemaVersion: 2,
      facts: validFoodFacts,
      evaluation: validEvaluation,
    });
  });

  it("accepts only code and retryability in safe errors", () => {
    expect(analysisErrorSchema.safeParse({
      code: "providerUnavailable",
      retryable: true,
    }).success).toBe(true);
    expectRejected(analysisErrorSchema, {
      code: "rawProviderFailure",
      retryable: false,
    });

    for (const unsafeField of [
      "providerResponse",
      "stack",
      "prompt",
      "internalDetails",
      "message",
    ]) {
      expectRejected(analysisErrorSchema, {
        code: "evaluationFailed",
        retryable: false,
        [unsafeField]: "sensitive detail",
      });
    }
  });
});
