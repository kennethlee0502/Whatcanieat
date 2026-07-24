import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Instrument_Serif: () => ({ variable: "--font-instrument-serif" }),
}));

import { metadata as buildMetadata } from "@/app/build/page";
import { metadata as rootMetadata } from "@/app/layout";
import { metadata as privacyMetadata } from "@/app/privacy/page";
import { completeRuleDefinitions } from "@/rules/engine";
import { safetyRuleDefinitionSchema } from "@/rules/provenance";

const projectPath = (...segments: string[]) =>
  resolve(process.cwd(), ...segments);

const listFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

describe("cross-layer release invariants", () => {
  it("keeps every registered rule versioned with complete reviewed provenance", () => {
    expect(completeRuleDefinitions.length).toBeGreaterThan(0);

    for (const definition of completeRuleDefinitions) {
      expect(safetyRuleDefinitionSchema.safeParse(definition).success).toBe(
        true,
      );
      expect(definition.provenance.reviewedOn).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      expect(
        Number.isNaN(Date.parse(`${definition.provenance.reviewedOn}T00:00:00Z`)),
      ).toBe(false);
      expect(definition.provenance.ruleVersion).toBe(definition.version);
    }
  });

  it("keeps secrets server-only and the environment template value-free", () => {
    expect(readFileSync(projectPath(".env.example"), "utf8").trim()).toBe(
      "OPENAI_API_KEY=",
    );

    const gitignore = readFileSync(projectPath(".gitignore"), "utf8");
    expect(gitignore).toContain(".env*");
    expect(gitignore).toContain("!.env.example");

    const clientSources = listFiles(projectPath("src"))
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) => source.startsWith('"use client";'));

    expect(clientSources.length).toBeGreaterThan(0);
    for (const { source } of clientSources) {
      expect(source).not.toMatch(
        /OPENAI_API_KEY|from ["']openai|@\/providers|server-only|extraction-prompt/,
      );
    }
  });

  it("contains no intentional sensitive logging in production source", () => {
    const productionSources = listFiles(projectPath("src"))
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => !path.includes(".test."))
      .map((path) => readFileSync(path, "utf8"));

    for (const source of productionSources) {
      expect(source).not.toMatch(
        /console\.(?:log|info|warn|error|debug)\s*\(/,
      );
    }
  });

  it("keeps accurate metadata on every public information route", () => {
    expect(rootMetadata).toMatchObject({
      title: "Can / I Eat This?",
      description: expect.stringContaining("food decision support"),
    });
    expect(privacyMetadata).toMatchObject({
      title: "Privacy | Can / I Eat This?",
      description: expect.stringContaining("temporary profile"),
    });
    expect(buildMetadata).toMatchObject({
      title: "How It Works | Can / I Eat This?",
      description: expect.stringContaining("deterministic dietary evaluation"),
    });
  });

  it("retains the shared mobile and accessibility foundations", () => {
    const globalStyles = readFileSync(
      projectPath("src/app/globals.css"),
      "utf8",
    );

    expect(globalStyles).toContain("--content-max: 26.875rem");
    expect(globalStyles).toContain("--content-gutter: clamp(1.25rem, 5vw, 1.5rem)");
    expect(globalStyles).toContain("env(safe-area-inset-top)");
    expect(globalStyles).toContain("env(safe-area-inset-bottom)");
    expect(globalStyles).toContain(":focus-visible");
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
