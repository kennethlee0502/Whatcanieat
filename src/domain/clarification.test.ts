import { describe, expect, it } from "vitest";

import { resolveClarification } from "@/domain/clarification";
import {
  evaluationResultSchema,
  type ClarificationQuestion,
  type FactPatch,
} from "@/domain/evaluation";
import type { ExtractedFoodFacts } from "@/domain/food";
import { createAnalysisProfileContext } from "@/domain/profile-operations";
import type { UserProfile } from "@/domain/profile";
import { syntheticAnalysisResponses } from "@/lib/mock-analysis";
import {
  ENGINE_RULE_SET_VERSION,
  evaluateFood,
} from "@/rules/engine";

const allergyProfile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [{ allergenId: "peanut", label: "Peanut" }],
  highBloodPressure: false,
  diet: "none",
};

const profileFor = (patch: FactPatch): UserProfile => ({
  pregnancy: {
    status:
      patch.kind === "setPasteurization" ||
      patch.kind === "setDoneness" ||
      patch.kind === "setRawAnimalProduct"
        ? "pregnant"
        : "notPregnant",
  },
  allergies:
    patch.kind === "setIngredientPresence"
      ? [{ allergenId: patch.ingredientId, label: patch.ingredientId }]
      : [],
  highBloodPressure: patch.kind === "setSodiumLevel",
  diet: "none",
});

const questionFor = (patch: FactPatch): ClarificationQuestion => ({
  id: `question-${patch.kind}`,
  prompt: "Can you confirm this detail?",
  whyItMatters: "This detail can change the recommendation.",
  relatedRuleIds: ["test-rule"],
  relatedFactIds: ["explicit-fact", "explicit-uncertainty"],
  answerOptions: [
    { id: "answer", label: "Confirmed answer", patch },
    {
      id: "unknown",
      label: "I’m not sure",
      patch: { ...patch, value: "unknown" } as FactPatch,
    },
  ],
});

const evaluationFor = (question: ClarificationQuestion) =>
  evaluationResultSchema.parse({
    ...syntheticAnalysisResponses.needMoreInformation.evaluation,
    clarificationQuestions: [question],
    ruleSetVersion: ENGINE_RULE_SET_VERSION,
  });

const factsFor = (): ExtractedFoodFacts => ({
  ...structuredClone(syntheticAnalysisResponses.needMoreInformation.facts),
  uncertainties: [
    {
      id: "explicit-uncertainty",
      subject: "Explicitly associated fact",
      kind: "preparation",
      description: "The explicitly associated fact is unresolved.",
      safetyRelevance: "consequential",
      resolvableByUser: true,
      relatedFactIds: ["explicit-fact"],
    },
    {
      id: "unrelated-uncertainty",
      subject: "Different fact",
      kind: "other",
      description: "A different fact remains unresolved.",
      safetyRelevance: "relevant",
      resolvableByUser: true,
      relatedFactIds: ["different-fact"],
    },
  ],
  contradictions: [
    {
      id: "preserved-contradiction",
      factPath: "preparation.doneness",
      description: "Two sources disagree.",
      competingClaims: [
        { value: "raw", evidenceIds: [] },
        { value: "fullyCooked", evidenceIds: [] },
      ],
    },
  ],
});

describe("resolveClarification", () => {
  it("consumes exactly the question selected by the rule engine", () => {
    const response = syntheticAnalysisResponses.needMoreInformation;
    const selected = response.evaluation.clarificationQuestions[0];
    const option = selected.answerOptions.find(
      ({ id }) => id === "confirmed-present",
    );
    expect(option).toBeDefined();

    const resolution = resolveClarification({
      profile: allergyProfile,
      facts: response.facts,
      evaluation: response.evaluation,
      questionId: selected.id,
      answerOptionId: option!.id,
    });

    expect(resolution.success).toBe(true);
    if (resolution.success) {
      expect(resolution.evaluation.verdict).toBe("avoid");
      expect(resolution.evaluation.ruleSetVersion).toBe(
        response.evaluation.ruleSetVersion,
      );
      expect(resolution.evaluation).toEqual(
        evaluateFood(
          createAnalysisProfileContext(allergyProfile),
          resolution.facts,
        ),
      );
    }
  });

  it.each([
    {
      kind: "setIngredientPresence",
      ingredientId: "peanut",
      value: "confirmed",
      source: "userProvided",
    },
    {
      kind: "setPasteurization",
      value: "pasteurized",
      source: "userProvided",
    },
    {
      kind: "setDoneness",
      value: "fullyCooked",
      source: "userProvided",
    },
    {
      kind: "setRawAnimalProduct",
      value: "no",
      source: "userProvided",
    },
    {
      kind: "setSodiumLevel",
      value: "moderate",
      source: "userProvided",
    },
  ] as const)("applies $kind immutably with user provenance", (patch) => {
    const facts = factsFor();
    const original = structuredClone(facts);
    const question = questionFor(patch);
    const resolution = resolveClarification({
      profile: profileFor(patch),
      facts,
      evaluation: evaluationFor(question),
      questionId: question.id,
      answerOptionId: "answer",
    });

    expect(resolution.success).toBe(true);
    expect(facts).toEqual(original);
    if (resolution.success) {
      expect(resolution.facts.evidence.slice(0, original.evidence.length)).toEqual(
        original.evidence,
      );
      expect(resolution.facts.evidence.at(-1)).toMatchObject({
        source: "userProvided",
        strength: "confirmed",
      });
      expect(resolution.facts.contradictions).toEqual(original.contradictions);
      expect(
        resolution.facts.uncertainties.map(({ id }) => id),
      ).toEqual(["unrelated-uncertainty"]);
    }
  });

  it("preserves uncertainties when an unknown answer resolves nothing", () => {
    const patch: FactPatch = {
      kind: "setPasteurization",
      value: "pasteurized",
      source: "userProvided",
    };
    const question = questionFor(patch);
    const facts = factsFor();
    const resolution = resolveClarification({
      profile: profileFor(patch),
      facts,
      evaluation: evaluationFor(question),
      questionId: question.id,
      answerOptionId: "unknown",
    });

    expect(resolution.success).toBe(true);
    if (resolution.success) {
      expect(resolution.facts.uncertainties).toEqual(facts.uncertainties);
      expect(resolution.facts.evidence.at(-1)).toMatchObject({
        source: "userProvided",
        strength: "unknown",
      });
    }
  });

  it.each([
    ["another-question", "answer"],
    ["question-setPasteurization", "another-answer"],
  ])("rejects invalid question or option IDs without mutation", (
    questionId,
    answerOptionId,
  ) => {
    const patch: FactPatch = {
      kind: "setPasteurization",
      value: "pasteurized",
      source: "userProvided",
    };
    const facts = factsFor();
    const original = structuredClone(facts);
    const question = questionFor(patch);

    expect(
      resolveClarification({
        profile: profileFor(patch),
        facts,
        evaluation: evaluationFor(question),
        questionId,
        answerOptionId,
      }),
    ).toEqual({ success: false });
    expect(facts).toEqual(original);
  });

  it("rejects a different rule-set version", () => {
    const response = syntheticAnalysisResponses.needMoreInformation;
    const question = response.evaluation.clarificationQuestions[0];

    expect(
      resolveClarification({
        profile: allergyProfile,
        facts: response.facts,
        evaluation: {
          ...response.evaluation,
          ruleSetVersion: "different-version",
        },
        questionId: question.id,
        answerOptionId: question.answerOptions[0].id,
      }),
    ).toEqual({ success: false });
  });
});
