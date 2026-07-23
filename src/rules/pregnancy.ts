import type {
  ClarificationQuestion,
  ConfidenceLevel,
  RuleDescriptor,
  RuleMatch,
} from "@/domain/evaluation";
import type {
  EvidenceItem,
  ExtractedFoodFacts,
  IngredientEvidence,
} from "@/domain/food";
import { canonicalizeTerm } from "@/domain/normalization";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  safetyRuleDefinitionSchema,
  type SafetyRuleDefinition,
} from "@/rules/provenance";

const PREGNANCY_RULE_VERSION = "1.0.0";
const REVIEWED_ON = "2026-07-23";

const CDC_PREGNANCY_GUIDANCE =
  "https://www.cdc.gov/food-safety/foods/pregnant-women.html";
const FOOD_SAFETY_PREGNANCY_GUIDANCE =
  "https://www.foodsafety.gov/people-at-risk/pregnant-women";
const FDA_PREGNANCY_GUIDANCE =
  "https://www.fda.gov/food/people-risk-foodborne-illness/food-safety-pregnant-women-and-their-unborn-babies";
const FDA_ANIMAL_PRODUCT_GUIDANCE =
  "https://www.fda.gov/food/people-risk-foodborne-illness/meat-poultry-seafood-food-safety-moms-be";

export const unpasteurizedPregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-unpasteurized-product",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "CDC, Safer Food Choices for Pregnant Women",
      guidance:
        "Pregnant people should avoid unpasteurized milk and dairy products and unpasteurized juice or cider.",
      sourceReference: CDC_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "The food is reliably identified as pasteurization-sensitive dairy, juice, or cider.",
        "Unpasteurized status is supported by confirmed evidence or an explicit readable warning.",
      ],
      scopeLimitations: [
        "This rule does not infer pasteurization from appearance.",
        "This rule does not cover queso fresco reheating or other conditions the current facts cannot represent.",
      ],
    },
  });

export const uncertainPasteurizationPregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-pasteurization-unknown",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "FoodSafety.gov, People at Risk: Pregnant Women",
      guidance:
        "Pregnant people should choose pasteurized dairy and juice; unknown pasteurization can conceal an avoid-level risk.",
      sourceReference: FOOD_SAFETY_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "A pasteurization-sensitive category is present or consequentially uncertain.",
      ],
      scopeLimitations: [
        "The rule asks only about pasteurization and does not clear an independent preparation contradiction.",
      ],
    },
  });

export const rawAnimalProductPregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-raw-animal-product",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "FoodSafety.gov, People at Risk: Pregnant Women",
      guidance:
        "Pregnant people should avoid raw meat, seafood, shellfish, and raw or lightly cooked eggs.",
      sourceReference: FOOD_SAFETY_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "A supported animal-product category and raw status are established by confirmed evidence.",
      ],
      scopeLimitations: [
        "This rule does not infer raw animal products solely from appearance or a typical recipe.",
        "Component-scoped preparation in composite foods is outside the current fact model.",
      ],
    },
  });

export const undercookedAnimalProductPregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-undercooked-animal-product",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "FDA, Meat, Poultry & Seafood (Food Safety for Moms-to-Be)",
      guidance:
        "Pregnant people should avoid raw or undercooked meat, poultry, finfish, and shellfish.",
      sourceReference: FDA_ANIMAL_PRODUCT_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "A supported animal-product category is present and undercooked status is confirmed.",
      ],
      scopeLimitations: [
        "The rule does not infer internal cooking temperature from an image.",
        "Category-specific temperature thresholds are not inferred without reliable category and temperature evidence.",
      ],
    },
  });

export const uncertainAnimalPreparationPregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-animal-preparation-unknown",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "FDA, Food Safety for Pregnant Women and Their Unborn Babies",
      guidance:
        "Raw or undercooked animal products are higher-risk choices during pregnancy, so consequentially unknown preparation should be resolved.",
      sourceReference: FDA_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "A supported animal-product category is present or consequentially uncertain.",
      ],
      scopeLimitations: [
        "A clarification is offered only when an existing preparation patch can change the rule outcome.",
      ],
    },
  });

export const rawPlantOrDoughPregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-raw-sprout-or-dough",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "CDC, Safer Food Choices for Pregnant Women",
      guidance:
        "Raw or undercooked sprouts and raw dough or batter are riskier choices during pregnancy.",
      sourceReference: CDC_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "Sprouts, dough, or batter and their raw or undercooked state are reliably represented in normalized facts.",
      ],
      scopeLimitations: [
        "The rule does not infer raw preparation from a food name alone.",
        "It does not cover washing, refrigeration, storage time, or serving history.",
      ],
    },
  });

export const uncertainPlantOrDoughPreparationPregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-sprout-or-dough-preparation-unknown",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "CDC, Safer Food Choices for Pregnant Women",
      guidance:
        "Sprouts should be cooked thoroughly and flour-based dough or batter should be cooked before eating.",
      sourceReference: CDC_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "A supported sprout, dough, or batter category is present and preparation could conceal a raw-food risk.",
      ],
      scopeLimitations: [
        "This rule does not treat an unrelated preparation uncertainty as pregnancy-relevant.",
      ],
    },
  });

export const clearedPregnancyPreparationRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-preparation-cleared",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "FoodSafety.gov, People at Risk: Pregnant Women",
      guidance:
        "Pasteurized products and thoroughly cooked supported food categories clear the corresponding local preparation concern.",
      sourceReference: FOOD_SAFETY_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "The applicable safe preparation fact is supported by confirmed evidence.",
      ],
      scopeLimitations: [
        "A cleared rule is non-contributing and does not declare the whole food safe.",
        "It does not clear another component, restriction, or independent contradiction.",
      ],
    },
  });

export const nonApplicablePregnancyRule =
  safetyRuleDefinitionSchema.parse({
    id: "pregnancy-no-relevant-food-risk",
    version: PREGNANCY_RULE_VERSION,
    restriction: "pregnancy",
    provenance: {
      source: "CDC, Safer Food Choices for Pregnant Women",
      guidance:
        "Pregnancy food-safety rules apply to specific higher-risk food and preparation categories rather than every characterized food.",
      sourceReference: CDC_PREGNANCY_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: PREGNANCY_RULE_VERSION,
      assumptions: [
        "No approved Task 13 category or consequentially relevant preparation gap is present.",
      ],
      scopeLimitations: [
        "Not applicable is non-contributing and is not a global safety conclusion.",
      ],
    },
  });

export const pregnancyRuleDefinitions: readonly SafetyRuleDefinition[] = [
  unpasteurizedPregnancyRule,
  uncertainPasteurizationPregnancyRule,
  rawAnimalProductPregnancyRule,
  undercookedAnimalProductPregnancyRule,
  uncertainAnimalPreparationPregnancyRule,
  rawPlantOrDoughPregnancyRule,
  uncertainPlantOrDoughPreparationPregnancyRule,
  clearedPregnancyPreparationRule,
  nonApplicablePregnancyRule,
];

type PregnancyConcern = "pasteurization" | "animal" | "sproutOrDough";

type CategoryClaim = Readonly<{
  id: string;
  category: PregnancyConcern;
  certainty: "confirmed" | "uncertain";
  evidenceIds: readonly string[];
}>;

export type PregnancyRuleEvaluation = Readonly<{
  concern: PregnancyConcern | "none";
  ruleMatch: RuleMatch;
  evidence: readonly EvidenceItem[];
  clarificationQuestion?: ClarificationQuestion;
}>;

const CATEGORY_TERMS: Readonly<Record<PregnancyConcern, ReadonlySet<string>>> = {
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
};

const explicitUnpasteurizedWarningPattern =
  /\b(?:unpasteurized|raw)\s+(?:milk|dairy|juice|cider)\b/i;
const negatedUnpasteurizedWarningPattern =
  /\b(?:not|no|without)\b[^.!?;]{0,40}\b(?:unpasteurized|raw)\b/i;

const unique = (values: readonly string[]) => [...new Set(values)];

const toRuleDescriptor = (
  definition: SafetyRuleDefinition,
): RuleDescriptor => ({
  id: definition.id,
  version: definition.version,
  restriction: definition.restriction,
});

const termMatchesCategory = (value: string, category: PregnancyConcern) => {
  const term = canonicalizeTerm(value);

  return [...CATEGORY_TERMS[category]].some(
    (categoryTerm) =>
      term === categoryTerm ||
      term.startsWith(`${categoryTerm}-`) ||
      term.endsWith(`-${categoryTerm}`),
  );
};

const ingredientCertainty = (
  ingredient: IngredientEvidence,
): CategoryClaim["certainty"] | null => {
  if (ingredient.presence === "confirmed") {
    return "confirmed";
  }

  if (
    ingredient.presence === "likely" ||
    ingredient.presence === "possible" ||
    ingredient.presence === "unknown"
  ) {
    return "uncertain";
  }

  return null;
};

const collectCategoryClaims = (
  facts: ExtractedFoodFacts,
): readonly CategoryClaim[] => {
  const claims: CategoryClaim[] = [];

  for (const category of [
    "pasteurization",
    "animal",
    "sproutOrDough",
  ] as const) {
    for (const ingredient of facts.ingredients) {
      const certainty = ingredientCertainty(ingredient);

      if (certainty && termMatchesCategory(ingredient.ingredientId, category)) {
        claims.push({
          id: ingredient.id,
          category,
          certainty,
          evidenceIds: ingredient.evidenceIds,
        });
      }
    }

    for (const candidate of facts.foodCandidates) {
      const categoryName = candidate.canonicalName ?? candidate.displayName;

      if (termMatchesCategory(categoryName, category)) {
        claims.push({
          id: candidate.id,
          category,
          certainty:
            candidate.identityConfidence === "high"
              ? "confirmed"
              : "uncertain",
          evidenceIds: candidate.evidenceIds,
        });
      }
    }
  }

  for (const label of facts.labels) {
    if (
      label.legibility === "readable" &&
      explicitUnpasteurizedWarningPattern.test(label.text) &&
      !negatedUnpasteurizedWarningPattern.test(label.text) &&
      !/\bmade\s+with\s+pasteurized\b/i.test(label.text)
    ) {
      claims.push({
        id: label.id,
        category: "pasteurization",
        certainty: "confirmed",
        evidenceIds: label.evidenceIds,
      });
    }
  }

  return claims;
};

