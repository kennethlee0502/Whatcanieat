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

const DIET_RULE_VERSION = "1.0.0";
const REVIEWED_ON = "2026-07-23";
const VEGETARIAN_POLICY =
  "https://vegsoc.org/trademarks/trademark-criteria/";
const VEGAN_POLICY =
  "https://www.vegansociety.com/trademark/vegan-trademark-standards";

export const confirmedDietConflictRule = safetyRuleDefinitionSchema.parse({
  id: "diet-confirmed-animal-derived-ingredient",
  version: DIET_RULE_VERSION,
  restriction: "vegetarian",
  provenance: {
    source: "Vegetarian Society and Vegan Society ingredient criteria",
    guidance:
      "Vegetarian foods exclude animal flesh and slaughter-derived ingredients; vegan foods exclude all animal-derived ingredients.",
    sourceReference: VEGETARIAN_POLICY,
    reviewedOn: REVIEWED_ON,
    ruleVersion: DIET_RULE_VERSION,
    assumptions: [
      "The selected diet is interpreted using the documented MVP ingredient taxonomy.",
      "Ingredient presence is supported by evidence admissible for that ingredient category.",
    ],
    scopeLimitations: [
      "The rule evaluates ingredients, not ethical practices, manufacturing certification, or cross-contact.",
      "A conflict is a product-policy result and not medical guidance.",
    ],
  },
});

export const uncertainDietConflictRule = safetyRuleDefinitionSchema.parse({
  id: "diet-animal-derived-ingredient-uncertain",
  version: DIET_RULE_VERSION,
  restriction: "vegetarian",
  provenance: {
    source: "Vegetarian Society and Vegan Society ingredient criteria",
    guidance:
      "An unresolved possible animal-derived ingredient prevents a supported diet-suitability conclusion.",
    sourceReference: VEGAN_POLICY,
    reviewedOn: REVIEWED_ON,
    ruleVersion: DIET_RULE_VERSION,
    assumptions: [
      "The uncertainty concerns a specific ingredient that would conflict with the selected diet if present.",
    ],
    scopeLimitations: [
      "Conventional recipe inference and visible appearance do not confirm hidden or derivative ingredients.",
      "Precautionary allergen and shared-facility statements are outside this rule.",
    ],
  },
});

export const absentDietConflictRule = safetyRuleDefinitionSchema.parse({
  id: "diet-animal-derived-ingredient-absent",
  version: DIET_RULE_VERSION,
  restriction: "vegetarian",
  provenance: {
    source: "Vegetarian Society and Vegan Society ingredient criteria",
    guidance:
      "Reliable affirmative absence can clear only the identified animal-derived ingredient condition.",
    sourceReference: VEGETARIAN_POLICY,
    reviewedOn: REVIEWED_ON,
    ruleVersion: DIET_RULE_VERSION,
    assumptions: [
      "Absence is explicit, reliable, and scoped to the exact ingredient.",
    ],
    scopeLimitations: [
      "A local clearance does not certify the complete food as vegetarian or vegan.",
    ],
  },
});

export const nonApplicableDietRule = safetyRuleDefinitionSchema.parse({
  id: "diet-no-supported-animal-derived-conflict",
  version: DIET_RULE_VERSION,
  restriction: "vegetarian",
  provenance: {
    source: "Vegetarian Society and Vegan Society ingredient criteria",
    guidance:
      "Diet conflicts require supported evidence for an ingredient excluded by the selected diet.",
    sourceReference: VEGAN_POLICY,
    reviewedOn: REVIEWED_ON,
    ruleVersion: DIET_RULE_VERSION,
    assumptions: [
      "No represented ingredient or scoped uncertainty establishes a conflict under the selected policy.",
    ],
    scopeLimitations: [
      "Not applicable is non-contributing and does not certify diet suitability.",
    ],
  },
});

const veganVariant = (
  definition: SafetyRuleDefinition,
  id: string,
): SafetyRuleDefinition =>
  safetyRuleDefinitionSchema.parse({
    ...definition,
    id,
    restriction: "vegan",
    provenance: {
      ...definition.provenance,
      sourceReference: VEGAN_POLICY,
      assumptions: [...definition.provenance.assumptions],
      scopeLimitations: [...definition.provenance.scopeLimitations],
    },
  });

