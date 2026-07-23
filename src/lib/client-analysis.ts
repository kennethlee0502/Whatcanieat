import {
  analysisErrorSchema,
  analysisResponseSchema,
  type AnalysisError,
  type AnalysisResponse,
} from "@/domain/analysis";
import { createAnalysisProfileContext } from "@/domain/profile-operations";
import type { UserProfile } from "@/domain/profile";
import type { PreparedImage } from "@/lib/image-lifecycle";

export type ClientAnalysis = (
  preparedImage: PreparedImage,
  profile: UserProfile,
  signal: AbortSignal,
) => Promise<AnalysisResponse>;

const invalidResponseError: AnalysisError = {
  code: "evaluationFailed",
  retryable: true,
};

const networkInterruptedError: AnalysisError = {
  code: "networkInterrupted",
  retryable: true,
};

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError;
  }
};

export const requestAnalysis: ClientAnalysis = async (
  preparedImage,
  profile,
  signal,
) => {
  const formData = new FormData();
  formData.append("image", preparedImage.blob, "food-image");
  formData.append(
    "profile",
    JSON.stringify(createAnalysisProfileContext(profile)),
  );

  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
      signal,
      cache: "no-store",
    });
  } catch {
    if (signal.aborted) {
      throw (
        signal.reason ??
        new DOMException("Analysis canceled.", "AbortError")
      );
    }
    throw networkInterruptedError;
  }

  const responseBody = await parseJsonResponse(response);
  if (response.ok) {
    const analysisResponse = analysisResponseSchema.safeParse(responseBody);
    if (analysisResponse.success) {
      return analysisResponse.data;
    }
    throw invalidResponseError;
  }

  const analysisError = analysisErrorSchema.safeParse(responseBody);
  if (analysisError.success) {
    throw analysisError.data;
  }
  throw invalidResponseError;
};