const getEvidence = (
  evidenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) => {
  const deduplicatedIds = unique(evidenceIds);

  return {
    evidenceIds: deduplicatedIds,
    evidence: deduplicatedIds.flatMap((evidenceId) => {
      const evidence = evidenceById.get(evidenceId);
      return evidence ? [evidence] : [];
    }),
  };
};

type PreparationEvidenceValue =
  | "pasteurized"
  | "unpasteurized"
  | "fullyCooked"
  | "raw"
  | "undercooked"
  | "rawAnimalYes"
  | "rawAnimalNo";

const preparationValuePatterns: Readonly<
  Record<PreparationEvidenceValue, RegExp>
> = {
  pasteurized:
    /\b(?:is|are|was|were|uses?|used|contains?|includes?|includes?\s+only|made\s+with)\b[^.!?;]{0,40}\bpasteurized\b|\bpasteurized\b[^.!?;]{0,30}\b(?:milk|dairy|juice|ingredient|product)\b/i,
  unpasteurized:
    /\b(?:is|are|was|were|uses?|used|contains?|includes?|made\s+with|confirmed)\b[^.!?;]{0,40}\bunpasteurized\b|\bunpasteurized\b[^.!?;]{0,30}\b(?:milk|dairy|juice|ingredient|product|status)\b|\bnot\s+pasteurized\b/i,
  fullyCooked:
    /\b(?:is|are|was|were|has\s+been|have\s+been)\b[^.!?;]{0,20}\b(?:fully|thoroughly)\s+cooked\b|\b(?:is|are|was|were|has\s+been|have\s+been)\b[^.!?;]{0,20}\bcooked\s+through\b/i,
  raw: /\b(?:is|are|was|were|contains?|includes?|has)\b[^.!?;]{0,30}\braw\b/i,
  undercooked:
    /\b(?:is|are|was|were|remains?)\b[^.!?;]{0,20}\bundercooked\b|\b(?:is|are|was|were)\b[^.!?;]{0,20}\bnot\s+fully\s+cooked\b/i,
  rawAnimalYes:
    /\b(?:contains?|has|includes?)\b[^.!?;]{0,40}\braw\s+(?:animal|meat|seafood|fish|egg)\b|\braw\s+animal\s+product\s+(?:is\s+)?(?:present|yes)\b/i,
  rawAnimalNo:
    /\b(?:does\s+not|doesn't)\s+contain\b[^.!?;]{0,30}\braw\s+(?:animal|meat|seafood|fish|egg)\b|\b(?:no|without)\s+raw\s+(?:animal|meat|seafood|fish|egg)\b|\bfree\s+from\s+raw\s+(?:animal|meat|seafood|fish|egg)(?:\s+products?)?\b|\braw\s+(?:animal|meat|seafood|fish|egg)(?:\s+products?)?\s+(?:is|are)\s+absent\b|\braw\s+animal\s+product\s+(?:is\s+)?(?:absent|no)\b/i,
};

const nonAffirmativePreparationPattern =
  /\b(?:unknown|unclear|unconfirmed|not\s+confirmed|may|might|possible|possibly|appears?|looks?|seems?|no\s+evidence)\b/i;

const rejectsPreparationValue = (
  summary: string,
  value: PreparationEvidenceValue,
) => {
  if (value === "rawAnimalNo") {
    return (
      nonAffirmativePreparationPattern.test(summary) ||
      !preparationValuePatterns.rawAnimalNo.test(summary)
    );
  }

  if (nonAffirmativePreparationPattern.test(summary)) {
    return true;
  }

  if (value === "unpasteurized" && /\bnot\s+pasteurized\b/i.test(summary)) {
    return false;
  }

  if (value === "pasteurized") {
    return /\b(?:unpasteurized|not\s+pasteurized)\b/i.test(summary);
  }

  if (value === "unpasteurized") {
    return (
      /\bnot\s+unpasteurized\b/i.test(summary) ||
      /\b(?:no|without)\b[^.!?;]{0,30}\bunpasteurized\b/i.test(summary) ||
      /\bunpasteurized\b[^.!?;]{0,30}\b(?:is|are)\s+absent\b/i.test(summary)
    );
  }

  if (value === "fullyCooked") {
    const expresslyNotFullyCooked =
      /\b(?:not\s+fully\s+cooked|undercooked)\b/i.test(summary);
    const affirmedRaw =
      preparationValuePatterns.raw.test(summary) &&
      !preparationValuePatterns.rawAnimalNo.test(summary) &&
      !/\b(?:not|no|without|absent|free\s+from)\b[^.!?;]{0,30}\braw\b/i.test(
        summary,
      );

    return expresslyNotFullyCooked || affirmedRaw;
  }

  if (value === "raw") {
    return (
      /\b(?:not|no|without|free\s+from)\b[^.!?;]{0,30}\braw\b/i.test(
        summary,
      ) ||
      /\braw\b[^.!?;]{0,30}\babsent\b/i.test(summary)
    );
  }

  if (value === "undercooked") {
    return /\b(?:not\s+undercooked|fully\s+cooked)\b/i.test(summary);
  }

  if (value === "rawAnimalYes") {
    return preparationValuePatterns.rawAnimalNo.test(summary);
  }

  return (
    preparationValuePatterns.rawAnimalYes.test(summary) &&
    !preparationValuePatterns.rawAnimalNo.test(summary)
  );
};

const hasReliablePreparationValueEvidence = (
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
  value: PreparationEvidenceValue,
  concern: PregnancyConcern,
  requiredSource?: "userProvided",
) =>
  facts.preparation.evidenceIds.some((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    const namesAnimalComponent =
      /\b(?:meat|poultry|beef|pork|lamb|veal|chicken|turkey|seafood|fish|shellfish|salmon|tuna|egg)\b/i.test(
        evidence?.summary ?? "",
      );
    const namesSproutOrDoughComponent =
      /\b(?:sprout|sprouts|dough|batter)\b/i.test(evidence?.summary ?? "");
    const namesUnrelatedComponent =
      (concern === "animal" &&
        namesSproutOrDoughComponent &&
        !namesAnimalComponent) ||
      (concern === "sproutOrDough" &&
        namesAnimalComponent &&
        !namesSproutOrDoughComponent);

    return (
      evidence?.strength === "confirmed" &&
      (evidence.source === "readableOnLabel" ||
        evidence.source === "userProvided") &&
      (!requiredSource || evidence.source === requiredSource) &&
      preparationValuePatterns[value].test(evidence.summary) &&
      !rejectsPreparationValue(evidence.summary, value) &&
      !namesUnrelatedComponent
    );
  });

const hasUnknownUserAnswer = (
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
  subjectPattern: RegExp,
) =>
  facts.preparation.evidenceIds.some((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return (
      evidence?.source === "userProvided" &&
      evidence.strength === "unknown" &&
      subjectPattern.test(evidence.summary)
    );
  });

const contradictionApplies = (
  text: string,
  concern: PregnancyConcern,
) => {
  const normalizedPath = canonicalizeTerm(text);

  if (concern === "pasteurization") {
    return normalizedPath.includes("pasteurization");
  }

  return (
    normalizedPath.includes("doneness") ||
    normalizedPath.includes("raw-animal-product")
  );
};

const broadPreparationGapPattern =
  /\b(?:preparation|cooking|doneness|pasteurization)\s+(?:is\s+)?(?:unknown|unclear|unavailable|not\s+(?:known|observed|visible))\b/i;

const getConcernGaps = (
  concern: PregnancyConcern,
  claims: readonly CategoryClaim[],
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) => {
  const claimIds = new Set(claims.map((claim) => claim.id));
  const presenceGapIds = claims
    .filter((claim) => claim.certainty === "uncertain")
    .map((claim) => claim.id);
  const independentRiskIds: string[] = [];
  const evidenceIds: string[] = [];

  if (concern === "pasteurization") {
    for (const label of facts.labels) {
      if (
        label.legibility === "unreadable" ||
        (label.legibility === "partial" &&
          /\b(?:pasteuri[sz](?:ation|ed)?|milk|dairy|juice|cider|ingredient)\b/i.test(
            label.text,
          ))
      ) {
        presenceGapIds.push(label.id);
        evidenceIds.push(...label.evidenceIds);
      }
    }
  }

  for (const contradiction of facts.contradictions) {
    if (
      contradictionApplies(
        `${contradiction.factPath} ${contradiction.description}`,
        concern,
      )
    ) {
      independentRiskIds.push(contradiction.id);
      evidenceIds.push(
        ...contradiction.competingClaims.flatMap(
          (claim) => claim.evidenceIds,
        ),
      );
    }
  }

  for (const uncertainty of facts.uncertainties) {
    if (
      uncertainty.safetyRelevance === "informational" ||
      (uncertainty.kind !== "preparation" &&
        uncertainty.kind !== "contradiction")
    ) {
      continue;
    }

    const text = `${uncertainty.subject} ${uncertainty.description}`;
    const referencesClaim = uncertainty.relatedFactIds.some((factId) =>
      claimIds.has(factId),
    );
    const referencesConcern =
      concern === "pasteurization"
        ? /\bpasteuri[sz]/i.test(text)
        : /\b(?:raw|undercooked|doneness|animal\s+product|cook(?:ed|ing)?)\b/i.test(
            text,
          );
    const isUnbounded =
      uncertainty.relatedFactIds.length === 0 &&
      broadPreparationGapPattern.test(text);

    if (referencesClaim || referencesConcern || isUnbounded) {
      evidenceIds.push(
        ...uncertainty.relatedFactIds.filter((factId) =>
          evidenceById.has(factId),
        ),
      );

      if (uncertainty.kind === "contradiction") {
        independentRiskIds.push(uncertainty.id);
      } else {
        presenceGapIds.push(uncertainty.id);
      }
    }
  }

  return {
    presenceGapIds: unique(presenceGapIds),
    independentRiskIds: unique(independentRiskIds),
    evidenceIds: unique(evidenceIds),
  };
};

const confidenceFromEvidence = (
  evidenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, EvidenceItem>,
): ConfidenceLevel => {
  const strengths = evidenceIds.flatMap((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return evidence ? [evidence.strength] : [];
  });

  if (strengths.includes("confirmed")) {
    return "high";
  }

  if (strengths.includes("likely")) {
    return "medium";
  }

  return "low";
};

const createPasteurizationQuestion = (): ClarificationQuestion => ({
  id: "pregnancy-pasteurization-question",
  prompt: "Is this product pasteurized?",
  whyItMatters:
    "Unpasteurized dairy and juice can change the pregnancy recommendation.",
  relatedRuleIds: [uncertainPasteurizationPregnancyRule.id],
  relatedFactIds: ["preparation-pasteurization"],
  answerOptions: [
    {
      id: "pasteurized",
      label: "Yes, it is pasteurized",
      patch: {
        kind: "setPasteurization",
        value: "pasteurized",
        source: "userProvided",
      },
    },
    {
      id: "unpasteurized",
      label: "No, it is unpasteurized",
      patch: {
        kind: "setPasteurization",
        value: "unpasteurized",
        source: "userProvided",
      },
    },
    {
      id: "unknown",
      label: "I’m not sure",
      patch: {
        kind: "setPasteurization",
        value: "unknown",
        source: "userProvided",
      },
    },
  ],
});

const createDonenessQuestion = (
  relatedRuleId: string,
): ClarificationQuestion => ({
  id: `pregnancy-${relatedRuleId}-doneness-question`,
  prompt: "Is this food fully cooked?",
  whyItMatters:
    "Raw or undercooked food in this category can change the pregnancy recommendation.",
  relatedRuleIds: [relatedRuleId],
  relatedFactIds: ["preparation-doneness"],
  answerOptions: [
    {
      id: "fully-cooked",
      label: "Yes, it is fully cooked",
      patch: {
        kind: "setDoneness",
        value: "fullyCooked",
        source: "userProvided",
      },
    },
    {
      id: "undercooked",
      label: "No, it is raw or undercooked",
      patch: {
        kind: "setDoneness",
        value: "undercooked",
        source: "userProvided",
      },
    },
    {
      id: "unknown",
      label: "I’m not sure",
      patch: {
        kind: "setDoneness",
        value: "unknown",
        source: "userProvided",
      },
    },
  ],
});

const createRawAnimalProductQuestion = (): ClarificationQuestion => ({
  id: "pregnancy-raw-animal-product-question",
  prompt: "Does this contain a raw animal product?",
  whyItMatters:
    "A raw animal product can change the pregnancy recommendation.",
  relatedRuleIds: [uncertainAnimalPreparationPregnancyRule.id],
  relatedFactIds: ["preparation-raw-animal-product"],
  answerOptions: [
    {
      id: "yes",
      label: "Yes",
      patch: {
        kind: "setRawAnimalProduct",
        value: "yes",
        source: "userProvided",
      },
    },
    {
      id: "no",
      label: "No",
      patch: {
        kind: "setRawAnimalProduct",
        value: "no",
        source: "userProvided",
      },
    },
    {
      id: "unknown",
      label: "I’m not sure",
      patch: {
        kind: "setRawAnimalProduct",
        value: "unknown",
        source: "userProvided",
      },
    },
  ],
});

const createMatch = ({
  definition,
  status,
  risk,
  recommendedVerdict,
  reasonKey,
  evidenceIds,
  missingFactIds,
  evidenceConfidence,
}: Readonly<{
  definition: SafetyRuleDefinition;
  status: "triggered" | "uncertain";
  risk: "critical" | "high";
  recommendedVerdict: "avoid" | "needMoreInformation";
  reasonKey: string;
  evidenceIds: readonly string[];
  missingFactIds: readonly string[];
  evidenceConfidence: ConfidenceLevel;
}>): RuleMatch => ({
  rule: toRuleDescriptor(definition),
  status,
  risk,
  recommendedVerdict,
  reasonKey,
  evidenceIds: [...evidenceIds],
  missingFactIds: [...missingFactIds],
  evidenceConfidence,
});

const createNeutralMatch = (
  definition: SafetyRuleDefinition,
  status: "cleared" | "notApplicable",
  reasonKey: string,
  evidenceIds: readonly string[],
): RuleMatch => ({
  rule: toRuleDescriptor(definition),
  status,
  risk: "informational",
  recommendedVerdict: null,
  reasonKey,
  evidenceIds: [...evidenceIds],
  missingFactIds: [],
  evidenceConfidence: "high",
});

const findExplicitUnpasteurizedWarnings = (
  facts: ExtractedFoodFacts,
  claims: readonly CategoryClaim[],
) => {
  const hasConfirmedCategory = claims.some(
    (claim) => claim.certainty === "confirmed",
  );

  if (!hasConfirmedCategory) {
    return [];
  }

  return facts.labels.filter(
    (label) =>
      label.legibility === "readable" &&
      explicitUnpasteurizedWarningPattern.test(label.text) &&
      !negatedUnpasteurizedWarningPattern.test(label.text) &&
      !/\bmade\s+with\s+pasteurized\b/i.test(label.text),
  );
};

const evaluatePasteurizationConcern = (
  claims: readonly CategoryClaim[],
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
): PregnancyRuleEvaluation => {
  const claimEvidenceIds = unique(
    claims.flatMap((claim) => claim.evidenceIds),
  );
  const gaps = getConcernGaps(
    "pasteurization",
    claims,
    facts,
    evidenceById,
  );
  const warningLabels = findExplicitUnpasteurizedWarnings(facts, claims);
  const warningEvidenceIds = unique(
    warningLabels.flatMap((label) => label.evidenceIds),
  );
  const hasReliablePasteurizedEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "pasteurized",
      "pasteurization",
    );
  const hasReliableUnpasteurizedEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "unpasteurized",
      "pasteurization",
    );
  const userResolvedPreparation = hasReliablePreparationValueEvidence(
    facts,
    evidenceById,
    "pasteurized",
    "pasteurization",
    "userProvided",
  );
  const hasConfirmedCategory = claims.some(
    (claim) => claim.certainty === "confirmed",
  );

  if (
    hasConfirmedCategory &&
    (warningLabels.length > 0 ||
      (facts.preparation.pasteurization === "unpasteurized" &&
        hasReliableUnpasteurizedEvidence))
  ) {
    const { evidenceIds, evidence } = getEvidence(
      [
        ...claimEvidenceIds,
        ...warningEvidenceIds,
        ...facts.preparation.evidenceIds,
      ],
      evidenceById,
    );

    return {
      concern: "pasteurization",
      ruleMatch: createMatch({
        definition: unpasteurizedPregnancyRule,
        status: "triggered",
        risk: "critical",
        recommendedVerdict: "avoid",
        reasonKey: "pregnancy-unpasteurized-product",
        evidenceIds,
        missingFactIds: [],
        evidenceConfidence: "high",
      }),
      evidence,
    };
  }

  const unresolvedGapIds = unique([
    ...gaps.independentRiskIds,
    ...(facts.preparation.pasteurization === "pasteurized" &&
    hasReliablePasteurizedEvidence &&
    userResolvedPreparation
      ? []
      : gaps.presenceGapIds),
    ...(facts.preparation.pasteurization === "unknown" ||
    facts.preparation.pasteurization === "notApplicable" ||
    (facts.preparation.pasteurization === "pasteurized" &&
      !hasReliablePasteurizedEvidence) ||
    (facts.preparation.pasteurization === "unpasteurized" &&
      !hasReliableUnpasteurizedEvidence)
      ? ["preparation-pasteurization"]
      : []),
  ]);

  if (unresolvedGapIds.length > 0) {
    const { evidenceIds, evidence } = getEvidence(
      [
        ...claimEvidenceIds,
        ...facts.preparation.evidenceIds,
        ...gaps.evidenceIds,
      ],
      evidenceById,
    );
    const canClarify =
      gaps.independentRiskIds.length === 0 &&
      !hasUnknownUserAnswer(facts, evidenceById, /\bpasteuri[sz]/i);

    return {
      concern: "pasteurization",
      ruleMatch: createMatch({
        definition: uncertainPasteurizationPregnancyRule,
        status: "uncertain",
        risk: "high",
        recommendedVerdict: "needMoreInformation",
        reasonKey: "pregnancy-pasteurization-unknown",
        evidenceIds,
        missingFactIds: unresolvedGapIds,
        evidenceConfidence: confidenceFromEvidence(
          evidenceIds,
          evidenceById,
        ),
      }),
      evidence,
      ...(canClarify
        ? { clarificationQuestion: createPasteurizationQuestion() }
        : {}),
    };
  }

  const { evidenceIds, evidence } = getEvidence(
    [...claimEvidenceIds, ...facts.preparation.evidenceIds],
    evidenceById,
  );

  return {
    concern: "pasteurization",
    ruleMatch: createNeutralMatch(
      clearedPregnancyPreparationRule,
      "cleared",
      "pregnancy-pasteurization-cleared",
      evidenceIds,
    ),
    evidence,
  };
};

