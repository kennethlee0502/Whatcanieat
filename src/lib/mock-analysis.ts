import type { AnalysisError, AnalysisResponse } from "@/domain/analysis";
import {
  ANALYSIS_RESPONSE_SCHEMA_VERSION,
  analysisResponseSchema,
} from "@/domain/analysis";
import type { ExtractedFoodFacts } from "@/domain/food";
import { evaluateFood } from "@/rules/engine";

const identityEvidence = {
  id: "mock-identity",
  source: "visibleInImage",
  strength: "confirmed",
  summary: "A prepared food item is clearly visible.",
} as const;

const baseFacts = (
  overrides: Partial<ExtractedFoodFacts> = {},
): ExtractedFoodFacts => ({
  schemaVersion: 1,
  imageSuitability: "foodDetected",
  foodCandidates: [
    {
      id: "mock-food",
      displayName: "Prepared food",
      canonicalName: "prepared-food",
      identityConfidence: "high",
      evidenceIds: [identityEvidence.id],
    },
  ],
  primaryFoodId: "mock-food",
  ingredients: [],
  preparation: {
    pasteurization: "notApplicable",
    doneness: "notApplicable",
    rawAnimalProduct: "unknown",
    evidenceIds: [],
  },
  nutrition: {
    sodiumLevel: "unknown",
    highlyProcessed: "unknown",
    evidenceIds: [],
  },
  labels: [],
  evidence: [identityEvidence],
  uncertainties: [],
  contradictions: [],
  extractionConfidence: "high",
  ...overrides,
});

const response = (
  facts: ExtractedFoodFacts,
  evaluation: ReturnType<typeof evaluateFood>,
): AnalysisResponse =>
  analysisResponseSchema.parse({
    schemaVersion: ANALYSIS_RESPONSE_SCHEMA_VERSION,
    facts,
    evaluation,
  });

const safeFacts = baseFacts();

const cautionFacts = baseFacts({
  nutrition: {
    sodiumLevel: "high",
    sodiumMilligrams: 720,
    servingDescription: "one labeled serving",
    highlyProcessed: "unknown",
    evidenceIds: ["mock-sodium"],
  },
  evidence: [
    identityEvidence,
    {
      id: "mock-sodium",
      source: "readableOnLabel",
      strength: "confirmed",
      summary: "The readable label lists 720 mg sodium per serving.",
    },
  ],
});

const avoidFacts = baseFacts({
  ingredients: [
    {
      id: "mock-peanut-ingredient",
      ingredientId: "peanut",
      displayName: "Peanut",
      presence: "confirmed",
      evidenceIds: ["mock-peanut"],
    },
  ],
  evidence: [
    identityEvidence,
    {
      id: "mock-peanut",
      source: "readableOnLabel",
      strength: "confirmed",
      summary: "The readable ingredient label lists peanut.",
    },
  ],
});

const unknownFacts = baseFacts({
  ingredients: [
    {
      id: "mock-peanut-ingredient",
      ingredientId: "peanut",
      displayName: "Peanut",
      presence: "possible",
      evidenceIds: ["mock-peanut-possible"],
    },
  ],
  evidence: [
    identityEvidence,
    {
      id: "mock-peanut-possible",
      source: "conventionalInference",
      strength: "possible",
      summary: "Peanut may be present, but the image does not confirm it.",
    },
  ],
  uncertainties: [
    {
      id: "mock-peanut-unknown",
      subject: "Whether peanut is present",
      kind: "ingredient",
      description: "The complete ingredient list is not visible.",
      safetyRelevance: "consequential",
      resolvableByUser: true,
      relatedFactIds: ["mock-peanut-ingredient"],
    },
  ],
});

export const syntheticAnalysisResponses = {
  safe: response(safeFacts, evaluateFood({}, safeFacts)),
  safeWithCaution: response(
    cautionFacts,
    evaluateFood({ highBloodPressure: true }, cautionFacts),
  ),
  avoid: response(
    avoidFacts,
    evaluateFood({ allergies: [{ allergenId: "peanut" }] }, avoidFacts),
  ),
  needMoreInformation: response(
    unknownFacts,
    evaluateFood({ allergies: [{ allergenId: "peanut" }] }, unknownFacts),
  ),
} as const satisfies Readonly<Record<string, AnalysisResponse>>;

export type MockAnalysis = (
  signal: AbortSignal,
) => Promise<AnalysisResponse>;

type MockAnalysisOptions = Readonly<{
  delayMs?: number;
  response?: AnalysisResponse;
  error?: AnalysisError;
}>;

export const createMockAnalysis = ({
  delayMs = 4_800,
  response: selectedResponse = syntheticAnalysisResponses.needMoreInformation,
  error,
}: MockAnalysisOptions = {}): MockAnalysis => {
  return (signal) =>
    new Promise<AnalysisResponse>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Analysis canceled", "AbortError"));
        return;
      }

      const timeout = window.setTimeout(() => {
        signal.removeEventListener("abort", cancel);
        if (error) {
          reject(error);
          return;
        }
        resolve(selectedResponse);
      }, delayMs);

      const cancel = () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Analysis canceled", "AbortError"));
      };

      signal.addEventListener("abort", cancel, { once: true });
    });
};

export const mockAnalysis = createMockAnalysis();
