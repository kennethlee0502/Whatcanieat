import { z } from "zod";

import { supportedRestrictionSchema } from "@/domain/evaluation";
import {
  domainIdentifierSchema,
  shortTextSchema,
} from "@/domain/primitives";

const ruleVersionSchema = z.string().trim().min(1).max(40);

const reviewedOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO calendar date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
  }, "Use a valid calendar date.");

export const ruleProvenanceSchema = z
  .object({
    source: z.string().trim().min(1).max(200),
    guidance: z.string().trim().min(1).max(1_000),
    sourceReference: z.string().trim().url().max(500),
    reviewedOn: reviewedOnSchema,
    ruleVersion: ruleVersionSchema,
    assumptions: z.array(shortTextSchema).min(1).max(20),
    scopeLimitations: z.array(shortTextSchema).min(1).max(20),
  })
  .strict();

export const safetyRuleDefinitionSchema = z
  .object({
    id: domainIdentifierSchema,
    version: ruleVersionSchema,
    restriction: supportedRestrictionSchema,
    provenance: ruleProvenanceSchema,
  })
  .strict()
  .superRefine((rule, refinementContext) => {
    if (rule.version !== rule.provenance.ruleVersion) {
      refinementContext.addIssue({
        code: "custom",
        message: "Rule and provenance versions must match.",
        path: ["provenance", "ruleVersion"],
      });
    }
  });

export type RuleProvenance = z.infer<typeof ruleProvenanceSchema>;
export type SafetyRuleDefinition = z.infer<
  typeof safetyRuleDefinitionSchema
>;
