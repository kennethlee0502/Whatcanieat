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
  LabelEvidence,
} from "@/domain/food";
import type { AnalysisProfileContext } from "@/domain/profile";
import {
  safetyRuleDefinitionSchema,
  type SafetyRuleDefinition,
} from "@/rules/provenance";

const ALLERGY_RULE_VERSION = "1.0.0";
const REVIEWED_ON = "2026-07-23";

export const confirmedAllergenRule = safetyRuleDefinitionSchema.parse({
  id: "allergy-confirmed-ingredient",
  version: ALLERGY_RULE_VERSION,
  restriction: "allergy",
  provenance: {
    source:
      "NIAID-Sponsored Expert Panel, Guidelines for the Diagnosis and Management of Food Allergy in the United States",
    guidance:
      "People with documented food allergy should avoid ingesting their specific allergen. Reactions can range from mild to life-threatening.",
    sourceReference:
      "https://www.niaid.nih.gov/sites/default/files/faguidelinesexecsummary.pdf",
    reviewedOn: REVIEWED_ON,
    ruleVersion: ALLERGY_RULE_VERSION,
    assumptions: [
      "The profile allergen represents a food allergy selected by the user.",
      "Confirmed presence means the allergen is supported as an ingredient, not merely a cross-contact possibility.",
    ],
    scopeLimitations: [
      "This rule does not diagnose food allergy or determine an individual exposure threshold.",
      "This rule does not provide emergency guidance.",
    ],
  },
});

export const advisoryAllergenRule = safetyRuleDefinitionSchema.parse({
  id: "allergy-explicit-advisory",
  version: ALLERGY_RULE_VERSION,
  restriction: "allergy",
  provenance: {
    source:
      "U.S. Food and Drug Administration, The Current Food Allergen Landscape",
    guidance:
      "Products carrying a precautionary statement for a person's allergen should be avoided; the statement does not establish allergen quantity or exposure level.",
    sourceReference:
      "https://www.fda.gov/food/conversations-experts-food-topics/current-food-allergen-landscape",
    reviewedOn: REVIEWED_ON,
    ruleVersion: ALLERGY_RULE_VERSION,
    assumptions: [
      "The readable label contains an explicit precautionary statement naming the profile allergen.",
      "The statement is treated as an avoid-level conflict without treating allergen presence as confirmed.",
    ],
    scopeLimitations: [
      "Different advisory phrases do not establish different likelihoods or allergen quantities.",
      "This rule does not infer an individual exposure threshold.",
    ],
  },
});

export const uncertainAllergenRule = safetyRuleDefinitionSchema.parse({
  id: "allergy-ingredient-uncertain",
  version: ALLERGY_RULE_VERSION,
  restriction: "allergy",
  provenance: {
    source:
      "U.S. Food and Drug Administration, The Current Food Allergen Landscape",
    guidance:
      "Precautionary statements do not reliably indicate allergen presence or level, individual sensitivity varies, and FDA has not established thresholds for major allergens.",
    sourceReference:
      "https://www.fda.gov/food/conversations-experts-food-topics/current-food-allergen-landscape",
    reviewedOn: REVIEWED_ON,
    ruleVersion: ALLERGY_RULE_VERSION,
    assumptions: [
      "Likely, possible, and unknown ingredient facts remain uncertain until stronger evidence or user clarification is available.",
      "An advisory-label or cross-contact possibility is not confirmed ingredient presence.",
    ],
    scopeLimitations: [
      "The rule does not infer a quantitative exposure level from precautionary labeling.",
      "The rule does not interpret missing, unreadable, or unobserved allergen information as absence.",
    ],
  },
});

export const explicitlyAbsentAllergenRule = safetyRuleDefinitionSchema.parse({
  id: "allergy-explicitly-absent",
  version: ALLERGY_RULE_VERSION,
  restriction: "allergy",
  provenance: {
    source: "U.S. Food and Drug Administration, Food Allergies",
    guidance:
      "Major allergens used as ingredients must be declared on covered packaged-food labels, while cross-contact and undeclared-allergen risks mean absence must not be inferred without reliable evidence.",
    sourceReference:
      "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
    reviewedOn: REVIEWED_ON,
    ruleVersion: ALLERGY_RULE_VERSION,
    assumptions: [
      "An absent ingredient fact is cleared only when linked to confirmed readable-label or user-provided evidence.",
    ],
    scopeLimitations: [
      "Labeling requirements vary by product and setting.",
      "Explicit absence does not guarantee freedom from undeclared allergens or cross-contact.",
    ],
  },
});

