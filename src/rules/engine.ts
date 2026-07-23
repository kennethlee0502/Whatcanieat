import type {
  ClarificationQuestion,
  ConfidenceLevel,
  EvaluationReason,
  EvaluationResult,
  RuleMatch,
  SupportedRestriction,
  Verdict,
} from "@/domain/evaluation";
import { evaluationResultSchema } from "@/domain/evaluation";
import type {
  EvidenceItem,
  ExtractedFoodFacts,
} from "@/domain/food";
import { canonicalizeTerm } from "@/domain/normalization";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  allergyRuleDefinitions,
  evaluateAllergyRules,
} from "@/rules/allergy";
import {
  dietPreferenceRuleDefinitions,
  evaluateDietPreferenceRules,
} from "@/rules/diet-preference";
import {
  evaluateHighBloodPressureRules,
  highBloodPressureRuleDefinitions,
} from "@/rules/high-blood-pressure";
import {
  evaluatePregnancyRules,
  pregnancyRuleDefinitions,
  type PregnancyRuleEvaluation,
} from "@/rules/pregnancy";
import type { SafetyRuleDefinition } from "@/rules/provenance";

export const ENGINE_RULE_SET_VERSION = "1.0.0";

export const completeRuleDefinitions: readonly SafetyRuleDefinition[] = [
  ...allergyRuleDefinitions,
  ...pregnancyRuleDefinitions,
  ...highBloodPressureRuleDefinitions,
  ...dietPreferenceRuleDefinitions,
];

type RuleRegistry = ReadonlyMap<string, SafetyRuleDefinition>;

export const createRuleRegistry = (
  definitions: readonly SafetyRuleDefinition[],
): RuleRegistry => {
  const registry = new Map<string, SafetyRuleDefinition>();
  for (const definition of definitions) {
    if (registry.has(definition.id)) {
      throw new Error(`Duplicate registered rule id: ${definition.id}`);
    }
    registry.set(definition.id, definition);
  }
  return registry;
};

const completeRuleRegistry = createRuleRegistry(completeRuleDefinitions);

export const validateEmittedRuleMatches = (
  matches: readonly RuleMatch[],
  registry: RuleRegistry = completeRuleRegistry,
): void => {
  for (const match of matches) {
    const definition = registry.get(match.rule.id);
    if (!definition) {
      throw new Error(`Unknown emitted rule id: ${match.rule.id}`);
    }
    if (definition.version !== match.rule.version) {
      throw new Error(`Version mismatch for emitted rule: ${match.rule.id}`);
    }
    if (definition.restriction !== match.rule.restriction) {
      throw new Error(
        `Restriction mismatch for emitted rule: ${match.rule.id}`,
      );
    }
  }
};

type CollectedEvaluation = Readonly<{
  ruleMatch: RuleMatch;
  evidence: readonly EvidenceItem[];
  clarificationQuestion?: ClarificationQuestion;
  pregnancyDimension?: PregnancyRuleEvaluation["concern"];
  sourceOrder: number;
}>;

export type PregnancyDimensionOutcome = Readonly<{
  dimension: PregnancyRuleEvaluation["concern"];
  ruleMatch: RuleMatch;
}>;

const pregnancyCategoryTerms = {
  pasteurization: new Set([
    "milk",
    "dairy",
    "cheese",
    "yogurt",
    "ice-cream",
    "juice",
    "cider",
  ]),
  animal: new Set([
    "meat",
    "poultry",
    "beef",
    "pork",
    "lamb",
    "veal",
    "chicken",
    "turkey",
    "seafood",
    "fish",
    "shellfish",
    "salmon",
    "tuna",
    "egg",
  ]),
  sproutOrDough: new Set([
    "sprout",
    "sprouts",
    "alfalfa-sprout",
    "alfalfa-sprouts",
    "bean-sprout",
    "bean-sprouts",
    "dough",
    "batter",
  ]),
} as const;

export type PregnancyEvaluationDimension =
  keyof typeof pregnancyCategoryTerms | "none";

const termMatchesPregnancyDimension = (
  value: string,
  dimension: keyof typeof pregnancyCategoryTerms,
) => {
  const term = canonicalizeTerm(value);
  return [...pregnancyCategoryTerms[dimension]].some(
    (categoryTerm) =>
      term === categoryTerm ||
      term.startsWith(`${categoryTerm}-`) ||
      term.endsWith(`-${categoryTerm}`),
  );
};

