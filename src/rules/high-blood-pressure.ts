import type {
  ClarificationQuestion,
  ConfidenceLevel,
  RuleDescriptor,
  RuleMatch,
} from "@/domain/evaluation";
import type {
  EvidenceItem,
  ExtractedFoodFacts,
  FactContradiction,
  Uncertainty,
} from "@/domain/food";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  safetyRuleDefinitionSchema,
  type SafetyRuleDefinition,
} from "@/rules/provenance";

const HIGH_BLOOD_PRESSURE_RULE_VERSION = "1.0.0";
const REVIEWED_ON = "2026-07-23";
export const HIGH_SODIUM_MILLIGRAMS_PER_SERVING = 460;

const FDA_SODIUM_GUIDANCE =
  "https://www.fda.gov/food/nutrition-education-resources-materials/sodium-your-diet";
const CDC_HIGH_BLOOD_PRESSURE_GUIDANCE =
  "https://www.cdc.gov/high-blood-pressure/prevention/index.html";

export const highSodiumLabelRule = safetyRuleDefinitionSchema.parse({
  id: "high-blood-pressure-high-sodium-label",
  version: HIGH_BLOOD_PRESSURE_RULE_VERSION,
  restriction: "highBloodPressure",
  provenance: {
    source: "U.S. Food and Drug Administration, Sodium in Your Diet",
    guidance:
      "Twenty percent or more of the 2,300 mg sodium Daily Value per serving is considered high; 20% is 460 mg.",
    sourceReference: FDA_SODIUM_GUIDANCE,
    reviewedOn: REVIEWED_ON,
    ruleVersion: HIGH_BLOOD_PRESSURE_RULE_VERSION,
    assumptions: [
      "The sodium amount and serving basis are supported by a confirmed readable Nutrition Facts label.",
    ],
    scopeLimitations: [
      "The rule evaluates one labeled serving and does not calculate total daily intake or multiple servings.",
      "A high-sodium match produces caution, never an avoid verdict.",
    ],
  },
});

export const coarseHighSodiumRule = safetyRuleDefinitionSchema.parse({
  id: "high-blood-pressure-coarse-high-sodium",
  version: HIGH_BLOOD_PRESSURE_RULE_VERSION,
  restriction: "highBloodPressure",
  provenance: {
    source: "Centers for Disease Control and Prevention, Preventing High Blood Pressure",
    guidance:
      "Choosing foods lower in sodium supports blood-pressure management.",
    sourceReference: CDC_HIGH_BLOOD_PRESSURE_GUIDANCE,
    reviewedOn: REVIEWED_ON,
    ruleVersion: HIGH_BLOOD_PRESSURE_RULE_VERSION,
    assumptions: [
      "A coarse high-sodium signal is explicitly supported by relevant evidence.",
    ],
    scopeLimitations: [
      "A coarse signal cannot establish an exact amount or clear a sodium concern.",
      "Food appearance, processing, saltiness, and typical recipes are not sodium measurements.",
    ],
  },
});

export const uncertainSodiumRule = safetyRuleDefinitionSchema.parse({
  id: "high-blood-pressure-sodium-uncertain",
  version: HIGH_BLOOD_PRESSURE_RULE_VERSION,
  restriction: "highBloodPressure",
  provenance: {
    source: "U.S. Food and Drug Administration, Sodium in Your Diet",
    guidance:
      "Sodium label values must be interpreted using their serving basis; unresolved sodium or label information cannot establish a low value.",
    sourceReference: FDA_SODIUM_GUIDANCE,
    reviewedOn: REVIEWED_ON,
    ruleVersion: HIGH_BLOOD_PRESSURE_RULE_VERSION,
    assumptions: [
      "A specific consequential sodium or Nutrition Facts label gap is present.",
    ],
    scopeLimitations: [
      "Uncertainty produces caution rather than an unsupported avoid result.",
      "Missing nutrition information alone is not treated as evidence that sodium is high or low.",
    ],
  },
});