export const nonMatchingAllergenRule = safetyRuleDefinitionSchema.parse({
  id: "allergy-no-relevant-evidence",
  version: ALLERGY_RULE_VERSION,
  restriction: "allergy",
  provenance: {
    source: "U.S. Food and Drug Administration, Food Allergies",
    guidance:
      "Allergen decisions should follow supported ingredient and label evidence; an allergen must not be inferred from unrelated food facts.",
    sourceReference:
      "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
    reviewedOn: REVIEWED_ON,
    ruleVersion: ALLERGY_RULE_VERSION,
    assumptions: [
      "The normalized facts contain no matching allergen claim and no explicit allergen-relevant information gap.",
    ],
    scopeLimitations: [
      "Not applicable is a non-contributing rule result, not a claim that the food is allergen-free or globally safe.",
    ],
  },
});

export const allergyRuleDefinitions: readonly SafetyRuleDefinition[] = [
  confirmedAllergenRule,
  advisoryAllergenRule,
  uncertainAllergenRule,
  explicitlyAbsentAllergenRule,
  nonMatchingAllergenRule,
];

type ProfileAllergy = NonNullable<AnalysisProfileContext["allergies"]>[number];

export type AllergyRuleEvaluation = Readonly<{
  allergenId: string;
  ruleMatch: RuleMatch;
  evidence: readonly EvidenceItem[];
  clarificationQuestion?: ClarificationQuestion;
}>;

const toRuleDescriptor = (
  definition: SafetyRuleDefinition,
): RuleDescriptor => ({
  id: definition.id,
  version: definition.version,
  restriction: definition.restriction,
});

const unique = (values: readonly string[]) => [...new Set(values)];

const collectEvidence = (
  ingredients: readonly IngredientEvidence[],
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) => {
  const evidenceIds = unique(
    ingredients.flatMap((ingredient) => ingredient.evidenceIds),
  );

  return {
    evidenceIds,
    evidence: evidenceIds.flatMap((evidenceId) => {
      const evidence = evidenceById.get(evidenceId);
      return evidence ? [evidence] : [];
    }),
  };
};

const hasReliableAbsenceEvidence = (
  ingredient: IngredientEvidence,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) =>
  ingredient.evidenceIds.some((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return (
      evidence?.strength === "confirmed" &&
      (evidence.source === "readableOnLabel" ||
        evidence.source === "userProvided")
    );
  });

const escapeRegularExpression = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getMatchingAdvisoryLabels = (
  allergenId: string,
  labels: readonly LabelEvidence[],
) => {
  const allergenWords = allergenId
    .split("-")
    .map(escapeRegularExpression)
    .join("[\\s-]+");
  const allergenPattern = `${allergenWords}s?`;
  const precautionaryPatterns = [
    new RegExp(
      `\\bmay\\s+contain\\b[^.!?;\\n]{0,160}\\b${allergenPattern}\\b`,
      "i",
    ),
    new RegExp(
      `\\b(?:produced|made|manufactured|processed|packaged)\\s+in\\s+(?:a\\s+)?facility\\s+(?:that\\s+also\\s+)?(?:processes|uses|handles)\\s+${allergenPattern}\\b`,
      "i",
    ),
    new RegExp(
      `\\b(?:produced|made|manufactured|processed|packaged)\\s+in\\s+(?:a\\s+)?facility\\s+where\\s+${allergenPattern}\\s+(?:is|are)\\s+(?:processed|used|handled)\\b`,
      "i",
    ),
    new RegExp(
      `\\b(?:produced|made|manufactured|processed|packaged)\\s+in\\s+(?:a\\s+)?facility\\s+with\\s+${allergenPattern}\\b`,
      "i",
    ),
  ];
  const negatedFacilityPatterns = [
    new RegExp(`\\bfacility\\s+free\\s+from\\s+${allergenPattern}\\b`, "i"),
    new RegExp(
      `\\bfacility\\s+that\\s+does\\s+not\\s+(?:process|use|handle)\\s+${allergenPattern}\\b`,
      "i",
    ),
    new RegExp(`\\bfacility\\s+with\\s+no\\s+${allergenPattern}\\b`, "i"),
    new RegExp(`\\b${allergenPattern}-free\\s+facility\\b`, "i"),
  ];

  return labels.filter(
    (label) =>
      label.legibility === "readable" &&
      !negatedFacilityPatterns.some((pattern) => pattern.test(label.text)) &&
      precautionaryPatterns.some((pattern) => pattern.test(label.text)),
  );
};