const evaluateAnimalConcern = (
  claims: readonly CategoryClaim[],
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
): PregnancyRuleEvaluation => {
  const claimEvidenceIds = unique(
    claims.flatMap((claim) => claim.evidenceIds),
  );
  const gaps = getConcernGaps("animal", claims, facts, evidenceById);
  const hasReliableRawEvidence = hasReliablePreparationValueEvidence(
    facts,
    evidenceById,
    "raw",
    "animal",
  );
  const hasReliableUndercookedEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "undercooked",
      "animal",
    );
  const hasReliableFullyCookedEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "fullyCooked",
      "animal",
    );
  const hasReliableRawAnimalYesEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "rawAnimalYes",
      "animal",
    );
  const hasReliableRawAnimalNoEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "rawAnimalNo",
      "animal",
    );
  const userResolvedPreparation = hasReliablePreparationValueEvidence(
    facts,
    evidenceById,
    facts.preparation.doneness === "fullyCooked"
      ? "fullyCooked"
      : "rawAnimalNo",
    "animal",
    "userProvided",
  );
  const hasConfirmedCategory = claims.some(
    (claim) => claim.certainty === "confirmed",
  );

  if (
    hasConfirmedCategory &&
    facts.preparation.rawAnimalProduct === "yes" &&
    hasReliableRawAnimalYesEvidence
  ) {
    const { evidenceIds, evidence } = getEvidence(
      [...claimEvidenceIds, ...facts.preparation.evidenceIds],
      evidenceById,
    );

    return {
      concern: "animal",
      ruleMatch: createMatch({
        definition: rawAnimalProductPregnancyRule,
        status: "triggered",
        risk: "critical",
        recommendedVerdict: "avoid",
        reasonKey: "pregnancy-raw-animal-product",
        evidenceIds,
        missingFactIds: [],
        evidenceConfidence: "high",
      }),
      evidence,
    };
  }

  if (
    hasConfirmedCategory &&
    (facts.preparation.doneness === "raw" ||
      facts.preparation.doneness === "undercooked") &&
    (facts.preparation.doneness === "raw"
      ? hasReliableRawEvidence
      : hasReliableUndercookedEvidence)
  ) {
    const { evidenceIds, evidence } = getEvidence(
      [...claimEvidenceIds, ...facts.preparation.evidenceIds],
      evidenceById,
    );

    return {
      concern: "animal",
      ruleMatch: createMatch({
        definition:
          facts.preparation.doneness === "raw"
            ? rawAnimalProductPregnancyRule
            : undercookedAnimalProductPregnancyRule,
        status: "triggered",
        risk: "critical",
        recommendedVerdict: "avoid",
        reasonKey:
          facts.preparation.doneness === "raw"
            ? "pregnancy-raw-animal-product"
            : "pregnancy-undercooked-animal-product",
        evidenceIds,
        missingFactIds: [],
        evidenceConfidence: "high",
      }),
      evidence,
    };
  }

  const preparationResolved =
    facts.preparation.doneness === "fullyCooked" &&
    hasReliableFullyCookedEvidence;
  const rawStatusResolved =
    facts.preparation.rawAnimalProduct === "no" &&
    hasReliableRawAnimalNoEvidence;
  const unresolvedPreparationIds = [
    ...(facts.preparation.doneness === "unknown" ||
    (facts.preparation.doneness === "fullyCooked" &&
      !hasReliableFullyCookedEvidence) ||
    (facts.preparation.doneness === "raw" &&
      !hasReliableRawEvidence) ||
    (facts.preparation.doneness === "undercooked" &&
      !hasReliableUndercookedEvidence)
      ? ["preparation-doneness"]
      : []),
    ...((facts.preparation.rawAnimalProduct === "unknown" &&
      facts.preparation.doneness === "notApplicable") ||
    (facts.preparation.rawAnimalProduct === "yes" &&
      !hasReliableRawAnimalYesEvidence) ||
    (facts.preparation.rawAnimalProduct === "no" &&
      !hasReliableRawAnimalNoEvidence &&
      !preparationResolved)
      ? ["preparation-raw-animal-product"]
      : []),
  ];
  const unresolvedGapIds = unique([
    ...gaps.independentRiskIds,
    ...((preparationResolved || rawStatusResolved) &&
    userResolvedPreparation
      ? []
      : gaps.presenceGapIds),
    ...unresolvedPreparationIds,
  ]);

  if (unresolvedGapIds.length > 0) {
    const { evidenceIds, evidence } = getEvidence(
      [
        ...claimEvidenceIds,
        ...facts.preparation.evidenceIds,
        ...gaps.evidenceIds,
      ],
      evidenceById,
    );
    const needsRawAnimalAnswer =
      unresolvedPreparationIds.includes(
        "preparation-raw-animal-product",
      ) && !unresolvedPreparationIds.includes("preparation-doneness");
    const canClarify =
      gaps.independentRiskIds.length === 0 &&
      !hasUnknownUserAnswer(
        facts,
        evidenceById,
        needsRawAnimalAnswer
          ? /\braw\s+animal\b/i
          : /\b(?:doneness|cook(?:ed|ing)?)\b/i,
      );

    return {
      concern: "animal",
      ruleMatch: createMatch({
        definition: uncertainAnimalPreparationPregnancyRule,
        status: "uncertain",
        risk: "high",
        recommendedVerdict: "needMoreInformation",
        reasonKey: "pregnancy-animal-preparation-unknown",
        evidenceIds,
        missingFactIds: unresolvedGapIds,
        evidenceConfidence: confidenceFromEvidence(
          evidenceIds,
          evidenceById,
        ),
      }),
      evidence,
      ...(canClarify
        ? {
            clarificationQuestion: needsRawAnimalAnswer
              ? createRawAnimalProductQuestion()
              : createDonenessQuestion(
                  uncertainAnimalPreparationPregnancyRule.id,
                ),
          }
        : {}),
    };
  }

  const { evidenceIds, evidence } = getEvidence(
    [...claimEvidenceIds, ...facts.preparation.evidenceIds],
    evidenceById,
  );

  return {
    concern: "animal",
    ruleMatch: createNeutralMatch(
      clearedPregnancyPreparationRule,
      "cleared",
      "pregnancy-animal-preparation-cleared",
      evidenceIds,
    ),
    evidence,
  };
};