export const getApplicablePregnancyDimensions = (
  facts: ExtractedFoodFacts,
): readonly PregnancyEvaluationDimension[] => {
  const applicable = new Set<keyof typeof pregnancyCategoryTerms>();
  for (const dimension of [
    "pasteurization",
    "animal",
    "sproutOrDough",
  ] as const) {
    const representedIngredient = facts.ingredients.some(
      (ingredient) =>
        ingredient.presence !== "absent" &&
        termMatchesPregnancyDimension(ingredient.ingredientId, dimension),
    );
    const representedCandidate = facts.foodCandidates.some((candidate) =>
      termMatchesPregnancyDimension(
        candidate.canonicalName ?? candidate.displayName,
        dimension,
      ),
    );
    if (representedIngredient || representedCandidate) {
      applicable.add(dimension);
    }
  }

  const explicitUnpasteurizedLabel = facts.labels.some(
    (label) =>
      label.legibility === "readable" &&
      /\b(?:unpasteurized|raw)\s+(?:milk|dairy|juice|cider)\b/i.test(
        label.text,
      ) &&
      !/\b(?:not|no|without)\b[^.!?;]{0,40}\b(?:unpasteurized|raw)\b/i.test(
        label.text,
      ) &&
      !/\bmade\s+with\s+pasteurized\b/i.test(label.text),
  );
  if (explicitUnpasteurizedLabel) {
    applicable.add("pasteurization");
  }

  const ordered = (
    ["pasteurization", "animal", "sproutOrDough"] as const
  ).filter((dimension) => applicable.has(dimension));
  return ordered.length > 0 ? ordered : ["none"];
};

const registeredPregnancyRules = new Map(
  pregnancyRuleDefinitions.map((definition) => [definition.id, definition]),
);

export const hasCompletePregnancyEvaluationCoverage = (
  facts: ExtractedFoodFacts,
  outcomes: readonly PregnancyDimensionOutcome[],
): boolean => {
  const expected = getApplicablePregnancyDimensions(facts);
  if (outcomes.length !== expected.length) {
    return false;
  }

  const counts = new Map<PregnancyEvaluationDimension, number>();
  for (const outcome of outcomes) {
    const definition = registeredPregnancyRules.get(outcome.ruleMatch.rule.id);
    if (
      !definition ||
      definition.version !== outcome.ruleMatch.rule.version ||
      definition.restriction !== "pregnancy" ||
      outcome.ruleMatch.rule.restriction !== "pregnancy"
    ) {
      return false;
    }
    counts.set(outcome.dimension, (counts.get(outcome.dimension) ?? 0) + 1);
  }

  return (
    counts.size === expected.length &&
    expected.every((dimension) => counts.get(dimension) === 1)
  );
};

const verdictPriority: Readonly<Record<Verdict, number>> = {
  avoid: 0,
  needMoreInformation: 1,
  safeWithCaution: 2,
  safe: 3,
};
const statusPriority: Readonly<Record<RuleMatch["status"], number>> = {
  triggered: 0,
  uncertain: 1,
  cleared: 2,
  notApplicable: 3,
};
const riskPriority: Readonly<Record<RuleMatch["risk"], number>> = {
  critical: 0,
  high: 1,
  moderate: 2,
  informational: 3,
};
const confidencePriority: Readonly<Record<ConfidenceLevel, number>> = {
  high: 0,
  medium: 1,
  low: 2,
};
const restrictionPriority: Readonly<Record<SupportedRestriction, number>> = {
  pregnancy: 0,
  allergy: 1,
  highBloodPressure: 2,
  vegetarian: 3,
  vegan: 4,
};

