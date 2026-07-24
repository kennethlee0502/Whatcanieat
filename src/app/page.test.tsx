import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Instrument_Serif: () => ({ variable: "--font-instrument-serif" }),
}));

import { metadata } from "@/app/layout";
import Home from "@/app/page";

afterEach(cleanup);

describe("public landing page", () => {
  it("introduces the product, supported scope, uncertainty, and limitation", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "A clearer way to check food against your needs.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pregnancy, food allergies, high blood pressure, vegetarian, and vegan needs.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/what the image cannot confirm/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/decision support, not medical advice or a guarantee/i),
    ).toBeInTheDocument();
  });

  it("provides one dominant application entry and simple information links", () => {
    render(<Home />);

    const applicationLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/app",
    );

    expect(applicationLinks).toHaveLength(1);
    expect(applicationLinks[0]).toHaveAccessibleName("Check a food");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/build",
    );
  });

  it("contains no framework starter links or verdict enumeration copy", () => {
    render(<Home />);

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs.every((href) => href?.startsWith("/"))).toBe(true);
    expect(screen.queryByText(/next\.js|vercel|deploy now/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/safe with caution|need more information/i),
    ).not.toBeInTheDocument();
  });

  it("exports accurate site metadata", () => {
    expect(metadata.title).toBe("Can / I Eat This?");
    expect(metadata.description).toBe(
      "Transparent, evidence-based food decision support for selected dietary restrictions.",
    );
  });
});
