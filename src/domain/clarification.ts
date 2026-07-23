import {
  clarificationAnswerSchema,
  factPatchSchema,
  type ClarificationAnswer,
  type ClarificationQuestion,
  type EvaluationResult,
  type FactPatch,
} from "@/domain/evaluation";
import {
  extractedFoodFactsSchema,
  type EvidenceItem,
  type ExtractedFoodFacts,
} from "@/domain/food";
import { createAnalysisProfileContext } from "@/domain/profile-operations";
import type { UserProfile } from "@/domain/profile";
import {
  ENGINE_RULE_SET_VERSION,
  evaluateFood,
} from "@/rules/engine";

export type ClarificationResolution =
  | Readonly<{
      success: true;
      facts: ExtractedFoodFacts;
      evaluation: EvaluationResult;
    }>
  | Readonly<{ success: false }>;

const patchIsUnknown = (patch: FactPatch) =>
  patch.value === "unknown";

const evidenceStrengthFor = (
  patch: FactPatch,
): EvidenceItem["strength"] => (patchIsUnknown(patch) ? "unknown" : "confirmed");

const evidenceSummaryFor = (
  question: ClarificationQuestion,
  answerOptionId: string,
  patch: FactPatch,
) => {
  const option = question.answerOptions.find(
    ({ id }) => id === answerOptionId,
  );
  const answer = option?.label ?? "A constrained answer was provided.";

  switch (patch.kind) {
    case "setIngredientPresence":
      return `User provided ingredient information for ${patch.ingredientId}: ${answer}.`;
    case "setPasteurization":
      return `User provided pasteurization information: ${answer}.`;
    case "setDoneness":
      return `User provided doneness information: ${answer}.`;
    case "setRawAnimalProduct":
      return `User provided raw animal product information: ${answer}.`;
    case "setSodiumLevel":
      return `User provided sodium information: ${answer}.`;
  }
};

const uncertaintyIsExplicitlyResolved = (
  uncertainty: ExtractedFoodFacts["uncertainties"][number],
  question: ClarificationQuestion,
  patch: FactPatch,
) => {
  if (patchIsUnknown(patch)) {
    return false;
  }

  const relatedQuestionFacts = new Set(question.relatedFactIds);
  return (
    relatedQuestionFacts.has(uncertainty.id) ||
    uncertainty.relatedFactIds.some((id) => relatedQuestionFacts.has(id))
  );
};

const applyPatch = (
  facts: ExtractedFoodFacts,
  question: ClarificationQuestion,
  answerOptionId: string,
  patch: FactPatch,
): ExtractedFoodFacts | null => {
  const evidenceId = `clarification-${question.id}-${answerOptionId}`;
  if (facts.evidence.some(({ id }) => id === evidenceId)) {
    return null;
  }

  const evidence: EvidenceItem = {
    id: evidenceId,
    source: "userProvided",
    strength: evidenceStrengthFor(patch),
    summary: evidenceSummaryFor(question, answerOptionId, patch),
  };
  const uncertainties = facts.uncertainties.filter(
    (uncertainty) =>
      !uncertaintyIsExplicitlyResolved(uncertainty, question, patch),
  );

  switch (patch.kind) {
    case "setIngredientPresence": {
      const matchingIndexes = facts.ingredients.flatMap((ingredient, index) =>
        ingredient.ingredientId === patch.ingredientId ? [index] : [],
      );
      const ingredients =
        matchingIndexes.length > 0
          ? facts.ingredients.map((ingredient) =>
              ingredient.ingredientId === patch.ingredientId
                ? {
                    ...ingredient,
                    presence: patch.value,
                    evidenceIds: [...ingredient.evidenceIds, evidenceId],
                  }
                : ingredient,
            )
          : [
              ...facts.ingredients,
              {
                id: `clarification-ingredient-${patch.ingredientId}`,
                ingredientId: patch.ingredientId,
                displayName: patch.ingredientId,
                presence: patch.value,
                evidenceIds: [evidenceId],
              },
            ];
      return {
        ...facts,
        ingredients,
        evidence: [...facts.evidence, evidence],
        uncertainties,
      };
    }
    case "setPasteurization":
      return {
        ...facts,
        preparation: {
          ...facts.preparation,
          pasteurization: patch.value,
          evidenceIds: [...facts.preparation.evidenceIds, evidenceId],
        },
        evidence: [...facts.evidence, evidence],
        uncertainties,
      };
    case "setDoneness":
      return {
        ...facts,
        preparation: {
          ...facts.preparation,
          doneness: patch.value,
          evidenceIds: [...facts.preparation.evidenceIds, evidenceId],
        },
        evidence: [...facts.evidence, evidence],
        uncertainties,
      };
    case "setRawAnimalProduct":
      return {
        ...facts,
        preparation: {
          ...facts.preparation,
          rawAnimalProduct: patch.value,
          evidenceIds: [...facts.preparation.evidenceIds, evidenceId],
        },
        evidence: [...facts.evidence, evidence],
        uncertainties,
      };
    case "setSodiumLevel":
      return {
        ...facts,
        nutrition: {
          ...facts.nutrition,
          sodiumLevel: patch.value,
          evidenceIds: [...facts.nutrition.evidenceIds, evidenceId],
        },
        evidence: [...facts.evidence, evidence],
        uncertainties,
      };
  }
};

export const resolveClarification = ({
  profile,
  facts,
  evaluation,
  questionId,
  answerOptionId,
}: Readonly<{
  profile: UserProfile;
  facts: ExtractedFoodFacts;
  evaluation: EvaluationResult;
  questionId: string;
  answerOptionId: string;
}>): ClarificationResolution => {
  if (evaluation.ruleSetVersion !== ENGINE_RULE_SET_VERSION) {
    return { success: false };
  }

  const selectedQuestion = evaluation.clarificationQuestions[0];
  if (!selectedQuestion || selectedQuestion.id !== questionId) {
    return { success: false };
  }

  const parsedAnswer = clarificationAnswerSchema.safeParse({
    questionId,
    answerOptionId,
  } satisfies ClarificationAnswer);
  const selectedOption = selectedQuestion.answerOptions.find(
    ({ id }) => id === answerOptionId,
  );
  const parsedPatch = factPatchSchema.safeParse(selectedOption?.patch);
  if (!parsedAnswer.success || !selectedOption || !parsedPatch.success) {
    return { success: false };
  }

  const patchedFacts = applyPatch(
    facts,
    selectedQuestion,
    selectedOption.id,
    parsedPatch.data,
  );
  const revisedFacts = extractedFoodFactsSchema.safeParse(patchedFacts);
  if (!revisedFacts.success) {
    return { success: false };
  }

  const revisedEvaluation = evaluateFood(
    createAnalysisProfileContext(profile),
    revisedFacts.data,
  );
  if (revisedEvaluation.ruleSetVersion !== evaluation.ruleSetVersion) {
    return { success: false };
  }

  return {
    success: true,
    facts: revisedFacts.data,
    evaluation: revisedEvaluation,
  };
};