const compareEvaluations = (
  left: CollectedEvaluation,
  right: CollectedEvaluation,
) => {
  const leftVerdict = left.ruleMatch.recommendedVerdict;
  const rightVerdict = right.ruleMatch.recommendedVerdict;
  return (
    (leftVerdict === null ? 4 : verdictPriority[leftVerdict]) -
      (rightVerdict === null ? 4 : verdictPriority[rightVerdict]) ||
    statusPriority[left.ruleMatch.status] -
      statusPriority[right.ruleMatch.status] ||
    riskPriority[left.ruleMatch.risk] - riskPriority[right.ruleMatch.risk] ||
    confidencePriority[left.ruleMatch.evidenceConfidence] -
      confidencePriority[right.ruleMatch.evidenceConfidence] ||
    restrictionPriority[left.ruleMatch.rule.restriction] -
      restrictionPriority[right.ruleMatch.rule.restriction] ||
    left.ruleMatch.rule.id.localeCompare(right.ruleMatch.rule.id) ||
    left.sourceOrder - right.sourceOrder
  );
};

const unique = <Value>(values: readonly Value[]) => [...new Set(values)];

const collectEvaluations = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
): readonly CollectedEvaluation[] => {
  const evaluations = [
    ...evaluatePregnancyRules(profile, facts).map((evaluation) => ({
      ...evaluation,
      pregnancyDimension: evaluation.concern,
    })),
    ...evaluateAllergyRules(profile, facts),
    ...evaluateHighBloodPressureRules(profile, facts),
    ...evaluateDietPreferenceRules(profile, facts),
  ];
  return evaluations
    .map((evaluation, sourceOrder) => ({ ...evaluation, sourceOrder }))
    .sort(compareEvaluations);
};

const isContributing = (
  match: RuleMatch,
): match is Extract<
  RuleMatch,
  { status: "triggered" | "uncertain" }
> => match.status === "triggered" || match.status === "uncertain";

const getWinningVerdict = (
  evaluations: readonly CollectedEvaluation[],
): Verdict | null => {
  const recommendations = evaluations.flatMap(({ ruleMatch }) =>
    isContributing(ruleMatch) ? [ruleMatch.recommendedVerdict] : [],
  );
  return (
    recommendations.sort(
      (left, right) => verdictPriority[left] - verdictPriority[right],
    )[0] ?? null
  );
};

const hasConfirmedIdentity = (facts: ExtractedFoodFacts) => {
  const primary = facts.foodCandidates.find(
    (candidate) => candidate.id === facts.primaryFoodId,
  );
  if (!primary || primary.identityConfidence !== "high") {
    return false;
  }
  const evidenceById = new Map(facts.evidence.map((item) => [item.id, item]));
  return primary.evidenceIds.some((id) => {
    const item = evidenceById.get(id);
    return (
      item?.strength === "confirmed" &&
      item.source !== "conventionalInference"
    );
  });
};

const hasReliableCompleteIngredientCoverage = (
  facts: ExtractedFoodFacts,
) => {
  const evidenceById = new Map(facts.evidence.map((item) => [item.id, item]));
  const completeIngredientEvidencePattern =
    /\b(?:complete|entire|full)\s+ingredients?(?:\s+list|\s+information)?\b[^.!?;]{0,60}\b(?:captured|readable|read|visible|shown|lists?|reads?)\b|\b(?:captured|read|shows?|lists?)\b[^.!?;]{0,60}\b(?:complete|entire|full)\s+ingredients?(?:\s+list|\s+information)?\b/i;
  const incompleteIngredientTextPattern =
    /(?:\.\.\.|…)|\b(?:cropped|truncated|partial|incomplete|continued|remaining\s+ingredients?\s+unreadable|see\s+(?:the\s+)?(?:side|other|next)\s+panel)\b/i;
  const readableCompleteLabel = facts.labels.some(
    (label) =>
      label.legibility === "readable" &&
      /\bingredients?\s*:/i.test(label.text) &&
      !incompleteIngredientTextPattern.test(label.text) &&
      label.evidenceIds.some((id) => {
        const item = evidenceById.get(id);
        return (
          item?.source === "readableOnLabel" &&
          item.strength === "confirmed" &&
          completeIngredientEvidencePattern.test(item.summary) &&
          !incompleteIngredientTextPattern.test(item.summary)
        );
      }),
  );
  const userConfirmedCompleteList = facts.evidence.some(
    (item) =>
      item.source === "userProvided" &&
      item.strength === "confirmed" &&
      completeIngredientEvidencePattern.test(item.summary) &&
      !incompleteIngredientTextPattern.test(item.summary),
  );
  return readableCompleteLabel || userConfirmedCompleteList;
};