const evaluateSproutOrDoughConcern = (
  claims: readonly CategoryClaim[],
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
): PregnancyRuleEvaluation => {
  const claimEvidenceIds = unique(
    claims.flatMap((claim) => claim.evidenceIds),
  );
  const gaps = getConcernGaps(
    "sproutOrDough",
    claims,
    facts,
    evidenceById,
  );
  const hasReliableRawEvidence = hasReliablePreparationValueEvidence(
    facts,
    evidenceById,
    "raw",
    "sproutOrDough",
  );
  const hasReliableUndercookedEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "undercooked",
      "sproutOrDough",
    );
  const hasReliableFullyCookedEvidence =
    hasReliablePreparationValueEvidence(
      facts,
      evidenceById,
      "fullyCooked",
      "sproutOrDough",
    );
  const userResolvedPreparation = hasReliablePreparationValueEvidence(
    facts,
    evidenceById,
    "fullyCooked",
    "sproutOrDough",
    "userProvided",
  );
  const hasConfirmedCategory = claims.some(
    (claim) => claim.certainty === "confirmed",
  );

  if (
    hasConfirmedCategory &&
    (facts.preparation.doneness === "raw" ||
      facts.preparation.doneness === "undercooked") &&
    (facts.preparation.doneness === "raw"
      ? hasReliableRawEvidence
      : hasReliableUndercookedEvidence)
  ) {
    const { evidenceIds, evidence } = getEvidence(
      [...claimEvidenceIds, ...facts.preparation.evidenceIds],
      evidenceById,
    );

    return {
      concern: "sproutOrDough",
      ruleMatch: createMatch({
        definition: rawPlantOrDoughPregnancyRule,
        status: "triggered",
        risk: "high",
        recommendedVerdict: "avoid",
        reasonKey: "pregnancy-raw-sprout-or-dough",
        evidenceIds,
        missingFactIds: [],
        evidenceConfidence: "high",
      }),
      evidence,
    };
  }

  const preparationResolved =
    facts.preparation.doneness === "fullyCooked" &&
    hasReliableFullyCookedEvidence;
  const unresolvedGapIds = unique([
    ...gaps.independentRiskIds,
    ...(preparationResolved && userResolvedPreparation
      ? []
      : gaps.presenceGapIds),
    ...(facts.preparation.doneness === "unknown" ||
    facts.preparation.doneness === "notApplicable" ||
    (facts.preparation.doneness === "fullyCooked" &&
      !hasReliableFullyCookedEvidence) ||
    (facts.preparation.doneness === "raw" &&
      !hasReliableRawEvidence) ||
    (facts.preparation.doneness === "undercooked" &&
      !hasReliableUndercookedEvidence)
      ? ["preparation-doneness"]
      : []),
  ]);

  if (unresolvedGapIds.length > 0) {
    const { evidenceIds, evidence } = getEvidence(
      [
        ...claimEvidenceIds,
        ...facts.preparation.evidenceIds,
        ...gaps.evidenceIds,
      ],
      evidenceById,
    );
    const canClarify =
      gaps.independentRiskIds.length === 0 &&
      !hasUnknownUserAnswer(
        facts,
        evidenceById,
        /\b(?:doneness|cook(?:ed|ing)?)\b/i,
      );

    return {
      concern: "sproutOrDough",
      ruleMatch: createMatch({
        definition: uncertainPlantOrDoughPreparationPregnancyRule,
        status: "uncertain",
        risk: "high",
        recommendedVerdict: "needMoreInformation",
        reasonKey: "pregnancy-sprout-or-dough-preparation-unknown",
        evidenceIds,
        missingFactIds: unresolvedGapIds,
        evidenceConfidence: confidenceFromEvidence(
          evidenceIds,
          evidenceById,
        ),
      }),
      evidence,
      ...(canClarify
        ? {
            clarificationQuestion: createDonenessQuestion(
              uncertainPlantOrDoughPreparationPregnancyRule.id,
            ),
          }
        : {}),
    };
  }

  const { evidenceIds, evidence } = getEvidence(
    [...claimEvidenceIds, ...facts.preparation.evidenceIds],
    evidenceById,
  );

  return {
    concern: "sproutOrDough",
    ruleMatch: createNeutralMatch(
      clearedPregnancyPreparationRule,
      "cleared",
      "pregnancy-sprout-or-dough-preparation-cleared",
      evidenceIds,
    ),
    evidence,
  };
};