const textReferencesAllergen = (text: string, allergenId: string) => {
  const allergenWords = allergenId
    .split("-")
    .map(escapeRegularExpression)
    .join("[\\s-]+");

  return new RegExp(`\\b${allergenWords}s?\\b`, "i").test(text);
};

const broadIngredientGapPattern =
  /\b(?:ingredient(?:s|\s+information)?(?:\s+in\s+(?:the\s+)?(?:sauce|seasoning|filling|preparation))?\s+(?:(?:are|may\s+be)\s+)?(?:unavailable|incomplete|unknown|not\s+(?:available|observed|visible)|may\s+not\s+be\s+(?:available|observed|visible))|complete\s+ingredient(?:s|\s+information)?\s+(?:is|are)\s+(?:unavailable|unknown)|unknown\s+(?:sauce|seasoning|filling|ingredient|ingredients|component)|hidden\s+ingredient|composite(?:-|\s+)food|preparation\s+ingredient|unreadable\s+(?:allergen|ingredient)\s+label)\b/i;
const crossContactPattern =
  /\b(?:cross[-\s]?contact|shared\s+(?:equipment|facility|processing|production\s+line)|facility\s+(?:uses|processes|handles)|processed\s+in\s+the\s+same\s+facility)\b/i;

type AllergenGaps = Readonly<{
  presenceGapIds: readonly string[];
  independentRiskIds: readonly string[];
  evidenceIds: readonly string[];
}>;

const getAllergenGaps = (
  allergenId: string,
  selectedAllergenIds: readonly string[],
  facts: ExtractedFoodFacts,
  matchingIngredients: readonly IngredientEvidence[],
  evidenceById: ReadonlyMap<string, EvidenceItem>,
): AllergenGaps => {
  const presenceGapIds: string[] = [];
  const independentRiskIds: string[] = [];
  const relevantEvidenceIds: string[] = [];
  const matchingIngredientIds = new Set(
    matchingIngredients.map((ingredient) => ingredient.id),
  );
  const matchingEvidenceIds = new Set(
    matchingIngredients.flatMap((ingredient) => ingredient.evidenceIds),
  );

  for (const ingredient of matchingIngredients) {
    if (
      ingredient.presence === "likely" ||
      ingredient.presence === "possible" ||
      ingredient.presence === "unknown" ||
      (ingredient.presence === "absent" &&
        !hasReliableAbsenceEvidence(ingredient, evidenceById))
    ) {
      presenceGapIds.push(ingredient.id);
    }
  }

  if (facts.imageSuitability === "insufficientImage") {
    presenceGapIds.push("image-suitability");
  }

  for (const label of facts.labels) {
    if (label.legibility === "readable") {
      continue;
    }

    relevantEvidenceIds.push(...label.evidenceIds);

    if (
      label.legibility === "partial" &&
      /\bingredient(?:s|\s+list)\b/i.test(label.text) &&
      !textReferencesAllergen(label.text, allergenId) &&
      !crossContactPattern.test(label.text)
    ) {
      presenceGapIds.push(label.id);
    } else {
      // Unreadable labels expose no text or scope in the current model. Treat
      // that unknown scope as an independent advisory risk so ingredient
      // absence cannot incorrectly resolve it.
      independentRiskIds.push(label.id);
    }
  }

  for (const contradiction of facts.contradictions) {
    const referencesMatchingEvidence = contradiction.competingClaims.some(
      (claim) =>
        claim.evidenceIds.some((evidenceId) =>
          matchingEvidenceIds.has(evidenceId),
        ),
    );

    if (
      textReferencesAllergen(
        `${contradiction.factPath} ${contradiction.description}`,
        allergenId,
      ) ||
      referencesMatchingEvidence
    ) {
      independentRiskIds.push(contradiction.id);
      relevantEvidenceIds.push(
        ...contradiction.competingClaims.flatMap(
          (claim) => claim.evidenceIds,
        ),
      );
    }
  }

  for (const uncertainty of facts.uncertainties) {
    if (
      uncertainty.safetyRelevance === "informational" ||
      (uncertainty.kind !== "ingredient" &&
        uncertainty.kind !== "labelReadability" &&
        uncertainty.kind !== "contradiction")
    ) {
      continue;
    }

    const uncertaintyText = `${uncertainty.subject} ${uncertainty.description}`;
    const explicitlyReferencesAllergen = textReferencesAllergen(
      uncertaintyText,
      allergenId,
    );
    const referencesAnotherSelectedAllergen = selectedAllergenIds.some(
      (selectedAllergenId) =>
        selectedAllergenId !== allergenId &&
        textReferencesAllergen(uncertaintyText, selectedAllergenId),
    );
    const referencesMatchingIngredient = uncertainty.relatedFactIds.some(
      (relatedFactId) => matchingIngredientIds.has(relatedFactId),
    );
    const isCrossContactRisk = crossContactPattern.test(uncertaintyText);
    const isBroadIngredientGap =
      uncertainty.kind === "labelReadability" ||
      broadIngredientGapPattern.test(uncertaintyText);
    const isUnbounded =
      uncertainty.relatedFactIds.length === 0 &&
      !referencesAnotherSelectedAllergen &&
      (isCrossContactRisk || isBroadIngredientGap);

    if (
      explicitlyReferencesAllergen ||
      referencesMatchingIngredient ||
      isUnbounded
    ) {
      relevantEvidenceIds.push(
        ...uncertainty.relatedFactIds.filter((relatedFactId) =>
          evidenceById.has(relatedFactId),
        ),
      );

      if (isCrossContactRisk || uncertainty.kind === "contradiction") {
        independentRiskIds.push(uncertainty.id);
      } else {
        presenceGapIds.push(uncertainty.id);
      }
    }
  }

  return {
    presenceGapIds: unique(presenceGapIds),
    independentRiskIds: unique(independentRiskIds),
    evidenceIds: unique(relevantEvidenceIds),
  };
};

