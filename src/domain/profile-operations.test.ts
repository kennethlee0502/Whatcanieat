import { describe, expect, it } from "vitest";

import {
  calculateBmi,
  createAnalysisProfileContext,
} from "@/domain/profile-operations";
import {
  analysisProfileContextSchema,
  bodyMeasurementsSchema,
  type UserProfile,
} from "@/domain/profile";

const unrestrictedProfile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [],
  highBloodPressure: false,
  diet: "none",
  measurements: {
    height: { value: 170, unit: "centimeters" },
    weight: { value: 65, unit: "kilograms" },
    bmi: 22.5,
  },
};

describe("calculateBmi", () => {
  it("calculates metric BMI rounded to one decimal place", () => {
    expect(
      calculateBmi({
        height: { value: 170, unit: "centimeters" },
        weight: { value: 65, unit: "kilograms" },
      }),
    ).toBe(22.5);
  });

  it("calculates imperial BMI rounded to one decimal place", () => {
    expect(
      calculateBmi({
        height: { value: 67, unit: "inches" },
        weight: { value: 143, unit: "pounds" },
      }),
    ).toBe(22.4);
  });

  it("returns null for incomplete or invalid measurements", () => {
    expect(
      calculateBmi({ height: { value: 170, unit: "centimeters" } }),
    ).toBeNull();
    expect(
      calculateBmi({
        height: { value: 0, unit: "centimeters" },
        weight: { value: 65, unit: "kilograms" },
      }),
    ).toBeNull();
  });

  it("validates supported units at runtime", () => {
    expect(
      bodyMeasurementsSchema.safeParse({
        height: { value: 1.7, unit: "meters" },
        weight: { value: 65, unit: "kilograms" },
      }).success,
    ).toBe(false);
  });
});

describe("createAnalysisProfileContext", () => {
  it("returns an empty context when no supported restrictions are active", () => {
    expect(createAnalysisProfileContext(unrestrictedProfile)).toEqual({});
  });

  it("allowlists only active analysis restrictions", () => {
    const profile: UserProfile = {
      pregnancy: { status: "pregnant", week: 18 },
      allergies: [
        { allergenId: "peanut", label: "Peanuts", severity: "severe" },
        { allergenId: "sesame", label: "Sesame" },
      ],
      highBloodPressure: true,
      diet: "vegan",
      measurements: {
        height: { value: 67, unit: "inches" },
        weight: { value: 143, unit: "pounds" },
        bmi: 22.4,
      },
    };

    expect(createAnalysisProfileContext(profile)).toEqual({
      pregnancy: { week: 18 },
      allergies: [
        { allergenId: "peanut", severity: "severe" },
        { allergenId: "sesame" },
      ],
      highBloodPressure: true,
      diet: "vegan",
    });
  });

  it("represents pregnancy without requiring a week", () => {
    expect(
      createAnalysisProfileContext({
        ...unrestrictedProfile,
        pregnancy: { status: "pregnant" },
      }),
    ).toEqual({ pregnancy: {} });
  });

  it("never serializes labels, height, weight, or BMI", () => {
    const serializedContext = JSON.stringify(
      createAnalysisProfileContext({
        ...unrestrictedProfile,
        allergies: [
          { allergenId: "peanut", label: "Peanuts", severity: "severe" },
        ],
      }),
    );

    expect(serializedContext).not.toContain("Peanuts");
    expect(serializedContext).not.toContain("height");
    expect(serializedContext).not.toContain("weight");
    expect(serializedContext).not.toContain("bmi");
    expect(analysisProfileContextSchema.safeParse(JSON.parse(serializedContext)).success).toBe(true);
  });
});
