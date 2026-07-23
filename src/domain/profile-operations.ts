import {
  analysisProfileContextSchema,
  bodyMeasurementsSchema,
  type AnalysisProfileContext,
  type BodyMeasurements,
  type UserProfile,
} from "@/domain/profile";

const KILOGRAMS_PER_POUND = 0.45359237;
const METERS_PER_INCH = 0.0254;
const CENTIMETERS_PER_METER = 100;

export const calculateBmi = (
  measurements: BodyMeasurements,
): number | null => {
  const validationResult = bodyMeasurementsSchema.safeParse(measurements);

  if (
    !validationResult.success ||
    !validationResult.data.height ||
    !validationResult.data.weight
  ) {
    return null;
  }

  const { height, weight } = validationResult.data;
  const heightMeters =
    height.unit === "centimeters"
      ? height.value / CENTIMETERS_PER_METER
      : height.value * METERS_PER_INCH;
  const weightKilograms =
    weight.unit === "kilograms"
      ? weight.value
      : weight.value * KILOGRAMS_PER_POUND;
  const bmi = weightKilograms / heightMeters ** 2;

  return Number.isFinite(bmi) ? Number(bmi.toFixed(1)) : null;
};

export const createAnalysisProfileContext = (
  profile: UserProfile,
): AnalysisProfileContext => {
  const context = {
    ...(profile.pregnancy.status === "pregnant"
      ? {
          pregnancy:
            profile.pregnancy.week === undefined
              ? {}
              : { week: profile.pregnancy.week },
        }
      : {}),
    ...(profile.allergies.length > 0
      ? {
          allergies: profile.allergies.map(({ allergenId, severity }) => ({
            allergenId,
            ...(severity === undefined ? {} : { severity }),
          })),
        }
      : {}),
    ...(profile.highBloodPressure ? { highBloodPressure: true as const } : {}),
    ...(profile.diet === "none" ? {} : { diet: profile.diet }),
  } satisfies AnalysisProfileContext;

  return analysisProfileContextSchema.parse(context);
};