export const belowHighSodiumThresholdRule =
  safetyRuleDefinitionSchema.parse({
    id: "high-blood-pressure-high-sodium-threshold-cleared",
    version: HIGH_BLOOD_PRESSURE_RULE_VERSION,
    restriction: "highBloodPressure",
    provenance: {
      source: "U.S. Food and Drug Administration, Sodium in Your Diet",
      guidance:
        "Less than 20% of the 2,300 mg sodium Daily Value is below the FDA general high-sodium threshold.",
      sourceReference: FDA_SODIUM_GUIDANCE,
      reviewedOn: REVIEWED_ON,
      ruleVersion: HIGH_BLOOD_PRESSURE_RULE_VERSION,
      assumptions: [
        "A confirmed readable label establishes the amount for one stated serving.",
      ],
      scopeLimitations: [
        "Clearance applies only to the high-sodium threshold and is not a global safety conclusion.",
        "Below 460 mg is not described as low sodium unless separate evidence supports that claim.",
      ],
    },
  });

export const nonApplicableSodiumRule = safetyRuleDefinitionSchema.parse({
  id: "high-blood-pressure-no-supported-sodium-concern",
  version: HIGH_BLOOD_PRESSURE_RULE_VERSION,
  restriction: "highBloodPressure",
  provenance: {
    source: "U.S. Food and Drug Administration, Sodium in Your Diet",
    guidance:
      "Sodium decisions should use supported serving-based label information rather than assumptions from appearance or food identity.",
    sourceReference: FDA_SODIUM_GUIDANCE,
    reviewedOn: REVIEWED_ON,
    ruleVersion: HIGH_BLOOD_PRESSURE_RULE_VERSION,
    assumptions: [
      "No supported high-sodium fact or consequential sodium-specific gap is present.",
    ],
    scopeLimitations: [
      "Not applicable is non-contributing and does not mean the food is low sodium.",
    ],
  },
});

export const highBloodPressureRuleDefinitions: readonly SafetyRuleDefinition[] =
  [
    highSodiumLabelRule,
    coarseHighSodiumRule,
    uncertainSodiumRule,
    belowHighSodiumThresholdRule,
    nonApplicableSodiumRule,
  ];

export type HighBloodPressureRuleEvaluation = Readonly<{
  ruleMatch: RuleMatch;
  evidence: readonly EvidenceItem[];
  clarificationQuestion?: ClarificationQuestion;
}>;

const unique = (values: readonly string[]) => [...new Set(values)];

const toRuleDescriptor = (
  definition: SafetyRuleDefinition,
): RuleDescriptor => ({
  id: definition.id,
  version: definition.version,
  restriction: definition.restriction,
});

const collectEvidence = (
  evidenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) => {
  const deduplicatedIds = unique(evidenceIds);
  return {
    evidenceIds: deduplicatedIds,
    evidence: deduplicatedIds.flatMap((id) => {
      const item = evidenceById.get(id);
      return item ? [item] : [];
    }),
  };
};

const sodiumReferencePattern = /\b(?:sodium|nutrition\s+facts?)\b/i;
const wholePackagePattern =
  /\b(?:whole|entire)\s+(?:package|container)\b|\bper\s+(?:package|container)\b/i;
const nonAffirmativePattern =
  /\b(?:not\s+confirmed|unconfirmed|unknown|unclear|may|might|possible|possibly|appears?|looks?|seems?|estimated?|approximately|about|no\s+evidence)\b/i;
const negatedHighPattern =
  /\b(?:not|no|without)\b[^.!?;]{0,30}\bhigh\b[^.!?;]{0,20}\bsodium\b|\bnot\s+high\s+in\s+sodium\b/i;
const affirmativeHighPattern =
  /\b(?:is|are|was|were|confirmed|contains?|has)\b[^.!?;]{0,30}\bhigh\s+in\s+sodium\b|\bhigh[-\s]sodium\b/i;

const hasAffirmativeSodiumAmountPerServing = (
  summary: string,
  milligrams: number,
) => {
  const amount = String(milligrams).replace(".", "\\.");
  const unit = "(?:mg|milligrams?)";
  const clauses = summary.split(/[.!?;\n]+/);
  const sodiumThenAmount = new RegExp(
    `\\bsodium\\b(?:\\s+(?:is|of|lists?|contains?|has|shows?))?\\s*[:=-]?\\s*${amount}\\s*${unit}\\b[^,]{0,30}\\bper\\s+serving\\b`,
    "i",
  );
  const amountThenSodium = new RegExp(
    `\\b${amount}\\s*${unit}\\s+(?:of\\s+)?sodium\\b[^,]{0,30}\\bper\\s+serving\\b`,
    "i",
  );
  const servingThenAmount = new RegExp(
    `\\beach\\s+serving\\b[^,]{0,30}\\b(?:contains?|has|provides?|lists?)\\s+${amount}\\s*${unit}\\s+(?:of\\s+)?sodium\\b`,
    "i",
  );

  return clauses.some(
    (clause) =>
      sodiumThenAmount.test(clause) ||
      amountThenSodium.test(clause) ||
      servingThenAmount.test(clause),
  );
};

