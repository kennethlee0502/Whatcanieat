import {
  ANALYSIS_RESPONSE_SCHEMA_VERSION,
  analysisErrorSchema,
  analysisImageMetadataSchema,
  analysisResponseSchema,
  type AnalysisError,
} from "@/domain/analysis";
import { normalizeRawExtraction } from "@/domain/normalization";
import { analysisProfileContextSchema } from "@/domain/profile";
import {
  ExtractionProviderError,
  type ExtractionProvider,
} from "@/providers/extraction-provider";
import { evaluateFood } from "@/rules/engine";
import { rawExtractionSchema } from "@/schemas/extraction";

export const MAX_ANALYSIS_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_ANALYSIS_REQUEST_BYTES =
  MAX_ANALYSIS_IMAGE_BYTES + 256 * 1024;
export const ANALYSIS_TIMEOUT_MS = 30_000;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

class AnalysisRouteError extends Error {
  readonly status: number;
  readonly responseError: AnalysisError;

  constructor(status: number, responseError: AnalysisError) {
    super("Analysis request failed.");
    this.name = "AnalysisRouteError";
    this.status = status;
    this.responseError = analysisErrorSchema.parse(responseError);
  }
}

type AnalysisRouteOptions = Readonly<{
  provider: ExtractionProvider;
  timeoutMs?: number;
}>;

const errorResponse = (
  status: number,
  error: AnalysisError,
): Response =>
  Response.json(analysisErrorSchema.parse(error), {
    status,
    headers: NO_STORE_HEADERS,
  });

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw (
      signal.reason ??
      new DOMException("Analysis request canceled.", "AbortError")
    );
  }
};

const readBoundedBody = async (
  request: Request,
  signal: AbortSignal,
): Promise<ArrayBuffer> => {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0
    ) {
      throw new AnalysisRouteError(400, {
        code: "invalidRequest",
        retryable: false,
      });
    }
    if (parsedLength > MAX_ANALYSIS_REQUEST_BYTES) {
      throw new AnalysisRouteError(413, {
        code: "imageTooLarge",
        retryable: false,
      });
    }
  }

  if (!request.body) {
    throw new AnalysisRouteError(400, {
      code: "invalidRequest",
      retryable: false,
    });
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const cancelReader = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener("abort", cancelReader, { once: true });

  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_ANALYSIS_REQUEST_BYTES) {
        await reader.cancel();
        throw new AnalysisRouteError(413, {
          code: "imageTooLarge",
          retryable: false,
        });
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }

  const bodyBuffer = new ArrayBuffer(totalBytes);
  const body = new Uint8Array(bodyBuffer);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bodyBuffer;
};

