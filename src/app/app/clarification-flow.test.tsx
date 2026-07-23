import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClarificationFlow } from "@/app/app/clarification-flow";
import { syntheticAnalysisResponses } from "@/lib/mock-analysis";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("motion/react")>();
  const React = await import("react");
  const MotionSection = React.forwardRef<
    HTMLElement,
    React.ComponentProps<"section"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }
  >(({ initial, animate, transition, ...props }, ref) => {
    void animate;
    void transition;
    return (
      <section
        ref={ref}
        data-motion-initial={initial === false ? "false" : "animated"}
        {...props}
      />
    );
  });
  MotionSection.displayName = "MotionSection";
  return {
    ...original,
    motion: { ...original.motion, section: MotionSection },
    useReducedMotion: () => motionPreference.reduced,
  };
});

const question =
  syntheticAnalysisResponses.needMoreInformation.evaluation
    .clarificationQuestions[0];

afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
  vi.unstubAllGlobals();
});

describe("ClarificationFlow", () => {
  it("renders only the engine-selected question and constrained answers", () => {
    render(
      <ClarificationFlow
        question={question}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName(question.prompt);
    expect(screen.getByRole("heading", { name: question.prompt })).toHaveFocus();
    expect(screen.getAllByRole("radio")).toHaveLength(
      question.answerOptions.length,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("submits only a selected option belonging to the question", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockReturnValue(true);
    render(
      <ClarificationFlow
        question={question}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Update recommendation" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose one answer before updating the recommendation.",
    );
    expect(onSubmit).not.toHaveBeenCalled();

    const option = question.answerOptions[0];
    await user.click(screen.getByRole("radio", { name: option.label }));
    await user.click(
      screen.getByRole("button", { name: "Update recommendation" }),
    );
    expect(onSubmit).toHaveBeenCalledWith(option.id);
  });

  it("keeps the dialog open and reports a rejected answer safely", async () => {
    const user = userEvent.setup();
    render(
      <ClarificationFlow
        question={question}
        onSubmit={() => false}
        onCancel={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("radio", {
        name: question.answerOptions[0].label,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Update recommendation" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your result has not changed.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("supports explicit cancel and Escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ClarificationFlow
        question={question}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("keeps keyboard focus within the clarification dialog", async () => {
    const user = userEvent.setup();
    render(
      <ClarificationFlow
        question={question}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.tab();
    expect(screen.getAllByRole("radio")[0]).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getAllByRole("radio")[0]).toHaveFocus();
  });

  it("renders statically under reduced motion and never fetches", () => {
    motionPreference.reduced = true;
    const fetchRequest = vi.fn();
    vi.stubGlobal("fetch", fetchRequest);

    render(
      <ClarificationFlow
        question={question}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-motion-initial",
      "false",
    );
    expect(fetchRequest).not.toHaveBeenCalled();
  });
});
