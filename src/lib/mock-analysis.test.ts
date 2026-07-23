import { afterEach, describe, expect, it, vi } from "vitest";

import { analysisResponseSchema } from "@/domain/analysis";
import {
  createMockAnalysis,
  syntheticAnalysisResponses,
} from "@/lib/mock-analysis";
import type { PreparedImage } from "@/lib/image-lifecycle";
import type { UserProfile } from "@/domain/profile";

const preparedImage = {
  blob: new Blob(["prepared"], { type: "image/jpeg" }),
  objectUrl: "blob:prepared",
  width: 1200,
  height: 900,
  mimeType: "image/jpeg",
  sizeBytes: 8,
} satisfies PreparedImage;

const profile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [],
  highBloodPressure: false,
  diet: "none",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("mock analysis", () => {
  it("isolates valid synthetic responses for all four verdicts", () => {
    expect(
      Object.values(syntheticAnalysisResponses).map(
        ({ evaluation }) => evaluation.verdict,
      ),
    ).toEqual([
      "safe",
      "safeWithCaution",
      "avoid",
      "needMoreInformation",
    ]);

    for (const response of Object.values(syntheticAnalysisResponses)) {
      expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    }
  });

  it("resolves the selected response after an injected delay", async () => {
    vi.useFakeTimers();
    const analyze = createMockAnalysis({
      delayMs: 200,
      response: syntheticAnalysisResponses.avoid,
    });
    const completion = analyze(
      preparedImage,
      profile,
      new AbortController().signal,
    );

    await vi.advanceTimersByTimeAsync(199);
    let settled = false;
    void completion.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(completion).resolves.toBe(syntheticAnalysisResponses.avoid);
  });

  it("rejects a configured stable failure", async () => {
    vi.useFakeTimers();
    const error = { code: "providerUnavailable", retryable: true } as const;
    const completion = createMockAnalysis({ delayMs: 10, error })(
      preparedImage,
      profile,
      new AbortController().signal,
    );
    const rejection = expect(completion).rejects.toBe(error);

    await vi.advanceTimersByTimeAsync(10);
    await rejection;
  });

  it("cancels pending work and clears its timer", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const completion = createMockAnalysis({ delayMs: 10_000 })(
      preparedImage,
      profile,
      controller.signal,
    );

    controller.abort();

    await expect(completion).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
