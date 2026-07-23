import { describe, expect, it } from "vitest";

import {
  ruleProvenanceSchema,
  safetyRuleDefinitionSchema,
} from "@/rules/provenance";

const provenance = {
  source: "Example public-health authority",
  guidance: "Example reviewed guidance relevant to this rule.",
  sourceReference: "https://example.gov/guidance/example",
  reviewedOn: "2026-07-23",
  ruleVersion: "1.0.0",
  assumptions: ["The evidence applies to adults in the supported profile."],
  scopeLimitations: ["This rule addresses only the stated food concern."],
} as const;

describe("rule provenance", () => {
  it("accepts a complete safety rule with matching provenance", () => {
    expect(
      safetyRuleDefinitionSchema.parse({
        id: "example-rule",
        version: "1.0.0",
        restriction: "pregnancy",
        provenance,
      }),
    ).toEqual({
      id: "example-rule",
      version: "1.0.0",
      restriction: "pregnancy",
      provenance,
    });
  });

  it.each([
    "source",
    "guidance",
    "sourceReference",
    "reviewedOn",
    "ruleVersion",
    "assumptions",
    "scopeLimitations",
  ] as const)("requires the provenance field %s", (field) => {
    const incomplete = { ...provenance };
    delete incomplete[field];

    expect(ruleProvenanceSchema.safeParse(incomplete).success).toBe(false);
  });

  it("requires documented assumptions and scope limitations", () => {
    expect(
      ruleProvenanceSchema.safeParse({
        ...provenance,
        assumptions: [],
      }).success,
    ).toBe(false);
    expect(
      ruleProvenanceSchema.safeParse({
        ...provenance,
        scopeLimitations: [],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid review dates and unstable source-reference shapes", () => {
    expect(
      ruleProvenanceSchema.safeParse({
        ...provenance,
        reviewedOn: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      ruleProvenanceSchema.safeParse({
        ...provenance,
        sourceReference: "example guidance",
      }).success,
    ).toBe(false);
  });

  it("requires the provenance version to match the rule version", () => {
    expect(
      safetyRuleDefinitionSchema.safeParse({
        id: "example-rule",
        version: "2.0.0",
        restriction: "allergy",
        provenance,
      }).success,
    ).toBe(false);
  });

  it("rejects a safety rule without provenance", () => {
    expect(
      safetyRuleDefinitionSchema.safeParse({
        id: "example-rule",
        version: "1.0.0",
        restriction: "allergy",
      }).success,
    ).toBe(false);
  });
});