export const evaluatePregnancyRules = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
): readonly PregnancyRuleEvaluation[] => {
  if (!profile.pregnancy) {
    return [];
  }

  const evidenceById = new Map(
    facts.evidence.map((evidence) => [evidence.id, evidence]),
  );
  const claims = collectCategoryClaims(facts);
  const evaluations: PregnancyRuleEvaluation[] = [];

  for (const concern of [
    "pasteurization",
    "animal",
    "sproutOrDough",
  ] as const) {
    const concernClaims = claims.filter((claim) => claim.category === concern);

    if (concernClaims.length === 0) {
      continue;
    }

    if (concern === "pasteurization") {
      evaluations.push(
        evaluatePasteurizationConcern(
          concernClaims,
          facts,
          evidenceById,
        ),
      );
    } else if (concern === "animal") {
      evaluations.push(
        evaluateAnimalConcern(concernClaims, facts, evidenceById),
      );
    } else {
      evaluations.push(
        evaluateSproutOrDoughConcern(
          concernClaims,
          facts,
          evidenceById,
        ),
      );
    }
  }

  if (evaluations.length > 0) {
    return evaluations;
  }

  return [
    {
      concern: "none",
      ruleMatch: createNeutralMatch(
        nonApplicablePregnancyRule,
        "notApplicable",
        "pregnancy-no-relevant-food-risk",
        [],
      ),
      evidence: [],
    },
  ];
};