const getSelectedRestrictions = (
  profile: AnalysisProfileContext,
): readonly SupportedRestriction[] => [
  ...(profile.pregnancy ? (["pregnancy"] as const) : []),
  ...((profile.allergies?.length ?? 0) > 0 ? (["allergy"] as const) : []),
  ...(profile.highBloodPressure
    ? (["highBloodPressure"] as const)
    : []),
  ...(profile.diet ? ([profile.diet] as const) : []),
];

type AdequacyResult = Readonly<{
  adequate: boolean;
  missingInformation: readonly string[];
}>;

const getRestrictionAdequacy = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
  evaluations: readonly CollectedEvaluation[],
): AdequacyResult => {
  const missingInformation: string[] = [];
  const completeIngredientCoverage =
    hasReliableCompleteIngredientCoverage(facts);
  const evaluationsFor = (restriction: SupportedRestriction) =>
    evaluations.filter(
      ({ ruleMatch }) => ruleMatch.rule.restriction === restriction,
    );

  if (profile.pregnancy) {
    const pregnancyMatches = evaluationsFor("pregnancy");
    const pregnancyOutcomes = pregnancyMatches.flatMap((evaluation) =>
      evaluation.pregnancyDimension
        ? [
            {
              dimension: evaluation.pregnancyDimension,
              ruleMatch: evaluation.ruleMatch,
            },
          ]
        : [],
    );
    const completePregnancyCoverage =
      hasCompletePregnancyEvaluationCoverage(facts, pregnancyOutcomes);
    const everyPregnancyDimensionResolved =
      pregnancyMatches.length > 0 &&
      pregnancyMatches.every(
        ({ ruleMatch }) =>
          ruleMatch.status === "cleared" ||
          ruleMatch.status === "notApplicable",
      );
    if (
      !hasConfirmedIdentity(facts) ||
      !completeIngredientCoverage ||
      !completePregnancyCoverage ||
      !everyPregnancyDimensionResolved
    ) {
      missingInformation.push(
        "Pregnancy-relevant food identity, ingredient, and preparation coverage is incomplete.",
      );
    }
  }

  for (const allergy of profile.allergies ?? []) {
    const allergyCovered =
      completeIngredientCoverage ||
      evaluationsFor("allergy").some(
        ({ ruleMatch }) =>
          ruleMatch.status === "cleared" &&
          ruleMatch.evidenceIds.length > 0 &&
          facts.ingredients.some(
            (ingredient) =>
              ingredient.ingredientId === allergy.allergenId &&
              ingredient.presence === "absent" &&
              ingredient.evidenceIds.some((id) =>
                ruleMatch.evidenceIds.includes(id),
              ),
          ),
      );
    if (!allergyCovered) {
      missingInformation.push(
        `Ingredient coverage for allergy ${allergy.allergenId} is incomplete.`,
      );
    }
  }

  if (
    profile.highBloodPressure &&
    !evaluationsFor("highBloodPressure").some(
      ({ ruleMatch }) =>
        ruleMatch.status === "cleared" ||
        ruleMatch.status === "triggered",
    )
  ) {
    missingInformation.push(
      "Reliable serving-based sodium information is incomplete.",
    );
  }

  if (profile.diet && !completeIngredientCoverage) {
    missingInformation.push(
      `Complete ingredient coverage for the ${profile.diet} preference is incomplete.`,
    );
  }

  return {
    adequate: missingInformation.length === 0,
    missingInformation,
  };
};

const getGlobalSafeAdequacy = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
  evaluations: readonly CollectedEvaluation[],
): AdequacyResult => {
  const missingInformation: string[] = [];
  if (facts.imageSuitability !== "foodDetected") {
    missingInformation.push("A suitable food image is required.");
  }
  if (!hasConfirmedIdentity(facts)) {
    missingInformation.push("Confirmed food identity is incomplete.");
  }
  if (facts.extractionConfidence !== "high") {
    missingInformation.push("Food-fact extraction confidence is incomplete.");
  }
  if (
    facts.uncertainties.some(
      (item) => item.safetyRelevance === "consequential",
    )
  ) {
    missingInformation.push("Consequential food information is unresolved.");
  }
  if (facts.contradictions.length > 0) {
    missingInformation.push("Conflicting food evidence is unresolved.");
  }

  const selectedRestrictions = getSelectedRestrictions(profile);
  for (const restriction of selectedRestrictions) {
    if (
      !evaluations.some(
        ({ ruleMatch }) => ruleMatch.rule.restriction === restriction,
      )
    ) {
      missingInformation.push(
        `The ${restriction} restriction was not evaluated.`,
      );
    }
  }

  const restrictionAdequacy = getRestrictionAdequacy(
    profile,
    facts,
    evaluations,
  );
  missingInformation.push(...restrictionAdequacy.missingInformation);
  return {
    adequate: missingInformation.length === 0,
    missingInformation: unique(missingInformation).slice(0, 20),
  };
};

