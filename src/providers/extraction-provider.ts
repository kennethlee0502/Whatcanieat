import type { AnalysisImageMetadata } from "@/domain/analysis";
import type { AnalysisProfileContext } from "@/domain/profile";
import type { RawExtraction } from "@/schemas/extraction";

export const EXTRACTION_PROVIDER_FAILURE_CATEGORIES = [
  "timeout",
  "unavailable",
  "rejected",
  "malformed",
] as const;

export type ExtractionProviderFailureCategory =
  (typeof EXTRACTION_PROVIDER_FAILURE_CATEGORIES)[number];

export type ExtractionProviderInput = Readonly<{
  image: Readonly<{
    bytes: Uint8Array;
    mimeType: AnalysisImageMetadata["mimeType"];
  }>;
  profile: AnalysisProfileContext;
  signal: AbortSignal;
}>;

export interface ExtractionProvider {
  extract(input: ExtractionProviderInput): Promise<RawExtraction>;
}

export class ExtractionProviderError extends Error {
  readonly category: ExtractionProviderFailureCategory;

  constructor(category: ExtractionProviderFailureCategory) {
    super("Food extraction could not be completed.");
    this.name = "ExtractionProviderError";
    this.category = category;
  }
}
