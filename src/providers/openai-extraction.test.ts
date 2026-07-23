import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it, vi } from "vitest";

import {
  EXTRACTION_PROVIDER_FAILURE_CATEGORIES,
  ExtractionProviderError,
  type ExtractionProvider,
} from "@/providers/extraction-provider";
import {
  contradictoryRawExtractionFixture,
  malformedRawExtractionFixture,
  promptInjectionRawExtractionFixture,
  unsafeContradictoryRawExtractionFixture,
  validRawExtractionFixture,
  verdictBearingRawExtractionFixture,
} from "@/test-fixtures/extraction";
import { rawExtractionStructuredOutputSchema } from "@/schemas/extraction";

vi.mock("server-only", () => ({}));

type OpenAIExtractionModule =
  typeof import("@/providers/openai-extraction");

const loadOpenAIExtractionModule =
  async (): Promise<OpenAIExtractionModule> =>
    import("@/providers/openai-extraction");

const createParsedResponse = (output: unknown) => ({
  id: "response-test",
  object: "response" as const,
  created_at: 0,
  status: "completed" as const,
  background: false,
  error: null,
  incomplete_details: null,
  instructions: null,
  max_output_tokens: null,
  max_tool_calls: null,
  model: "gpt-5.6",
  output: [],
  parallel_tool_calls: false,
  previous_response_id: null,
  prompt_cache_key: null,
  prompt_cache_retention: null,
  reasoning: null,
  safety_identifier: null,
  service_tier: "default" as const,
  store: false,
  temperature: null,
  text: { format: { type: "text" as const } },
  tool_choice: "auto" as const,
  tools: [],
  top_logprobs: 0,
  top_p: null,
  truncation: "disabled" as const,
  usage: null,
  user: null,
  metadata: null,
  output_text: "",
  output_parsed: output,
});

const createInput = (signal = new AbortController().signal) => ({
  image: {
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/jpeg" as const,
  },
  profile: {
    allergies: [{ allergenId: "peanut" }],
  },
  signal,
});