const getRecommendationConfidence = (
  verdict: Verdict,
  evaluations: readonly CollectedEvaluation[],
  fallback: boolean,
  hasContradiction: boolean,
): ConfidenceLevel => {
  if (fallback) {
    return "low";
  }
  const derivedConfidence: ConfidenceLevel =
    verdict === "safe"
      ? "high"
      : evaluations.some(
            ({ ruleMatch }) =>
              isContributing(ruleMatch) &&
              ruleMatch.recommendedVerdict === verdict &&
              ruleMatch.evidenceConfidence === "high",
          )
        ? "high"
        : evaluations.some(
              ({ ruleMatch }) =>
                isContributing(ruleMatch) &&
                ruleMatch.recommendedVerdict === verdict &&
                ruleMatch.evidenceConfidence === "medium",
            )
          ? "medium"
          : "low";
  return hasContradiction && derivedConfidence === "high"
    ? "medium"
    : derivedConfidence;
};

const reasonCopy: Readonly<Record<string, string>> = {
  "allergy-confirmed-ingredient":
    "A selected allergen is confirmed as an ingredient.",
  "allergy-explicit-advisory":
    "A readable precautionary statement names a selected allergen.",
  "allergy-ingredient-uncertain":
    "A selected allergen could not be confirmed or ruled out.",
  "allergy-explicitly-absent":
    "The selected allergen is explicitly absent from this local ingredient check.",
  "allergy-no-relevant-evidence":
    "No supported evidence applies to this allergen check.",
  "pregnancy-unpasteurized-product":
    "An applicable product is confirmed as unpasteurized.",
  "pregnancy-pasteurization-unknown":
    "Pasteurization could not be confirmed.",
  "pregnancy-pasteurization-cleared":
    "Pasteurization is confirmed for this local check.",
  "pregnancy-raw-animal-product":
    "A raw animal product is confirmed.",
  "pregnancy-undercooked-animal-product":
    "An animal product is confirmed as undercooked.",
  "pregnancy-animal-preparation-unknown":
    "Animal-product preparation could not be confirmed.",
  "pregnancy-animal-preparation-cleared":
    "Animal-product preparation is resolved for this local check.",
  "pregnancy-raw-sprout-or-dough":
    "Raw or undercooked sprouts, dough, or batter are confirmed.",
  "pregnancy-sprout-or-dough-preparation-unknown":
    "Sprout, dough, or batter preparation could not be confirmed.",
  "pregnancy-sprout-or-dough-preparation-cleared":
    "Sprout, dough, or batter preparation is resolved for this local check.",
  "pregnancy-preparation-cleared":
    "The applicable pregnancy preparation concern is locally resolved.",
  "pregnancy-no-relevant-food-risk":
    "No supported pregnancy food category applies to this local check.",
  "high-blood-pressure-high-sodium-label":
    "The readable label confirms a high-sodium serving.",
  "high-blood-pressure-coarse-high-sodium":
    "Available evidence indicates a high-sodium concern.",
  "high-blood-pressure-sodium-uncertain":
    "Serving-based sodium information could not be confirmed.",
  "high-blood-pressure-high-sodium-threshold-cleared":
    "The labeled serving is below the supported high-sodium threshold.",
  "high-blood-pressure-no-supported-sodium-concern":
    "No supported sodium result applies to this local check.",
  "diet-confirmed-animal-derived-ingredient":
    "An ingredient conflicts with the selected diet preference.",
  "diet-animal-derived-ingredient-uncertain":
    "A possible animal-derived ingredient could not be resolved.",
  "diet-animal-derived-ingredient-absent":
    "The animal-derived ingredient is explicitly absent from this local check.",
  "diet-no-supported-animal-derived-conflict":
    "No supported diet-conflict evidence applies to this local check.",
};

