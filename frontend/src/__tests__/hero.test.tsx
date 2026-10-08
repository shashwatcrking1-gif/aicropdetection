import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CropHero from "../components/crop-hero";
import App from "../App";

describe("CropHero and App Page Structure", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders CropHero with static gradient when VITE_ENABLE_HERO=false", () => {
    vi.stubEnv("VITE_ENABLE_HERO", "false");
    const { container } = render(<CropHero />);

    // Should find the radial-gradient container
    const gradientDiv = container.querySelector(
      "div[class*='radial-gradient']"
    );
    expect(gradientDiv).not.toBeNull();
    // Canvas should not be rendered
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeNull();
    // Copy should still be present
    expect(screen.getByText(/AI Crop-Disease Detector/i)).toBeDefined();
    expect(screen.getByText(/Catch the disease/i)).toBeDefined();
  });

  it("renders full App with Hero, Diagnose section, How it works cards, and Disclaimer", () => {
    // Stub VITE_ENABLE_HERO=false for jsdom environment without WebGL
    vi.stubEnv("VITE_ENABLE_HERO", "false");
    render(<App />);

    // 1. Hero
    expect(screen.getByText(/Catch the disease/i)).toBeDefined();

    // 2. Diagnose section
    const diagnoseSection = document.getElementById("diagnose");
    expect(diagnoseSection).not.toBeNull();
    expect(screen.getByText(/Inspect your leaf/i)).toBeDefined();
    expect(document.getElementById("crop-select")).not.toBeNull();
    expect(document.getElementById("dropzone")).not.toBeNull();
    expect(document.getElementById("analyze-btn")).not.toBeNull();

    // 3. How section
    const howSection = document.getElementById("how");
    expect(howSection).not.toBeNull();
    expect(screen.getAllByText(/How it works/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pick your crop/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Upload one leaf/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Get a remedy/i).length).toBeGreaterThanOrEqual(1);

    // 4. Footer disclaimer
    expect(
      screen.getByText(/Confirm with your local agriculture extension officer before spraying/i)
    ).toBeDefined();
  });
});
