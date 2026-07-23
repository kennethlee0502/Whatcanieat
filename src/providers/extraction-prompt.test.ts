import { describe, expect, it } from "vitest";

import {
  assembleExtractionPrompt,
  EXTRACTION_PROMPT_POLICY,
  EXTRACTION_PROMPT_POLICY_VERSION,
  extractionPromptInputSchema,
  promptPolicyVersionSchema,
} from "@/providers/extraction-prompt";

describe("server-owned extraction prompt policy", () => {
  it("has a stable, validated policy version without prescribing its format", () => {
    expect(
      promptPolicyVersionSchema.parse(EXTRACTION_PROMPT_POLICY_VERSION),
    ).toBe(EXTRACTION_PROMPT_POLICY_VERSION);
    expect(promptPolicyVersionSchema.safeParse("release-2026-07").success).toBe(
      true,
    );
    expect(
      extractionPromptInputSchema.safeParse({
        promptPolicyVersion: "different-policy",
        extractionSchemaVersion: 1,
        profile: {},
      }).success,
    ).toBe(false);
  });

  it("requires only the strict minimized analysis profile context", () => {
    expect(
      extractionPromptInputSchema.safeParse({
        promptPolicyVersion: EXTRACTION_PROMPT_POLICY_VERSION,
        extractionSchemaVersion: 1,
        profile: {
          pregnancy: { week: 18 },
          allergies: [{ allergenId: "peanut", severity: "severe" }],
          highBloodPressure: true,
          diet: "vegetarian",
        },
      }).success,
    ).toBe(true);

    expect(
      extractionPromptInputSchema.safeParse({
        promptPolicyVersion: EXTRACTION_PROMPT_POLICY_VERSION,
        extractionSchemaVersion: 1,
        profile: {
          diet: "vegan",
          measurements: { bmi: 22.5 },
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["full user-profile fields", { pregnancy: { status: "notPregnant" } }],
    ["height", { measurements: { height: 170 } }],
    ["weight", { weight: 65 }],
    ["BMI", { bmi: 22.5 }],
    ["storage metadata", { storedAt: "2026-07-23" }],
    ["UI state", { screen: "analyzing" }],
  ])("rejects %s", (_caseName, forbiddenProfile) => {
    expect(
      extractionPromptInputSchema.safeParse({
        promptPolicyVersion: EXTRACTION_PROMPT_POLICY_VERSION,
        extractionSchemaVersion: 1,
        profile: forbiddenProfile,
      }).success,
    ).toBe(false);
  });

  it("defines fact-only, injection-resistant extraction boundaries", () => {
    const policy = EXTRACTION_PROMPT_POLICY.join(" ");

    expect(policy).toContain("untrusted data");
    expect(policy).toContain("Do not produce a verdict");
    expect(policy).toContain("personalized medical guidance");
    expect(policy).toContain("explicitly as unknown");
    expect(policy).toContain("Preserve contradictory claims");
  });

  it("assembles the versioned policy with only minimized context", () => {
    const prompt = assembleExtractionPrompt({
      promptPolicyVersion: EXTRACTION_PROMPT_POLICY_VERSION,
      extractionSchemaVersion: 1,
      profile: {
        allergies: [{ allergenId: "peanut" }],
        diet: "vegan",
      },
    });

    expect(prompt).toContain(
      `Prompt policy version: ${EXTRACTION_PROMPT_POLICY_VERSION}`,
    );
    expect(prompt).toContain("Extraction schema version: 1");
    expect(prompt).toContain('"allergenId":"peanut"');
    expect(prompt).toContain('"diet":"vegan"');
    expect(prompt).not.toContain("measurements");
  });
});