const collectEvidenceByIds = (
  evidenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) => ({
  evidenceIds: unique(evidenceIds),
  evidence: unique(evidenceIds).flatMap((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return evidence ? [evidence] : [];
  }),
});

const uncertaintyConfidence = (
  ingredients: readonly IngredientEvidence[],
): ConfidenceLevel =>
  ingredients.some((ingredient) => ingredient.presence === "likely")
    ? "medium"
    : "low";

const createClarificationQuestion = (
  allergen: ProfileAllergy,
  relatedFactIds: readonly string[],
): ClarificationQuestion => ({
  id: `allergy-${allergen.allergenId}-presence-question`,
  prompt: `Can the ingredient list or person who prepared it confirm whether this food contains ${allergen.allergenId}?`,
  whyItMatters:
    "Confirmed presence would change the recommendation for your allergy.",
  relatedRuleIds: [uncertainAllergenRule.id],
  relatedFactIds: [...relatedFactIds],
  answerOptions: [
    {
      id: "confirmed-present",
      label: "Yes, it contains this allergen",
      patch: {
        kind: "setIngredientPresence",
        ingredientId: allergen.allergenId,
        value: "confirmed",
        source: "userProvided",
      },
    },
    {
      id: "confirmed-absent",
      label: "No, it does not contain this allergen",
      patch: {
        kind: "setIngredientPresence",
        ingredientId: allergen.allergenId,
        value: "absent",
        source: "userProvided",
      },
    },
    {
      id: "still-unknown",
      label: "I’m not sure",
      patch: {
        kind: "setIngredientPresence",
        ingredientId: allergen.allergenId,
        value: "unknown",
        source: "userProvided",
      },
    },
  ],
});

