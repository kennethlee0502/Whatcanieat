import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisFlow } from "@/app/app/analysis-flow";
import type { AnalysisResponse } from "@/domain/analysis";
import type { PreparedImage } from "@/lib/image-lifecycle";
import {
  syntheticAnalysisResponses,
  type MockAnalysis,
} from "@/lib/mock-analysis";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("motion/react")>();
  const React = await import("react");
  const MotionParagraph = React.forwardRef<
    HTMLParagraphElement,
    React.ComponentProps<"p"> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }
  >(({ initial, animate, exit, transition, ...props }, ref) => {
    void initial;
    void animate;
    void exit;
    void transition;
    return <p ref={ref} {...props} />;
  });
  MotionParagraph.displayName = "MotionParagraph";
  return {
    ...original,
    AnimatePresence: ({ children }: React.PropsWithChildren) => children,
    motion: { ...original.motion, p: MotionParagraph },
    useReducedMotion: () => motionPreference.reduced,
  };
});

const preparedImage: PreparedImage = {
  blob: new Blob(["prepared"], { type: "image/jpeg" }),
  objectUrl: "blob:prepared",
  width: 1200,
  height: 900,
  mimeType: "image/jpeg",
  sizeBytes: 8,
};

const pendingAnalysis = () => {
  let resolve!: (response: AnalysisResponse) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<AnalysisResponse>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  const analyze = vi.fn(() => promise);
  return { analyze, resolve, reject };
};

const renderFlow = (analyze: MockAnalysis) => {
  const callbacks = {
    onSuccess: vi.fn(),
    onFailure: vi.fn(),
    onCancel: vi.fn(),
  };
  const result = render(
    <AnalysisFlow
      requestId="request-1"
      preparedImage={preparedImage}
      analyze={analyze}
      {...callbacks}
    />,
  );
  return { ...result, ...callbacks };
};

afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
  vi.useRealTimers();
});

describe("AnalysisFlow", () => {
  it("keeps the image primary, focuses the heading, and has no fake progress", () => {
    const pending = pendingAnalysis();
    renderFlow(pending.analyze);

    expect(
      screen.getByRole("img", { name: "Selected image being analyzed" }),
    ).toHaveAttribute("src", "blob:prepared");
    expect(screen.getByRole("heading", { name: "Looking closely" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Looking closely at the food",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows truthful staged messages and an honest slow state", async () => {
    vi.useFakeTimers();
    const pending = pendingAnalysis();
    renderFlow(pending.analyze);

    await act(() => vi.advanceTimersByTimeAsync(1_800));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Identifying relevant ingredients",
    );

    await act(() => vi.advanceTimersByTimeAsync(6_400));
    expect(screen.getByRole("status")).toHaveTextContent(
      "This is taking a little longer.",
    );
    expect(
      screen.getByText(/You can cancel and return to your photo/),
    ).toBeInTheDocument();
  });

  it("shows a completed response immediately and cleans message timers", async () => {
    vi.useFakeTimers();
    const pending = pendingAnalysis();
    const { onSuccess } = renderFlow(pending.analyze);

    await act(async () => {
      pending.resolve(syntheticAnalysisResponses.safe);
      await Promise.resolve();
    });

    expect(onSuccess).toHaveBeenCalledWith(
      "request-1",
      syntheticAnalysisResponses.safe,
    );
  });

  it("aborts pending work and reports cancellation with request identity", async () => {
    const user = userEvent.setup();
    let receivedSignal: AbortSignal | undefined;
    const analyze = vi.fn((signal: AbortSignal) => {
      receivedSignal = signal;
      return new Promise<AnalysisResponse>(() => undefined);
    });
    const { onCancel } = renderFlow(analyze);

    await user.click(screen.getByRole("button", { name: "Cancel analysis" }));

    expect(receivedSignal?.aborted).toBe(true);
    expect(onCancel).toHaveBeenCalledWith("request-1");
  });

  it("maps a mock failure without exposing its contents", async () => {
    const pending = pendingAnalysis();
    const { onFailure } = renderFlow(pending.analyze);
    const error = { code: "providerUnavailable", retryable: true } as const;

    await act(async () => {
      pending.reject(error);
      await Promise.resolve();
    });

    expect(onFailure).toHaveBeenCalledWith("request-1", error);
  });

  it("keeps one static message and schedules no message timers with reduced motion", async () => {
    vi.useFakeTimers();
    motionPreference.reduced = true;
    const pending = pendingAnalysis();
    renderFlow(pending.analyze);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Looking closely at the food",
    );
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Looking closely at the food",
    );
  });

  it("aborts pending work and clears timers on unmount", () => {
    vi.useFakeTimers();
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    let receivedSignal: AbortSignal | undefined;
    const analyze = vi.fn((signal: AbortSignal) => {
      receivedSignal = signal;
      return new Promise<AnalysisResponse>(() => undefined);
    });
    const { unmount } = renderFlow(analyze);

    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(5);
    unmount();

    expect(receivedSignal?.aborted).toBe(true);
    expect(clearTimeout).toHaveBeenCalledTimes(5);
  });
});