export const confirmedVeganConflictRule = veganVariant(
  confirmedDietConflictRule,
  "vegan-confirmed-animal-derived-ingredient",
);
export const uncertainVeganConflictRule = veganVariant(
  uncertainDietConflictRule,
  "vegan-animal-derived-ingredient-uncertain",
);
export const absentVeganConflictRule = veganVariant(
  absentDietConflictRule,
  "vegan-animal-derived-ingredient-absent",
);
export const nonApplicableVeganRule = veganVariant(
  nonApplicableDietRule,
  "vegan-no-supported-animal-derived-conflict",
);

export const dietPreferenceRuleDefinitions: readonly SafetyRuleDefinition[] = [
  confirmedDietConflictRule,
  uncertainDietConflictRule,
  absentDietConflictRule,
  nonApplicableDietRule,
  confirmedVeganConflictRule,
  uncertainVeganConflictRule,
  absentVeganConflictRule,
  nonApplicableVeganRule,
];

type DietPreference = NonNullable<AnalysisProfileContext["diet"]>;
type ConflictGroup =
  | "animal-flesh"
  | "slaughter-derived"
  | "dairy"
  | "egg"
  | "honey"
  | "other-animal-derived";

type IngredientPolicy = Readonly<{
  canonicalId: string;
  group: ConflictGroup;
  conflictsWith: readonly DietPreference[];
  directlyObservable: boolean;
  aliases: readonly string[];
}>;

const bothDiets = ["vegetarian", "vegan"] as const;
const veganOnly = ["vegan"] as const;

const ingredientPolicies: readonly IngredientPolicy[] = [
  {
    canonicalId: "meat",
    group: "animal-flesh",
    conflictsWith: bothDiets,
    directlyObservable: true,
    aliases: [
      "meat",
      "beef",
      "pork",
      "lamb",
      "veal",
      "bacon",
      "ham",
    ],
  },
  {
    canonicalId: "poultry",
    group: "animal-flesh",
    conflictsWith: bothDiets,
    directlyObservable: true,
    aliases: ["poultry", "chicken", "turkey", "duck"],
  },
  {
    canonicalId: "fish",
    group: "animal-flesh",
    conflictsWith: bothDiets,
    directlyObservable: true,
    aliases: ["fish", "salmon", "tuna", "cod", "anchovy", "anchovies"],
  },
  {
    canonicalId: "shellfish",
    group: "animal-flesh",
    conflictsWith: bothDiets,
    directlyObservable: true,
    aliases: ["shellfish", "shrimp", "prawn", "crab", "lobster", "oyster"],
  },
  {
    canonicalId: "insect",
    group: "animal-flesh",
    conflictsWith: bothDiets,
    directlyObservable: true,
    aliases: [
      "insect",
      "insects",
      "cricket",
      "crickets",
      "mealworm",
      "mealworms",
      "grasshopper",
      "grasshoppers",
    ],
  },
  {
    canonicalId: "gelatin",
    group: "slaughter-derived",
    conflictsWith: bothDiets,
    directlyObservable: false,
    aliases: ["gelatin", "gelatine"],
  },
  {
    canonicalId: "animal-stock",
    group: "slaughter-derived",
    conflictsWith: bothDiets,
    directlyObservable: false,
    aliases: [
      "animal-stock",
      "meat-stock",
      "chicken-stock",
      "beef-stock",
      "fish-stock",
      "bone-broth",
      "chicken-broth",
      "beef-broth",
    ],
  },
  {
    canonicalId: "animal-fat",
    group: "slaughter-derived",
    conflictsWith: bothDiets,
    directlyObservable: false,
    aliases: ["lard", "suet", "dripping", "animal-fat"],
  },
  {
    canonicalId: "animal-rennet",
    group: "slaughter-derived",
    conflictsWith: bothDiets,
    directlyObservable: false,
    aliases: ["animal-rennet"],
  },
  {
    canonicalId: "isinglass",
    group: "slaughter-derived",
    conflictsWith: bothDiets,
    directlyObservable: false,
    aliases: ["isinglass"],
  },
  {
    canonicalId: "dairy",
    group: "dairy",
    conflictsWith: veganOnly,
    directlyObservable: false,
    aliases: [
      "dairy",
      "milk",
      "milk-powder",
      "whey",
      "casein",
      "butter",
      "cream",
      "yogurt",
    ],
  },
  {
    canonicalId: "cheese",
    group: "dairy",
    conflictsWith: veganOnly,
    directlyObservable: true,
    aliases: ["cheese"],
  },
  {
    canonicalId: "egg",
    group: "egg",
    conflictsWith: veganOnly,
    directlyObservable: true,
    aliases: ["egg", "eggs", "whole-egg"],
  },
  {
    canonicalId: "honey",
    group: "honey",
    conflictsWith: veganOnly,
    directlyObservable: false,
    aliases: ["honey", "royal-jelly"],
  },
  {
    canonicalId: "beeswax",
    group: "other-animal-derived",
    conflictsWith: veganOnly,
    directlyObservable: false,
    aliases: ["beeswax"],
  },
  {
    canonicalId: "shellac",
    group: "other-animal-derived",
    conflictsWith: veganOnly,
    directlyObservable: false,
    aliases: ["shellac"],
  },
];

