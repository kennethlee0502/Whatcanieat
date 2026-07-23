import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResultFlow } from "@/app/app/result-flow";
import type { AnalysisResponse } from "@/domain/analysis";
import type { PreparedImage } from "@/lib/image-lifecycle";
import { syntheticAnalysisResponses } from "@/lib/mock-analysis";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("motion/react")>();
  const React = await import("react");
  const MotionMain = React.forwardRef<
    HTMLElement,
    React.ComponentProps<"main"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }
  >(({ initial, animate, transition, ...props }, ref) => {
    void animate;
    void transition;
    return (
      <main
        ref={ref}
        data-motion-initial={initial === false ? "false" : "animated"}
        {...props}
      />
    );
  });
  MotionMain.displayName = "MotionMain";
  return {
    ...original,
    motion: { ...original.motion, main: MotionMain },
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

const renderResult = (
  response: AnalysisResponse,
  onNewScan = vi.fn(),
  onClarificationRequested = vi.fn(),
  presentation?: "clarificationRevision",
) => {
  const result = render(
    <ResultFlow
      preparedImage={preparedImage}
      facts={response.facts}
      evaluation={response.evaluation}
      onNewScan={onNewScan}
      onClarificationRequested={onClarificationRequested}
      presentation={presentation}
    />,
  );
  return { ...result, onNewScan, onClarificationRequested };
};

afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

describe("ResultFlow", () => {
  it("preserves the required evidence-first section order and image continuity", () => {
    renderResult(syntheticAnalysisResponses.safe);

    expect(
      screen.getByRole("img", { name: "Selected food image" }),
    ).toHaveAttribute("src", "blob:prepared");
    expect(
      screen.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual([
      "What we saw",
      "What we know",
      "What we don’t know",
      "Recommendation",
      "What to do next",
    ]);
  });

  it.each([
    ["safe", "Safe"],
    ["safeWithCaution", "Safe with caution"],
    ["avoid", "Avoid"],
    ["needMoreInformation", "Need more information"],
  ] as const)("presents %s in words and announces the result", (key, label) => {
    renderResult(syntheticAnalysisResponses[key]);

    const recommendation = screen
      .getByRole("heading", { name: "Recommendation" })
      .closest("section");

    expect(recommendation).not.toBeNull();
    expect(within(recommendation!).getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      `Result ready. ${label}.`,
    );
  });

  it("communicates extraction and recommendation confidence separately", () => {
    renderResult(syntheticAnalysisResponses.safeWithCaution);

    expect(screen.getByText(/^Extraction confidence:/)).toHaveTextContent(
      "Extraction confidence: High",
    );
    expect(
      screen.getByText(/^Recommendation confidence:/),
    ).toHaveTextContent("Recommendation confidence: High");
    expect(screen.queryByText(/Image-analysis confidence/i)).not.toBeInTheDocument();
  });

  it("keeps the highest-priority Avoid evidence visible with plain provenance", () => {
    renderResult(syntheticAnalysisResponses.avoid);

    const whatWeKnow = screen
      .getByRole("heading", { name: "What we know" })
      .closest("section");

    expect(whatWeKnow).not.toBeNull();
    expect(
      within(whatWeKnow!).getByText(
        "The readable ingredient label lists peanut.",
      ),
    ).toBeVisible();
    expect(within(whatWeKnow!).getByText("Readable on label")).toBeVisible();
    expect(within(whatWeKnow!).getByText("Confirmed")).toBeVisible();
    expect(within(whatWeKnow!).getByText("Food allergy")).toBeVisible();
    expect(within(whatWeKnow!).getByText("Avoid")).toBeVisible();
    expect(whatWeKnow).not.toHaveTextContent(/allergy-confirmed|ruleSetVersion/);
  });

  it("progressively discloses additional supporting evidence", () => {
    const base = syntheticAnalysisResponses.avoid;
    const additionalEvidence = {
      id: "mock-peanut-visible",
      source: "conventionalInference",
      strength: "likely",
      summary: "A conventional recipe may include peanut pieces.",
    } as const;
    const response: AnalysisResponse = {
      ...base,
      facts: {
        ...base.facts,
        evidence: [...base.facts.evidence, additionalEvidence],
      },
      evaluation: {
        ...base.evaluation,
        evidence: [...base.evaluation.evidence, additionalEvidence],
        reasons: base.evaluation.reasons.map((reason, index) =>
          index === 0
            ? {
                ...reason,
                evidenceIds: [...reason.evidenceIds, additionalEvidence.id],
              }
            : reason,
        ),
      },
    };
    renderResult(response);

    expect(
      screen.getAllByText("The readable ingredient label lists peanut.")[0],
    ).toBeVisible();
    const disclosure = screen.getByText("More supporting evidence");
    expect(disclosure).toBeVisible();
    expect(
      screen.getByText("A conventional recipe may include peanut pieces."),
    ).not.toBeVisible();
  });

  it("keeps unresolved evidence source and strength explicit", () => {
    const base = syntheticAnalysisResponses.needMoreInformation;
    const response: AnalysisResponse = {
      ...base,
      evaluation: {
        ...base.evaluation,
        reasons: base.evaluation.reasons.map((reason, index) =>
          index === 0 ? { ...reason, evidenceIds: [] } : reason,
        ),
      },
    };
    renderResult(response);

    const whatWeKnow = screen
      .getByRole("heading", { name: "What we know" })
      .closest("section");
    expect(whatWeKnow).not.toBeNull();
    expect(whatWeKnow).toHaveTextContent(
      "No supporting observation was confirmed.",
    );
    expect(whatWeKnow).toHaveTextContent("Not available");
    expect(whatWeKnow).toHaveTextContent("Unknown");
  });

  it("keeps consequential uncertainty and clarification copy visible without answer controls", () => {
    const response = syntheticAnalysisResponses.needMoreInformation;
    renderResult(response);

    const unknownSection = screen
      .getByRole("heading", { name: "What we don’t know" })
      .closest("section");
    const clarification = response.evaluation.clarificationQuestions[0];

    expect(unknownSection).not.toBeNull();
    expect(unknownSection).toHaveTextContent(
      "The complete ingredient list is not visible.",
    );
    expect(unknownSection).toHaveTextContent("One useful detail to check");
    expect(unknownSection).toHaveTextContent(clarification.prompt);
    expect(unknownSection).toHaveTextContent(clarification.whyItMatters);
    for (const answer of clarification.answerOptions) {
      expect(
        screen.queryByRole("button", { name: answer.label }),
      ).not.toBeInTheDocument();
    }
  });

  it("requests the exact engine-selected clarification question", async () => {
    const user = userEvent.setup();
    const response = syntheticAnalysisResponses.needMoreInformation;
    const selected = response.evaluation.clarificationQuestions[0];
    const { onClarificationRequested } = renderResult(response);

    await user.click(
      screen.getByRole("button", { name: "Answer one question" }),
    );

    expect(onClarificationRequested).toHaveBeenCalledOnce();
    expect(onClarificationRequested).toHaveBeenCalledWith(selected.id);
  });

  it("announces a clarification revision and restores result focus", () => {
    renderResult(
      syntheticAnalysisResponses.avoid,
      vi.fn(),
      vi.fn(),
      "clarificationRevision",
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Result updated. Avoid.",
    );
    expect(screen.getByRole("heading", { name: "What we saw" })).toHaveFocus();
  });

  it("shows the no-consequential-unknowns statement for a resolved result", () => {
    renderResult(syntheticAnalysisResponses.safe);

    expect(
      screen.getByText(
        "No consequential unknowns were identified for the supported checks.",
      ),
    ).toBeInTheDocument();
  });

  it("preserves reason order, next action, and supported scope", () => {
    const response = syntheticAnalysisResponses.avoid;
    renderResult(response);

    const recommendation = screen
      .getByRole("heading", { name: "Recommendation" })
      .closest("section");
    expect(recommendation).not.toBeNull();
    expect(
      within(recommendation!).getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(response.evaluation.reasons.map(({ summary }) => summary));
    expect(recommendation).toHaveTextContent(response.evaluation.nextAction);
    expect(recommendation).toHaveTextContent(
      response.evaluation.supportedScopeStatement,
    );
    expect(response.evaluation.reasons.length).toBeLessThanOrEqual(3);
  });

  it("focuses the first result heading and offers one new-scan action", async () => {
    const user = userEvent.setup();
    const { onNewScan } = renderResult(syntheticAnalysisResponses.safe);

    expect(
      screen.getByRole("heading", { name: "What we saw" }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Check another food" }),
    );
    expect(onNewScan).toHaveBeenCalledOnce();
  });

  it("renders the complete result statically under reduced motion", () => {
    motionPreference.reduced = true;
    renderResult(syntheticAnalysisResponses.needMoreInformation);

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-motion-initial",
      "false",
    );
    expect(
      screen.getByRole("heading", { name: "Recommendation" }),
    ).toBeInTheDocument();
  });

  it("does not expose AI wording or make network requests", () => {
    const fetchRequest = vi.fn();
    vi.stubGlobal("fetch", fetchRequest);
    const { container } = renderResult(syntheticAnalysisResponses.avoid);

    expect(container).not.toHaveTextContent(
      /\bAI\b|OpenAI|model reasoning|guaranteed|100% safe/i,
    );
    expect(fetchRequest).not.toHaveBeenCalled();
  });
});