const parseMultipartRequest = async (
  request: Request,
  signal: AbortSignal,
) => {
  const contentType = request.headers.get("content-type");
  if (
    !contentType ||
    !contentType.toLowerCase().startsWith("multipart/form-data;") ||
    !/(?:^|;)\s*boundary=(?:"[^"]+"|[^;\s]+)/i.test(contentType)
  ) {
    throw new AnalysisRouteError(415, {
      code: "invalidRequest",
      retryable: false,
    });
  }

  const body = await readBoundedBody(request, signal);
  throwIfAborted(signal);

  let formData: FormData;
  try {
    formData = await new Response(body, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new AnalysisRouteError(400, {
      code: "invalidRequest",
      retryable: false,
    });
  }

  const entries = [...formData.entries()];
  if (
    entries.length !== 2 ||
    entries.filter(([name]) => name === "image").length !== 1 ||
    entries.filter(([name]) => name === "profile").length !== 1
  ) {
    throw new AnalysisRouteError(400, {
      code: "invalidRequest",
      retryable: false,
    });
  }

  const image = formData.get("image");
  const serializedProfile = formData.get("profile");
  if (
    image === null ||
    typeof image === "string" ||
    typeof serializedProfile !== "string"
  ) {
    throw new AnalysisRouteError(400, {
      code: "invalidRequest",
      retryable: false,
    });
  }

  if (image.size === 0) {
    throw new AnalysisRouteError(400, {
      code: "invalidImage",
      retryable: false,
    });
  }
  if (image.size > MAX_ANALYSIS_IMAGE_BYTES) {
    throw new AnalysisRouteError(413, {
      code: "imageTooLarge",
      retryable: false,
    });
  }

  const imageMetadata = analysisImageMetadataSchema.safeParse({
    mimeType: image.type,
    sizeBytes: image.size,
  });
  if (!imageMetadata.success) {
    throw new AnalysisRouteError(415, {
      code: "unsupportedImage",
      retryable: false,
    });
  }

  let rawProfile: unknown;
  try {
    rawProfile = JSON.parse(serializedProfile);
  } catch {
    throw new AnalysisRouteError(400, {
      code: "invalidRequest",
      retryable: false,
    });
  }

  const profile = analysisProfileContextSchema.safeParse(rawProfile);
  if (!profile.success) {
    throw new AnalysisRouteError(400, {
      code: "invalidRequest",
      retryable: false,
    });
  }

  throwIfAborted(signal);
  return {
    image: {
      bytes: new Uint8Array(await image.arrayBuffer()),
      mimeType: imageMetadata.data.mimeType,
    },
    profile: profile.data,
  };
};

const providerErrorResponse = (
  error: ExtractionProviderError,
): Response => {
  switch (error.category) {
    case "timeout":
      return errorResponse(504, {
        code: "analysisTimeout",
        retryable: true,
      });
    case "unavailable":
      return errorResponse(503, {
        code: "providerUnavailable",
        retryable: true,
      });
    case "rejected":
      return errorResponse(422, {
        code: "invalidExtraction",
        retryable: false,
      });
    case "malformed":
      return errorResponse(502, {
        code: "invalidExtraction",
        retryable: true,
      });
  }
};

export const createAnalysisRoute = ({
  provider,
  timeoutMs = ANALYSIS_TIMEOUT_MS,
}: AnalysisRouteOptions) => {
  return async (request: Request): Promise<Response> => {
    const operationController = new AbortController();
    let routeTimedOut = false;
    const handleCallerAbort = () => {
      operationController.abort(
        request.signal.reason ??
          new DOMException("Analysis request canceled.", "AbortError"),
      );
    };
    request.signal.addEventListener("abort", handleCallerAbort, {
      once: true,
    });
    const timeout = setTimeout(() => {
      routeTimedOut = true;
      operationController.abort(
        new DOMException("Analysis request timed out.", "TimeoutError"),
      );
    }, timeoutMs);

    try {
      const input = await parseMultipartRequest(
        request,
        operationController.signal,
      );
      const providerExtraction = await provider.extract({
        ...input,
        signal: operationController.signal,
      });
      throwIfAborted(operationController.signal);

      const extraction = rawExtractionSchema.safeParse(providerExtraction);
      if (!extraction.success) {
        throw new AnalysisRouteError(502, {
          code: "invalidExtraction",
          retryable: true,
        });
      }

      let response;
      try {
        const facts = normalizeRawExtraction(extraction.data);
        const evaluation = evaluateFood(input.profile, facts);
        response = analysisResponseSchema.parse({
          schemaVersion: ANALYSIS_RESPONSE_SCHEMA_VERSION,
          facts,
          evaluation,
        });
      } catch {
        throw new AnalysisRouteError(500, {
          code: "evaluationFailed",
          retryable: true,
        });
      }

      return Response.json(response, {
        status: 200,
        headers: NO_STORE_HEADERS,
      });
    } catch (error) {
      if (request.signal.aborted) {
        throw (
          request.signal.reason ??
          new DOMException("Analysis request canceled.", "AbortError")
        );
      }
      if (routeTimedOut) {
        return errorResponse(504, {
          code: "analysisTimeout",
          retryable: true,
        });
      }
      if (error instanceof AnalysisRouteError) {
        return errorResponse(error.status, error.responseError);
      }
      if (error instanceof ExtractionProviderError) {
        return providerErrorResponse(error);
      }
      return errorResponse(500, {
        code: "evaluationFailed",
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", handleCallerAbort);
    }
  };
};