const policyByAlias = new Map(
  ingredientPolicies.flatMap((policy) =>
    policy.aliases.map(
      (alias) => [canonicalizeTerm(alias), policy] as const,
    ),
  ),
);

export type DietPreferenceRuleEvaluation = Readonly<{
  ingredientId: string | null;
  group: ConflictGroup | "none";
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

const escapeRegularExpression = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ingredientPatternSource = (ingredient: IngredientEvidence) => {
  const terms = unique([
    ingredient.ingredientId,
    ingredient.displayName,
  ]).map((term) =>
    canonicalizeTerm(term)
      .split("-")
      .map(escapeRegularExpression)
      .join("[\\s-]+"),
  );
  return `(?:${terms.join("|")})s?`;
};

const termPattern = (ingredient: IngredientEvidence) =>
  new RegExp(`\\b${ingredientPatternSource(ingredient)}\\b`, "i");

const precautionaryPattern =
  /\bmay\s+contain(?:\s+traces?\s+of)?\b|\b(?:made|manufactured|processed|produced|packaged)\s+in\s+(?:a\s+)?facility\b|\bfacility\s+(?:that\s+)?(?:processes|handles|uses)\b|\bshared\s+(?:equipment|facility|production\s+line)\b/i;
const uncertaintyPattern =
  /\b(?:may|might|possible|possibly|likely|probably|uncertain|unknown|unclear|unconfirmed|appears?|looks?|seems?)\b/i;
const absencePattern =
  /\b(?:does\s+not|doesn't)\s+contain\b|\b(?:no|without|free\s+from)\b|\b(?:is|are)\s+absent\b/i;
const affirmativeIngredientPattern =
  /\bcontains?\b|\bingredients?\s*:|\bmade\s+with\b|\bincludes?\b|\bhas\b|\bconfirmed\b|\b(?:is|are)\s+present\b/i;
const nonAffirmativeVisibleIdentityPattern =
  /\b(?:not|no|unclear|uncertain|unidentified|unidentifiable)\b/i;

const hasAffirmativeVisiblePresence = (
  summary: string,
  ingredient: IngredientEvidence,
) => {
  if (nonAffirmativeVisibleIdentityPattern.test(summary)) {
    return false;
  }

  const ingredientSource = ingredientPatternSource(ingredient);
  const ingredientIsVisible = new RegExp(
    `\\b${ingredientSource}\\b\\s+(?:is|are)\\s+(?:clearly\\s+)?(?:visible|shown|pictured)\\b`,
    "i",
  );
  const imageShowsIngredient = new RegExp(
    `\\b(?:image|photo|picture)\\b\\s+(?:clearly\\s+)?(?:shows?|depicts?|pictures?)\\b[^.!?;]{0,30}\\b${ingredientSource}\\b`,
    "i",
  );
  const visibleIngredientIsPresent = new RegExp(
    `\\bvisible\\s+(?:pieces?\\s+of\\s+)?${ingredientSource}\\b\\s+(?:is|are)\\s+present\\b`,
    "i",
  );

  return (
    ingredientIsVisible.test(summary) ||
    imageShowsIngredient.test(summary) ||
    visibleIngredientIsPresent.test(summary)
  );
};

const evidenceReferencesIngredient = (
  evidence: EvidenceItem,
  ingredient: IngredientEvidence,
) => termPattern(ingredient).test(evidence.summary);

const isPrecautionaryEvidence = (evidence: EvidenceItem) =>
  precautionaryPattern.test(evidence.summary);

const hasReliablePresenceEvidence = (
  ingredient: IngredientEvidence,
  policy: IngredientPolicy,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) =>
  ingredient.evidenceIds.some((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    if (
      evidence?.strength !== "confirmed" ||
      !evidenceReferencesIngredient(evidence, ingredient) ||
      isPrecautionaryEvidence(evidence) ||
      uncertaintyPattern.test(evidence.summary) ||
      absencePattern.test(evidence.summary)
    ) {
      return false;
    }

    if (
      evidence.source === "readableOnLabel" ||
      evidence.source === "userProvided"
    ) {
      return affirmativeIngredientPattern.test(evidence.summary);
    }

    return (
      evidence.source === "visibleInImage" &&
      policy.directlyObservable &&
      hasAffirmativeVisiblePresence(evidence.summary, ingredient)
    );
  });

const hasReliableAbsenceEvidence = (
  ingredient: IngredientEvidence,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) =>
  ingredient.evidenceIds.some((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return (
      evidence?.strength === "confirmed" &&
      (evidence.source === "readableOnLabel" ||
        evidence.source === "userProvided") &&
      evidenceReferencesIngredient(evidence, ingredient) &&
      absencePattern.test(evidence.summary) &&
      !isPrecautionaryEvidence(evidence)
    );
  });

const getRelevantEvidence = (
  ingredient: IngredientEvidence,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) => {
  const evidenceIds = unique(
    ingredient.evidenceIds.filter((evidenceId) => {
      const evidence = evidenceById.get(evidenceId);
      return (
        evidence !== undefined &&
        evidenceReferencesIngredient(evidence, ingredient) &&
        !isPrecautionaryEvidence(evidence)
      );
    }),
  );
  return {
    evidenceIds,
    evidence: evidenceIds.flatMap((id) => {
      const item = evidenceById.get(id);
      return item ? [item] : [];
    }),
  };
};

const hasRelevantContradiction = (
  ingredient: IngredientEvidence,
  facts: ExtractedFoodFacts,
) => {
  const pattern = termPattern(ingredient);
  return facts.contradictions.some((contradiction) =>
    pattern.test(`${contradiction.factPath} ${contradiction.description}`),
  );
};

const hasUnknownUserAnswer = (
  ingredient: IngredientEvidence,
  evidenceById: ReadonlyMap<string, EvidenceItem>,
) =>
  ingredient.evidenceIds.some((id) => {
    const evidence = evidenceById.get(id);
    return (
      evidence?.source === "userProvided" &&
      evidence.strength === "unknown" &&
      evidenceReferencesIngredient(evidence, ingredient)
    );
  });

const policiesReferencedByText = (
  text: string,
  diet: DietPreference,
): readonly IngredientPolicy[] => {
  const matches = ingredientPolicies.filter(
    (policy) =>
      policy.conflictsWith.includes(diet) &&
      policy.aliases.some((alias) => {
        const words = canonicalizeTerm(alias)
          .split("-")
          .map(escapeRegularExpression)
          .join("[\\s-]+");
        return new RegExp(`\\b${words}\\b`, "i").test(text);
      }),
  );

  return [
    ...new Map(matches.map((policy) => [policy.canonicalId, policy])).values(),
  ];
};

const evidenceConfidence = (
  evidence: readonly EvidenceItem[],
): ConfidenceLevel =>
  evidence.some((item) => item.strength === "confirmed")
    ? "high"
    : evidence.some((item) => item.strength === "likely")
      ? "medium"
      : "low";

const createQuestion = (
  ingredient: IngredientEvidence,
  uncertainRule: SafetyRuleDefinition,
): ClarificationQuestion => ({
  id: `diet-${ingredient.ingredientId}-presence-question`,
  prompt: `Can the ingredient list or person who prepared it confirm whether this contains ${ingredient.displayName}?`,
  whyItMatters:
    "Confirmed presence would change the recommendation for your selected diet.",
  relatedRuleIds: [uncertainRule.id],
  relatedFactIds: [ingredient.id],
  answerOptions: [
    {
      id: "confirmed-present",
      label: "Yes, it contains this ingredient",
      patch: {
        kind: "setIngredientPresence",
        ingredientId: ingredient.ingredientId,
        value: "confirmed",
        source: "userProvided",
      },
    },
    {
      id: "confirmed-absent",
      label: "No, it does not contain this ingredient",
      patch: {
        kind: "setIngredientPresence",
        ingredientId: ingredient.ingredientId,
        value: "absent",
        source: "userProvided",
      },
    },
    {
      id: "still-unknown",
      label: "I’m not sure",
      patch: {
        kind: "setIngredientPresence",
        ingredientId: ingredient.ingredientId,
        value: "unknown",
        source: "userProvided",
      },
    },
  ],
});

const makeMatch = (
  definition: SafetyRuleDefinition,
  status: "triggered" | "uncertain",
  reasonKey: string,
  evidenceIds: readonly string[],
  missingFactIds: readonly string[],
  confidence: ConfidenceLevel,
): RuleMatch => ({
  rule: toRuleDescriptor(definition),
  status,
  risk: status === "triggered" ? "high" : "moderate",
  recommendedVerdict:
    status === "triggered" ? "avoid" : "needMoreInformation",
  reasonKey,
  evidenceIds: [...evidenceIds],
  missingFactIds: [...missingFactIds],
  evidenceConfidence: confidence,
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

export const evaluateDietPreferenceRules = (
  profile: AnalysisProfileContext,
  facts: ExtractedFoodFacts,
): readonly DietPreferenceRuleEvaluation[] => {
  const diet = profile.diet;
  if (!diet) {
    return [];
  }

  const evidenceById = new Map(
    facts.evidence.map((evidence) => [evidence.id, evidence]),
  );
  const rules =
    diet === "vegan"
      ? {
          confirmed: confirmedVeganConflictRule,
          uncertain: uncertainVeganConflictRule,
          absent: absentVeganConflictRule,
          notApplicable: nonApplicableVeganRule,
        }
      : {
          confirmed: confirmedDietConflictRule,
          uncertain: uncertainDietConflictRule,
          absent: absentDietConflictRule,
          notApplicable: nonApplicableDietRule,
        };
  const evaluations: DietPreferenceRuleEvaluation[] = [];

  for (const ingredient of facts.ingredients) {
    const policy = policyByAlias.get(canonicalizeTerm(ingredient.ingredientId));
    if (!policy?.conflictsWith.includes(diet)) {
      continue;
    }

    const relevantEvidence = getRelevantEvidence(ingredient, evidenceById);
    const onlyPrecautionaryEvidence =
      ingredient.evidenceIds.length > 0 &&
      relevantEvidence.evidenceIds.length === 0 &&
      ingredient.evidenceIds.every((id) => {
        const item = evidenceById.get(id);
        return item !== undefined && isPrecautionaryEvidence(item);
      });
    if (onlyPrecautionaryEvidence) {
      continue;
    }

    const contradiction = hasRelevantContradiction(ingredient, facts);
    const reliablePresence = hasReliablePresenceEvidence(
      ingredient,
      policy,
      evidenceById,
    );
    const reliableAbsence = hasReliableAbsenceEvidence(
      ingredient,
      evidenceById,
    );

    if (
      ingredient.presence === "confirmed" &&
      reliablePresence &&
      !contradiction
    ) {
      evaluations.push({
        ingredientId: policy.canonicalId,
        group: policy.group,
        ruleMatch: makeMatch(
          rules.confirmed,
          "triggered",
          "diet-confirmed-animal-derived-ingredient",
          relevantEvidence.evidenceIds,
          [],
          "high",
        ),
        evidence: relevantEvidence.evidence,
      });
      continue;
    }

    if (
      ingredient.presence === "absent" &&
      reliableAbsence &&
      !contradiction
    ) {
      evaluations.push({
        ingredientId: policy.canonicalId,
        group: policy.group,
        ruleMatch: makeNeutralMatch(
          rules.absent,
          "cleared",
          "diet-animal-derived-ingredient-absent",
          relevantEvidence.evidenceIds,
        ),
        evidence: relevantEvidence.evidence,
      });
      continue;
    }

    const hasRepresentedUncertainty =
      contradiction ||
      ingredient.presence === "likely" ||
      ingredient.presence === "possible" ||
      ingredient.presence === "unknown" ||
      (ingredient.presence === "confirmed" && !reliablePresence) ||
      (ingredient.presence === "absent" && !reliableAbsence);

    if (hasRepresentedUncertainty) {
      const missingFactIds = unique([
        ingredient.id,
        ...facts.contradictions
          .filter((item) =>
            termPattern(ingredient).test(
              `${item.factPath} ${item.description}`,
            ),
          )
          .map((item) => item.id),
      ]);
      const canClarify =
        !contradiction &&
        !hasUnknownUserAnswer(ingredient, evidenceById) &&
        relevantEvidence.evidence.some(
          (item) =>
            item.source === "conventionalInference" ||
            item.strength !== "confirmed",
        );

      evaluations.push({
        ingredientId: policy.canonicalId,
        group: policy.group,
        ruleMatch: makeMatch(
          rules.uncertain,
          "uncertain",
          "diet-animal-derived-ingredient-uncertain",
          relevantEvidence.evidenceIds,
          missingFactIds,
          evidenceConfidence(relevantEvidence.evidence),
        ),
        evidence: relevantEvidence.evidence,
        ...(canClarify
          ? {
              clarificationQuestion: createQuestion(
                ingredient,
                rules.uncertain,
              ),
            }
          : {}),
      });
    }
  }

  const representedPolicyIds = new Set(
    facts.ingredients.flatMap((ingredient) => {
      const policy = policyByAlias.get(
        canonicalizeTerm(ingredient.ingredientId),
      );
      return policy ? [policy.canonicalId] : [];
    }),
  );

  for (const uncertainty of facts.uncertainties) {
    if (
      uncertainty.kind !== "ingredient" ||
      uncertainty.safetyRelevance !== "consequential"
    ) {
      continue;
    }

    const uncertaintyText = `${uncertainty.subject} ${uncertainty.description}`;
    if (precautionaryPattern.test(uncertaintyText)) {
      continue;
    }

    const referencedPolicies = policiesReferencedByText(
      uncertaintyText,
      diet,
    ).filter((policy) => !representedPolicyIds.has(policy.canonicalId));
    if (referencedPolicies.length !== 1) {
      continue;
    }

    const [policy] = referencedPolicies;
    const scopedIngredient: IngredientEvidence = {
      id: `ingredient-${policy.canonicalId}`,
      ingredientId: policy.canonicalId,
      displayName: policy.canonicalId,
      presence: "unknown",
      evidenceIds: [],
    };

    evaluations.push({
      ingredientId: policy.canonicalId,
      group: policy.group,
      ruleMatch: makeMatch(
        rules.uncertain,
        "uncertain",
        "diet-animal-derived-ingredient-uncertain",
        [],
        [uncertainty.id],
        "low",
      ),
      evidence: [],
      ...(uncertainty.resolvableByUser
        ? {
            clarificationQuestion: createQuestion(
              scopedIngredient,
              rules.uncertain,
            ),
          }
        : {}),
    });
  }

  if (evaluations.length > 0) {
    return evaluations;
  }

  return [
    {
      ingredientId: null,
      group: "none",
      ruleMatch: makeNeutralMatch(
        rules.notApplicable,
        "notApplicable",
        "diet-no-supported-animal-derived-conflict",
        [],
      ),
      evidence: [],
    },
  ];
};
