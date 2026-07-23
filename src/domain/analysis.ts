import { z } from "zod";

import { evaluationResultSchema } from "@/domain/evaluation";
import { extractedFoodFactsSchema } from "@/domain/food";
import {
  analysisProfileContextSchema,
  userProfileSchema,
} from "@/domain/profile";

export const ANALYSIS_REQUEST_SCHEMA_VERSION = 1 as const;
export const ANALYSIS_RESPONSE_SCHEMA_VERSION = 1 as const;
export const STORED_PROFILE_SCHEMA_VERSION = 1 as const;

export const analysisImageMetadataSchema = z
  .object({
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export const analysisRequestSchema = z
  .object({
    schemaVersion: z.literal(ANALYSIS_REQUEST_SCHEMA_VERSION),
    profile: analysisProfileContextSchema,
    image: analysisImageMetadataSchema,
  })
  .strict();

export const analysisResponseSchema = z
  .object({
    schemaVersion: z.literal(ANALYSIS_RESPONSE_SCHEMA_VERSION),
    facts: extractedFoodFactsSchema,
    evaluation: evaluationResultSchema,
  })
  .strict();

export const storedProfileEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(STORED_PROFILE_SCHEMA_VERSION),
    profile: userProfileSchema,
  })
  .strict();

export const analysisErrorCodeSchema = z.enum([
  "invalidRequest",
  "invalidImage",
  "unsupportedImage",
  "imageTooLarge",
  "noFoodDetected",
  "analysisTimeout",
  "providerUnavailable",
  "networkInterrupted",
  "rateLimited",
  "invalidExtraction",
  "evaluationFailed",
]);

export const analysisErrorSchema = z
  .object({
    code: analysisErrorCodeSchema,
    retryable: z.boolean(),
  })
  .strict();

export type AnalysisImageMetadata = z.infer<
  typeof analysisImageMetadataSchema
>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type StoredProfileEnvelope = z.infer<
  typeof storedProfileEnvelopeSchema
>;
export type AnalysisErrorCode = z.infer<typeof analysisErrorCodeSchema>;
export type AnalysisError = z.infer<typeof analysisErrorSchema>;