describe("provider-neutral extraction contract", () => {
  it("defines exactly four stable provider failure categories", () => {
    expect(EXTRACTION_PROVIDER_FAILURE_CATEGORIES).toEqual([
      "timeout",
      "unavailable",
      "rejected",
      "malformed",
    ]);
  });

  it("supports deterministic providers without OpenAI or environment access", async () => {
    const provider: ExtractionProvider = {
      extract: vi.fn().mockResolvedValue(validRawExtractionFixture),
    };

    await expect(provider.extract(createInput())).resolves.toEqual(
      validRawExtractionFixture,
    );
  });

  it("contains no OpenAI, environment, or server-only imports", () => {
    const source = readFileSync(
      resolve("src/providers/extraction-provider.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bopenai\b/i);
    expect(source).not.toContain("process.env");
    expect(source).not.toContain('import "server-only"');
  });
});

describe("OpenAI extraction adapter", () => {
  it("converts the structural extraction schema for strict provider output", () => {
    expect(() =>
      zodTextFormat(
        rawExtractionStructuredOutputSchema,
        "food_fact_extraction",
      ),
    ).not.toThrow();
  });

  it("is explicitly server-only and keeps provider imports isolated", () => {
    const source = readFileSync(
      resolve("src/providers/openai-extraction.ts"),
      "utf8",
    );

    expect(source).toMatch(/^import "server-only";/);
    expect(source).toContain('from "openai"');
    expect(source).toContain("process.env.OPENAI_API_KEY");
  });

  it("formats image input, minimized context, and structured output", async () => {
    const sendRequest = vi.fn().mockResolvedValue(
      createParsedResponse(validRawExtractionFixture),
    );
    const { createOpenAIExtractionProvider } =
      await loadOpenAIExtractionModule();
    const provider = createOpenAIExtractionProvider({ sendRequest });
    const input = createInput();

    await expect(provider.extract(input)).resolves.toEqual(
      validRawExtractionFixture,
    );

    const [request, options] = sendRequest.mock.calls[0];
    expect(request).toMatchObject({
      model: "gpt-5.6",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text" },
            {
              type: "input_image",
              image_url: "data:image/jpeg;base64,AQID",
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "food_fact_extraction",
          strict: true,
        },
      },
    });
    expect(request.instructions).toContain("untrusted data");
    expect(request.instructions).toContain('"allergenId":"peanut"');
    expect(request.instructions).not.toContain("measurements");
    expect(options.signal).toBe(input.signal);
  });

  it.each([
    ["valid contradictory", contradictoryRawExtractionFixture],
    ["prompt-injection label", promptInjectionRawExtractionFixture],
  ])("returns validated %s facts unchanged", async (_name, fixture) => {
    const sendRequest = vi
      .fn()
      .mockResolvedValue(createParsedResponse(fixture));
    const { createOpenAIExtractionProvider } =
      await loadOpenAIExtractionModule();

    await expect(
      createOpenAIExtractionProvider({ sendRequest }).extract(createInput()),
    ).resolves.toEqual(fixture);
  });

  it.each([
    ["malformed", malformedRawExtractionFixture],
    ["verdict-bearing", verdictBearingRawExtractionFixture],
    ["unsafe contradictory", unsafeContradictoryRawExtractionFixture],
  ])("rejects %s provider output as malformed", async (_name, output) => {
    const sendRequest = vi
      .fn()
      .mockResolvedValue(createParsedResponse(output));
    const { createOpenAIExtractionProvider } =
      await loadOpenAIExtractionModule();

    await expect(
      createOpenAIExtractionProvider({ sendRequest }).extract(createInput()),
    ).rejects.toMatchObject({
      name: "ExtractionProviderError",
      category: "malformed",
      message: "Food extraction could not be completed.",
    });
  });

  it("classifies a provider refusal as rejected without exposing it", async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      ...createParsedResponse(null),
      output: [
        {
          type: "message",
          id: "message-test",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "refusal",
              refusal: "Sensitive provider refusal detail",
            },
          ],
        },
      ],
    });
    const { createOpenAIExtractionProvider } =
      await loadOpenAIExtractionModule();

    await expect(
      createOpenAIExtractionProvider({ sendRequest }).extract(createInput()),
    ).rejects.toEqual(new ExtractionProviderError("rejected"));
  });

  it.each([
    [
      "timeout",
      new OpenAI.APIConnectionTimeoutError({ message: "provider timeout" }),
      "timeout",
    ],
    [
      "unavailable",
      new OpenAI.APIConnectionError({ message: "provider unavailable" }),
      "unavailable",
    ],
    [
      "rejected",
      new OpenAI.BadRequestError(
        400,
        { message: "provider rejected request" },
        "provider message",
        new Headers(),
      ),
      "rejected",
    ],
    ["malformed", new SyntaxError("provider output"), "malformed"],
  ] as const)(
    "classifies %s failures without leaking provider details",
    async (_name, providerFailure, category) => {
      const sendRequest = vi.fn().mockRejectedValue(providerFailure);
      const { createOpenAIExtractionProvider } =
        await loadOpenAIExtractionModule();

      await expect(
        createOpenAIExtractionProvider({ sendRequest }).extract(createInput()),
      ).rejects.toEqual(new ExtractionProviderError(category));
    },
  );

  it("preserves caller cancellation before a request", async () => {
    const controller = new AbortController();
    controller.abort(createAbortReason());
    const sendRequest = vi.fn();
    const { createOpenAIExtractionProvider } =
      await loadOpenAIExtractionModule();

    await expect(
      createOpenAIExtractionProvider({ sendRequest }).extract(
        createInput(controller.signal),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it("preserves caller cancellation during a request", async () => {
    const controller = new AbortController();
    const sendRequest = vi.fn().mockImplementation(async () => {
      controller.abort(createAbortReason());
      throw new OpenAI.APIConnectionError({ message: "request interrupted" });
    });
    const { createOpenAIExtractionProvider } =
      await loadOpenAIExtractionModule();

    await expect(
      createOpenAIExtractionProvider({ sendRequest }).extract(
        createInput(controller.signal),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

const createAbortReason = () =>
  new DOMException("Caller canceled.", "AbortError");
