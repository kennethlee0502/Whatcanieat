import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("project test foundation", () => {
  it("renders accessible React content in jsdom", () => {
    render(<button type="button">Foundation ready</button>);

    expect(
      screen.getByRole("button", { name: "Foundation ready" }),
    ).toBeInTheDocument();
  });
});