const evaluateAllergen = (
  allergen: ProfileAllergy,
  selectedAllergenIds: readonly string[],
  facts: ExtractedFoodFacts,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
): AllergyRuleEvaluation => {
  const matchingIngredients = facts.ingredients.filter(
    (ingredient) => ingredient.ingredientId === allergen.allergenId,
  );
  const confirmedIngredients = matchingIngredients.filter(
    (ingredient) => ingredient.presence === "confirmed",
  );

  if (confirmedIngredients.length > 0) {
    const { evidenceIds, evidence } = collectEvidence(
      confirmedIngredients,
      evidenceById,
    );

    return {
      allergenId: allergen.allergenId,
      ruleMatch: {
        rule: toRuleDescriptor(confirmedAllergenRule),
        status: "triggered",
        risk: "critical",
        recommendedVerdict: "avoid",
        reasonKey: "allergy-confirmed-ingredient",
        evidenceIds,
        missingFactIds: [],
        evidenceConfidence: "high",
      },
      evidence,
    };
  }

  const matchingAdvisoryLabels = getMatchingAdvisoryLabels(
    allergen.allergenId,
    facts.labels,
  );

  if (matchingAdvisoryLabels.length > 0) {
    const evidenceIds = unique(
      matchingAdvisoryLabels.flatMap((label) => label.evidenceIds),
    );
    const evidence = evidenceIds.flatMap((evidenceId) => {
      const item = evidenceById.get(evidenceId);
      return item ? [item] : [];
    });

    return {
      allergenId: allergen.allergenId,
      ruleMatch: {
        rule: toRuleDescriptor(advisoryAllergenRule),
        status: "triggered",
        risk: "high",
        recommendedVerdict: "avoid",
        reasonKey: "allergy-explicit-advisory",
        evidenceIds,
        missingFactIds: [],
        evidenceConfidence: "medium",
      },
      evidence,
    };
  }

  const reliablyAbsentIngredients = matchingIngredients.filter(
    (ingredient) =>
      ingredient.presence === "absent" &&
      hasReliableAbsenceEvidence(ingredient, evidenceById),
  );
  const {
    presenceGapIds,
    independentRiskIds,
    evidenceIds: gapEvidenceIds,
  } = getAllergenGaps(
    allergen.allergenId,
    selectedAllergenIds,
    facts,
    matchingIngredients,
    evidenceById,
  );
  const hasReliableAbsence =
    reliablyAbsentIngredients.length > 0 &&
    reliablyAbsentIngredients.length === matchingIngredients.length;
  const unresolvedGapIds = unique([
    ...independentRiskIds,
    ...(hasReliableAbsence ? [] : presenceGapIds),
  ]);

  if (unresolvedGapIds.length > 0) {
    const ingredientEvidenceIds = matchingIngredients.flatMap(
      (ingredient) => ingredient.evidenceIds,
    );
    const { evidenceIds, evidence } = collectEvidenceByIds(
      [...ingredientEvidenceIds, ...gapEvidenceIds],
      evidenceById,
    );

    return {
      allergenId: allergen.allergenId,
      ruleMatch: {
        rule: toRuleDescriptor(uncertainAllergenRule),
        status: "uncertain",
        risk: "high",
        recommendedVerdict: "needMoreInformation",
        reasonKey: "allergy-ingredient-uncertain",
        evidenceIds,
        missingFactIds: unresolvedGapIds,
        evidenceConfidence: uncertaintyConfidence(matchingIngredients),
      },
      evidence,
      ...(independentRiskIds.length === 0 &&
      !hasReliableAbsence &&
      presenceGapIds.length > 0
        ? {
            clarificationQuestion: createClarificationQuestion(
              allergen,
              presenceGapIds,
            ),
          }
        : {}),
    };
  }

  if (hasReliableAbsence) {
    const { evidenceIds, evidence } = collectEvidence(
      reliablyAbsentIngredients,
      evidenceById,
    );

    return {
      allergenId: allergen.allergenId,
      ruleMatch: {
        rule: toRuleDescriptor(explicitlyAbsentAllergenRule),
        status: "cleared",
        risk: "informational",
        recommendedVerdict: null,
        reasonKey: "allergy-explicitly-absent",
        evidenceIds,
        missingFactIds: [],
        evidenceConfidence: "high",
      },
      evidence,
    };
  }

  // Every supported matching ingredient state either returned above or
  // contributed a presence gap, so reaching here is a fully characterized
  // non-match.
  return {
    allergenId: allergen.allergenId,
    ruleMatch: {
      rule: toRuleDescriptor(nonMatchingAllergenRule),
      status: "notApplicable",
      risk: "informational",
      recommendedVerdict: null,
      reasonKey: "allergy-no-relevant-evidence",
      evidenceIds: [],
      missingFactIds: [],
      evidenceConfidence: "high",
    },
    evidence: [],
  };
};

export const evaluateAllergyRules = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
): readonly AllergyRuleEvaluation[] => {
  const allergies = profile.allergies ?? [];
  const selectedAllergenIds = allergies.map((allergen) => allergen.allergenId);
  const evidenceById = new Map(
    facts.evidence.map((evidence) => [evidence.id, evidence]),
  );

  return allergies.map((allergen) =>
    evaluateAllergen(allergen, selectedAllergenIds, facts, evidenceById),
  );
};
