import { z } from "zod";

import {
  donenessStatusSchema,
  evidenceItemSchema,
  ingredientPresenceSchema,
  pasteurizationStatusSchema,
  sodiumLevelSchema,
  ternaryFactSchema,
} from "@/domain/food";
import {
  confidenceLevelSchema,
  domainIdentifierSchema,
  evidenceIdsSchema,
  shortTextSchema,
} from "@/domain/primitives";

export const supportedRestrictionSchema = z.enum([
  "pregnancy",
  "allergy",
  "highBloodPressure",
  "vegetarian",
  "vegan",
]);

export const verdictSchema = z.enum([
  "safe",
  "safeWithCaution",
  "avoid",
  "needMoreInformation",
]);

export { confidenceLevelSchema } from "@/domain/primitives";

export const ruleDescriptorSchema = z
  .object({
    id: domainIdentifierSchema,
    version: z.string().trim().min(1).max(40),
    restriction: supportedRestrictionSchema,
  })
  .strict();

export const ruleMatchSchema = z
  .object({
    rule: ruleDescriptorSchema,
    status: z.enum(["triggered", "uncertain", "cleared", "notApplicable"]),
    risk: z.enum(["critical", "high", "moderate", "informational"]),
    recommendedVerdict: verdictSchema,
    reasonKey: domainIdentifierSchema,
    evidenceIds: evidenceIdsSchema,
    missingFactIds: z.array(domainIdentifierSchema).max(20),
    evidenceConfidence: confidenceLevelSchema,
  })
  .strict();

export const factPatchSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("setIngredientPresence"),
      ingredientId: domainIdentifierSchema,
      value: ingredientPresenceSchema,
      source: z.literal("userProvided"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("setPasteurization"),
      value: pasteurizationStatusSchema,
      source: z.literal("userProvided"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("setDoneness"),
      value: donenessStatusSchema,
      source: z.literal("userProvided"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("setRawAnimalProduct"),
      value: ternaryFactSchema,
      source: z.literal("userProvided"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("setSodiumLevel"),
      value: sodiumLevelSchema,
      source: z.literal("userProvided"),
    })
    .strict(),
]);

const clarificationAnswerOptionSchema = z
  .object({
    id: domainIdentifierSchema,
    label: z.string().trim().min(1).max(120),
    patch: factPatchSchema,
  })
  .strict();

export const clarificationQuestionSchema = z
  .object({
    id: domainIdentifierSchema,
    prompt: shortTextSchema,
    whyItMatters: shortTextSchema,
    relatedRuleIds: z.array(domainIdentifierSchema).max(20),
    relatedFactIds: z.array(domainIdentifierSchema).max(20),
    answerOptions: z.array(clarificationAnswerOptionSchema).min(2).max(10),
  })
  .strict();

export const clarificationAnswerSchema = z
  .object({
    questionId: domainIdentifierSchema,
    answerOptionId: domainIdentifierSchema,
  })
  .strict();

export const evaluationReasonSchema = z
  .object({
    id: domainIdentifierSchema,
    ruleId: domainIdentifierSchema,
    summary: shortTextSchema,
    evidenceIds: evidenceIdsSchema,
  })
  .strict();

export const evaluationResultSchema = z
  .object({
    verdict: verdictSchema,
    identifiedFood: z.string().trim().min(1).max(160).nullable(),
    recommendationConfidence: confidenceLevelSchema,
    reasons: z.array(evaluationReasonSchema).max(3),
    missingInformation: z.array(shortTextSchema).max(20),
    evidence: z.array(evidenceItemSchema).max(200),
    ruleMatches: z.array(ruleMatchSchema).max(100),
    clarificationQuestions: z.array(clarificationQuestionSchema).max(10),
    nextAction: shortTextSchema,
    supportedScopeStatement: shortTextSchema,
    ruleSetVersion: z.string().trim().min(1).max(40),
  })
  .strict();

export type SupportedRestriction = z.infer<
  typeof supportedRestrictionSchema
>;
export type Verdict = z.infer<typeof verdictSchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type RuleDescriptor = z.infer<typeof ruleDescriptorSchema>;
export type RuleMatch = z.infer<typeof ruleMatchSchema>;
export type FactPatch = z.infer<typeof factPatchSchema>;
export type ClarificationQuestion = z.infer<
  typeof clarificationQuestionSchema
>;
export type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;
export type EvaluationReason = z.infer<typeof evaluationReasonSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