export const getReasonSummary = (reasonKey: string): string =>
  reasonCopy[reasonKey] ?? "A supported rule affected this recommendation.";

const getReasons = (
  verdict: Verdict,
  evaluations: readonly CollectedEvaluation[],
): readonly EvaluationReason[] =>
  evaluations
    .filter(
      ({ ruleMatch }) =>
        isContributing(ruleMatch) &&
        ruleMatch.recommendedVerdict === verdict,
    )
    .slice(0, 3)
    .map(({ ruleMatch }, index) => ({
      id: `reason-${index + 1}-${ruleMatch.rule.id}`,
      ruleId: ruleMatch.rule.id,
      summary: getReasonSummary(ruleMatch.reasonKey),
      evidenceIds: unique(ruleMatch.evidenceIds),
    }));

const getEvidence = (
  evaluations: readonly CollectedEvaluation[],
): readonly EvidenceItem[] => {
  const evidenceById = new Map<string, EvidenceItem>();
  for (const evaluation of evaluations) {
    for (const item of evaluation.evidence) {
      if (!evidenceById.has(item.id)) {
        evidenceById.set(item.id, item);
      }
    }
  }
  return [...evidenceById.values()];
};

const getClarifications = (
  verdict: Verdict,
  evaluations: readonly CollectedEvaluation[],
): readonly ClarificationQuestion[] => {
  if (verdict === "avoid") {
    return [];
  }
  const seen = new Set<string>();
  for (const evaluation of evaluations) {
    const question = evaluation.clarificationQuestion;
    if (
      evaluation.ruleMatch.status === "uncertain" &&
      question &&
      question.relatedRuleIds.includes(evaluation.ruleMatch.rule.id) &&
      !seen.has(question.id)
    ) {
      seen.add(question.id);
      return [question];
    }
  }
  return [];
};

const nextActionByVerdict: Readonly<Record<Verdict, string>> = {
  avoid: "Choose another food that does not contain the confirmed conflict.",
  needMoreInformation: "Confirm the missing detail before deciding.",
  safeWithCaution: "Consider the noted caution before deciding.",
  safe: "No supported conflict was found in the confirmed information.",
};

export const evaluateFood = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
): EvaluationResult => {
  const evaluations = collectEvaluations(profile, facts);
  const ruleMatches = evaluations.map(({ ruleMatch }) => ruleMatch);
  validateEmittedRuleMatches(ruleMatches);

  const winningVerdict = getWinningVerdict(evaluations);
  const safeAdequacy = getGlobalSafeAdequacy(profile, facts, evaluations);
  const adequacyFallback =
    !safeAdequacy.adequate &&
    (winningVerdict === null || winningVerdict === "safeWithCaution");
  const verdict =
    winningVerdict === "avoid" ||
    winningVerdict === "needMoreInformation"
      ? winningVerdict
      : adequacyFallback
        ? "needMoreInformation"
        : (winningVerdict ?? "safe");
  const primary = facts.foodCandidates.find(
    (candidate) => candidate.id === facts.primaryFoodId,
  );
  const contributingMissingFacts = evaluations.flatMap(({ ruleMatch }) =>
    ruleMatch.status === "uncertain" ? ruleMatch.missingFactIds : [],
  );
  const missingInformation = unique([
    ...contributingMissingFacts.map((id) => `Missing information: ${id}.`),
    ...(adequacyFallback ? safeAdequacy.missingInformation : []),
  ]).slice(0, 20);

  return evaluationResultSchema.parse({
    verdict,
    identifiedFood: primary?.displayName ?? null,
    recommendationConfidence: getRecommendationConfidence(
      verdict,
      evaluations,
      adequacyFallback,
      facts.contradictions.length > 0,
    ),
    reasons: getReasons(verdict, evaluations),
    missingInformation,
    evidence: getEvidence(evaluations),
    ruleMatches,
    clarificationQuestions: getClarifications(verdict, evaluations),
    nextAction: nextActionByVerdict[verdict],
    supportedScopeStatement:
      "This result covers only the selected pregnancy, allergy, high blood pressure, vegetarian, and vegan rules supported by this product.",
    ruleSetVersion: ENGINE_RULE_SET_VERSION,
  });
};
