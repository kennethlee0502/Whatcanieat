import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisError } from "@/domain/analysis";
import type { UserProfile } from "@/domain/profile";
import { requestAnalysis } from "@/lib/client-analysis";
import type { PreparedImage } from "@/lib/image-lifecycle";
import { syntheticAnalysisResponses } from "@/lib/mock-analysis";

const preparedImage: PreparedImage = {
  blob: new Blob(["prepared"], { type: "image/jpeg" }),
  objectUrl: "blob:prepared",
  width: 1200,
  height: 900,
  mimeType: "image/jpeg",
  sizeBytes: 8,
};

const completeProfile = {
  pregnancy: { status: "pregnant", week: 18 },
  allergies: [
    { allergenId: "peanut", label: "Peanuts", severity: "severe" },
  ],
  highBloodPressure: true,
  diet: "vegan",
  measurements: {
    height: { value: 170, unit: "centimeters" },
    weight: { value: 65, unit: "kilograms" },
    bmi: 22.5,
  },
  storageMetadata: { restoredAt: "not-for-analysis" },
  uiState: { screen: "preview" },
} as const satisfies UserProfile & {
  storageMetadata: unknown;
  uiState: unknown;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("client analysis request", () => {
  it("submits exactly one image and one minimized profile field", async () => {
    const fetchRequest = vi.fn().mockResolvedValue(
      jsonResponse(syntheticAnalysisResponses.avoid),
    );
    vi.stubGlobal("fetch", fetchRequest);

    await expect(
      requestAnalysis(
        preparedImage,
        completeProfile,
        new AbortController().signal,
      ),
    ).resolves.toEqual(syntheticAnalysisResponses.avoid);

    expect(fetchRequest).toHaveBeenCalledOnce();
    const [url, request] = fetchRequest.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/analyze");
    expect(request).toMatchObject({
      method: "POST",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(request.headers).toBeUndefined();

    const formData = request.body as FormData;
    expect([...formData.keys()]).toEqual(["image", "profile"]);
    expect(formData.getAll("image")).toHaveLength(1);
    expect(formData.getAll("profile")).toHaveLength(1);
    expect(formData.get("image")).toBeInstanceOf(File);

    const serializedProfile = formData.get("profile");
    expect(typeof serializedProfile).toBe("string");
    expect(JSON.parse(serializedProfile as string)).toEqual({
      pregnancy: { week: 18 },
      allergies: [{ allergenId: "peanut", severity: "severe" }],
      highBloodPressure: true,
      diet: "vegan",
    });
    expect(serializedProfile).not.toMatch(
      /height|weight|bmi|Peanuts|storageMetadata|uiState|screen/,
    );
  });

  it.each([
    ["invalidRequest", false],
    ["invalidImage", false],
    ["unsupportedImage", false],
    ["imageTooLarge", false],
    ["analysisTimeout", true],
    ["providerUnavailable", true],
    ["invalidExtraction", false],
    ["invalidExtraction", true],
    ["evaluationFailed", true],
  ] as const)(
    "returns the validated %s server error",
    async (code, retryable) => {
      const serverError: AnalysisError = { code, retryable };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse(serverError, 502)),
      );

      await expect(
        requestAnalysis(
          preparedImage,
          completeProfile,
          new AbortController().signal,
        ),
      ).rejects.toEqual(serverError);
    },
  );

  it("maps fetch rejection to a stable network interruption", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        new Error("provider hostname and private transport details"),
      ),
    );

    await expect(
      requestAnalysis(
        preparedImage,
        completeProfile,
        new AbortController().signal,
      ),
    ).rejects.toEqual({
      code: "networkInterrupted",
      retryable: true,
    });
  });

  it("preserves caller cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, request: RequestInit) =>
          new Promise((_resolve, reject) => {
            request.signal?.addEventListener(
              "abort",
              () => reject(request.signal?.reason),
              { once: true },
            );
          }),
      ),
    );
    const completion = requestAnalysis(
      preparedImage,
      completeProfile,
      controller.signal,
    );

    controller.abort(new DOMException("Caller canceled.", "AbortError"));

    await expect(completion).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([
    ["malformed JSON", new Response("{", { status: 200 })],
    [
      "HTML",
      new Response("<html>provider detail</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    ],
    ["empty body", new Response(null, { status: 200 })],
    [
      "schema-invalid success",
      jsonResponse({ providerResponse: "private raw output" }),
    ],
    [
      "schema-invalid error",
      jsonResponse({ message: "private server failure" }, 500),
    ],
  ])("redacts %s as evaluationFailed", async (_name, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(
      requestAnalysis(
        preparedImage,
        completeProfile,
        new AbortController().signal,
      ),
    ).rejects.toEqual({
      code: "evaluationFailed",
      retryable: true,
    });
  });
});
