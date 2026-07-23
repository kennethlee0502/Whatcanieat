import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClearAllControl } from "@/app/app/clear-all-control";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("motion/react")>();
  const React = await import("react");
  const MotionDiv = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }
  >(({ initial, animate, transition, ...props }, ref) => {
    void animate;
    void transition;
    return (
      <div
        ref={ref}
        data-motion-initial={initial === false ? "false" : "animated"}
        {...props}
      />
    );
  });
  MotionDiv.displayName = "MotionDiv";
  return {
    ...original,
    motion: { ...original.motion, div: MotionDiv },
    useReducedMotion: () => motionPreference.reduced,
  };
});

afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
  document.body.style.overflow = "";
});

describe("ClearAllControl", () => {
  it("opens a modal confirmation with initial focus on Cancel", async () => {
    const user = userEvent.setup();
    render(<ClearAllControl onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Clear temporary data?",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("cancels without clearing and restores trigger focus", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ClearAllControl onConfirm={onConfirm} />);

    const trigger = screen.getByRole("button", { name: "Clear all" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it("supports Escape and contains keyboard focus", async () => {
    const user = userEvent.setup();
    render(<ClearAllControl onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getAllByRole("button", { name: "Clear all" })[1];

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms exactly once", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ClearAllControl onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await user.click(screen.getAllByRole("button", { name: "Clear all" })[1]);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("removes spatial motion under reduced motion", async () => {
    motionPreference.reduced = true;
    const user = userEvent.setup();
    render(<ClearAllControl onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-motion-initial",
      "false",
    );
  });
});
