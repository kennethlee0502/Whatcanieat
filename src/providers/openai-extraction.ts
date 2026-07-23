import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  ResponseCreateParamsWithTools,
} from "openai/lib/ResponsesParser";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { z } from "zod";

import {
  ExtractionProviderError,
  type ExtractionProvider,
} from "@/providers/extraction-provider";
import {
  assembleExtractionPrompt,
  EXTRACTION_PROMPT_POLICY_VERSION,
} from "@/providers/extraction-prompt";
import {
  RAW_EXTRACTION_SCHEMA_VERSION,
  rawExtractionSchema,
  rawExtractionStructuredOutputSchema,
  type RawExtraction,
} from "@/schemas/extraction";

const OPENAI_EXTRACTION_MODEL = "gpt-5.6";
const OPENAI_EXTRACTION_FORMAT_NAME = "food_fact_extraction";

type OpenAIExtractionResponse = ParsedResponse<RawExtraction>;

type SendOpenAIExtractionRequest = (
  request: ResponseCreateParamsWithTools,
  options: Readonly<{ signal: AbortSignal }>,
) => Promise<OpenAIExtractionResponse>;

type OpenAIExtractionOptions = Readonly<{
  sendRequest?: SendOpenAIExtractionRequest;
}>;

const createAbortError = (): DOMException =>
  new DOMException("Extraction canceled.", "AbortError");

const throwIfCallerAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw signal.reason ?? createAbortError();
  }
};

const includesRefusal = (response: OpenAIExtractionResponse): boolean =>
  response.output.some(
    (output) =>
      output.type === "message" &&
      output.content.some((content) => content.type === "refusal"),
  );

const classifyProviderError = (error: unknown): ExtractionProviderError => {
  if (error instanceof ExtractionProviderError) {
    return error;
  }

  if (
    error instanceof SyntaxError ||
    error instanceof z.ZodError
  ) {
    return new ExtractionProviderError("malformed");
  }

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new ExtractionProviderError("timeout");
  }

  if (
    error instanceof OpenAI.BadRequestError ||
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.PermissionDeniedError ||
    error instanceof OpenAI.NotFoundError ||
    error instanceof OpenAI.ConflictError ||
    error instanceof OpenAI.UnprocessableEntityError
  ) {
    return new ExtractionProviderError("rejected");
  }

  return new ExtractionProviderError("unavailable");
};

const createDefaultRequestSender = (): SendOpenAIExtractionRequest => {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return (request, options) =>
    client.responses.parse(request, options) as Promise<OpenAIExtractionResponse>;
};

export const createOpenAIExtractionProvider = ({
  sendRequest,
}: OpenAIExtractionOptions = {}): ExtractionProvider => ({
  async extract({ image, profile, signal }) {
    throwIfCallerAborted(signal);

    const prompt = assembleExtractionPrompt({
      promptPolicyVersion: EXTRACTION_PROMPT_POLICY_VERSION,
      extractionSchemaVersion: RAW_EXTRACTION_SCHEMA_VERSION,
      profile,
    });
    const imageDataUrl = `data:${image.mimeType};base64,${Buffer.from(
      image.bytes,
    ).toString("base64")}`;

    try {
      const response = await (sendRequest ?? createDefaultRequestSender())(
        {
          model: OPENAI_EXTRACTION_MODEL,
          instructions: prompt,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Extract food facts from the attached image.",
                },
                {
                  type: "input_image",
                  image_url: imageDataUrl,
                  detail: "high",
                },
              ],
            },
          ],
          text: {
            format: zodTextFormat(
              rawExtractionStructuredOutputSchema,
              OPENAI_EXTRACTION_FORMAT_NAME,
            ),
          },
        },
        { signal },
      );

      throwIfCallerAborted(signal);

      if (includesRefusal(response)) {
        throw new ExtractionProviderError("rejected");
      }
      if (response.output_parsed === null) {
        throw new ExtractionProviderError("malformed");
      }

      return rawExtractionSchema.parse(response.output_parsed);
    } catch (error) {
      throwIfCallerAborted(signal);
      throw classifyProviderError(error);
    }
  },
});