const hasReliableExactLabelEvidence = (
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) => {
  const milligrams = facts.nutrition.sodiumMilligrams;
  if (
    milligrams === undefined ||
    facts.nutrition.servingDescription === undefined
  ) {
    return false;
  }

  return facts.nutrition.evidenceIds.some((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return (
      evidence?.source === "readableOnLabel" &&
      evidence.strength === "confirmed" &&
      hasAffirmativeSodiumAmountPerServing(evidence.summary, milligrams) &&
      !wholePackagePattern.test(evidence.summary) &&
      !nonAffirmativePattern.test(evidence.summary)
    );
  });
};

const hasReliableCoarseHighEvidence = (
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) =>
  facts.nutrition.sodiumLevel === "high" &&
  facts.nutrition.evidenceIds.some((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return (
      evidence !== undefined &&
      evidence.strength !== "unknown" &&
      sodiumReferencePattern.test(evidence.summary) &&
      affirmativeHighPattern.test(evidence.summary) &&
      !negatedHighPattern.test(evidence.summary) &&
      !nonAffirmativePattern.test(evidence.summary)
    );
  });

const contradictionIsRelevant = (contradiction: FactContradiction) =>
  sodiumReferencePattern.test(
    `${contradiction.factPath} ${contradiction.description}`,
  ) ||
  /\bserving(?:\s+size|\s+basis)?\b/i.test(
    `${contradiction.factPath} ${contradiction.description}`,
  );

const uncertaintyIsRelevant = (uncertainty: Uncertainty) =>
  uncertainty.safetyRelevance === "consequential" &&
  (uncertainty.kind === "nutrition" ||
    uncertainty.kind === "labelReadability") &&
  sodiumReferencePattern.test(
    `${uncertainty.subject} ${uncertainty.description}`,
  );

const getConsequentialGaps = (facts: ExtractedFoodFacts) => {
  const contradictionIds = facts.contradictions
    .filter(contradictionIsRelevant)
    .map((contradiction) => contradiction.id);
  const uncertaintyIds = facts.uncertainties
    .filter(uncertaintyIsRelevant)
    .map((uncertainty) => uncertainty.id);
  const labelIds = facts.labels
    .filter(
      (label) =>
        label.legibility !== "readable" &&
        label.evidenceIds.some((evidenceId) =>
          facts.evidence.some(
            (evidence) =>
              evidence.id === evidenceId &&
              sodiumReferencePattern.test(evidence.summary),
          ),
        ),
    )
    .map((label) => label.id);

  return unique([...contradictionIds, ...uncertaintyIds, ...labelIds]);
};

const confidenceFromEvidence = (
  evidenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, EvidenceItem>,
): ConfidenceLevel => {
  const evidence = evidenceIds.flatMap((id) => {
    const item = evidenceById.get(id);
    return item ? [item] : [];
  });
  if (evidence.some((item) => item.strength === "confirmed")) {
    return "high";
  }
  if (evidence.some((item) => item.strength === "likely")) {
    return "medium";
  }
  return "low";
};

const makeMatch = (
  definition: SafetyRuleDefinition,
  status: "triggered" | "uncertain",
  reasonKey: string,
  evidenceIds: readonly string[],
  missingFactIds: readonly string[],
  evidenceConfidence: ConfidenceLevel,
): RuleMatch => ({
  rule: toRuleDescriptor(definition),
  status,
  risk: "moderate",
  recommendedVerdict: "safeWithCaution",
  reasonKey,
  evidenceIds: [...evidenceIds],
  missingFactIds: [...missingFactIds],
  evidenceConfidence,
});

const makeNeutralMatch = (
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

const hasUnknownUserAnswer = (
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) =>
  facts.nutrition.evidenceIds.some((id) => {
    const evidence = evidenceById.get(id);
    return (
      evidence?.source === "userProvided" &&
      evidence.strength === "unknown" &&
      sodiumReferencePattern.test(evidence.summary)
    );
  });

const createSodiumQuestion = (
  relatedFactIds: readonly string[],
): ClarificationQuestion => ({
  id: "high-blood-pressure-sodium-level-question",
  prompt: "Does the nutrition label describe this serving as high in sodium?",
  whyItMatters:
    "A high-sodium serving changes the recommendation for high blood pressure.",
  relatedRuleIds: [uncertainSodiumRule.id],
  relatedFactIds: [...relatedFactIds],
  answerOptions: [
    {
      id: "high",
      label: "Yes, it is high in sodium",
      patch: {
        kind: "setSodiumLevel",
        value: "high",
        source: "userProvided",
      },
    },
    {
      id: "not-high",
      label: "No, it is not high in sodium",
      patch: {
        kind: "setSodiumLevel",
        value: "moderate",
        source: "userProvided",
      },
    },
    {
      id: "unknown",
      label: "I’m not sure",
      patch: {
        kind: "setSodiumLevel",
        value: "unknown",
        source: "userProvided",
      },
    },
  ],
});

export const evaluateHighBloodPressureRules = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
): readonly HighBloodPressureRuleEvaluation[] => {
  if (!profile.highBloodPressure) {
    return [];
  }

  const evidenceById = new Map(
    facts.evidence.map((evidence) => [evidence.id, evidence]),
  );
  const relevantContradictions = facts.contradictions.filter(
    contradictionIsRelevant,
  );
  const exactLabelSupported =
    relevantContradictions.length === 0 &&
    hasReliableExactLabelEvidence(facts, evidenceById);
  const { evidenceIds, evidence } = collectEvidence(
    facts.nutrition.evidenceIds,
    evidenceById,
  );

  if (
    exactLabelSupported &&
    facts.nutrition.sodiumMilligrams !== undefined &&
    facts.nutrition.sodiumMilligrams >=
      HIGH_SODIUM_MILLIGRAMS_PER_SERVING
  ) {
    return [
      {
        ruleMatch: makeMatch(
          highSodiumLabelRule,
          "triggered",
          "high-blood-pressure-high-sodium-label",
          evidenceIds,
          [],
          "high",
        ),
        evidence,
      },
    ];
  }

  const consequentialGapIds = getConsequentialGaps(facts);
  if (consequentialGapIds.length > 0) {
    const gapEvidenceIds = unique([
      ...facts.nutrition.evidenceIds,
      ...facts.contradictions
        .filter(contradictionIsRelevant)
        .flatMap((contradiction) =>
          contradiction.competingClaims.flatMap(
            (claim) => claim.evidenceIds,
          ),
        ),
    ]);
    const gapEvidence = collectEvidence(gapEvidenceIds, evidenceById);
    const canClarify =
      relevantContradictions.length === 0 &&
      facts.uncertainties.some(
        (uncertainty) =>
          uncertaintyIsRelevant(uncertainty) &&
          uncertainty.resolvableByUser,
      ) &&
      !hasUnknownUserAnswer(facts, evidenceById);

    return [
      {
        ruleMatch: makeMatch(
          uncertainSodiumRule,
          "uncertain",
          "high-blood-pressure-sodium-uncertain",
          gapEvidence.evidenceIds,
          consequentialGapIds,
          confidenceFromEvidence(gapEvidence.evidenceIds, evidenceById),
        ),
        evidence: gapEvidence.evidence,
        ...(canClarify
          ? { clarificationQuestion: createSodiumQuestion(consequentialGapIds) }
          : {}),
      },
    ];
  }

  if (hasReliableCoarseHighEvidence(facts, evidenceById)) {
    return [
      {
        ruleMatch: makeMatch(
          coarseHighSodiumRule,
          "triggered",
          "high-blood-pressure-coarse-high-sodium",
          evidenceIds,
          [],
          confidenceFromEvidence(evidenceIds, evidenceById),
        ),
        evidence,
      },
    ];
  }

  if (
    exactLabelSupported &&
    facts.nutrition.sodiumMilligrams !== undefined &&
    facts.nutrition.sodiumMilligrams <
      HIGH_SODIUM_MILLIGRAMS_PER_SERVING
  ) {
    return [
      {
        ruleMatch: makeNeutralMatch(
          belowHighSodiumThresholdRule,
          "cleared",
          "high-blood-pressure-high-sodium-threshold-cleared",
          evidenceIds,
        ),
        evidence,
      },
    ];
  }

  return [
    {
      ruleMatch: makeNeutralMatch(
        nonApplicableSodiumRule,
        "notApplicable",
        "high-blood-pressure-no-supported-sodium-concern",
        [],
      ),
      evidence: [],
    },
  ];
};
