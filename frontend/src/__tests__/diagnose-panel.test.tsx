import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagnosePanel } from "../components/diagnose-panel";
import * as api from "../lib/api";
import type { PredictResponse } from "../lib/types";

// Mock URL.createObjectURL and revokeObjectURL
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/test-uuid");
  global.URL.revokeObjectURL = vi.fn();
  vi.restoreAllMocks();
});

describe("DiagnosePanel State Machine & UI", () => {
  it("renders with required initial IDs and disabled diagnose button", () => {
    render(<DiagnosePanel />);

    expect(document.getElementById("crop-select")).toBeDefined();
    expect(document.getElementById("dropzone")).toBeDefined();
    expect(document.getElementById("file-input")).toBeDefined();
    expect(document.getElementById("analyze-btn")).toBeDefined();

    const analyzeBtn = document.getElementById("analyze-btn") as HTMLButtonElement;
    expect(analyzeBtn.disabled).toBe(true);
  });

  it("client-side validation: rejects .gif file without network call", async () => {
    const predictSpy = vi.spyOn(api, "predict");
    render(<DiagnosePanel />);

    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    const gifFile = new File(["dummy data"], "leaf.gif", { type: "image/gif" });

    fireEvent.change(fileInput, { target: { files: [gifFile] } });

    expect(await screen.findByText(/Invalid file type/i)).toBeDefined();
    expect(predictSpy).not.toHaveBeenCalled();
    expect(document.getElementById("preview")).toBeNull();
  });

  it("client-side validation: rejects .pdf file without network call", async () => {
    const predictSpy = vi.spyOn(api, "predict");
    render(<DiagnosePanel />);

    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    const pdfFile = new File(["dummy pdf"], "leaf.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(await screen.findByText(/Invalid file type/i)).toBeDefined();
    expect(predictSpy).not.toHaveBeenCalled();
  });

  it("client-side validation: rejects 6 MB file without network call", async () => {
    const predictSpy = vi.spyOn(api, "predict");
    render(<DiagnosePanel />);

    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    // 6 MB buffer
    const largeContent = new Uint8Array(6 * 1024 * 1024);
    const largeFile = new File([largeContent], "leaf.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(await screen.findByText(/File is too large/i)).toBeDefined();
    expect(predictSpy).not.toHaveBeenCalled();
  });

  it("handles preview and enables diagnose button when crop and valid file are chosen", async () => {
    const user = userEvent.setup();
    render(<DiagnosePanel />);

    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    const validFile = new File(["valid image"], "leaf.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Preview image is now visible
    const previewImg = document.getElementById("preview") as HTMLImageElement;
    expect(previewImg).toBeDefined();
    expect(previewImg.getAttribute("alt")).toBe("Selected leaf photo");

    // Select crop
    const tomatoBtn = screen.getByRole("button", { name: /tomato/i });
    await user.click(tomatoBtn);

    const analyzeBtn = document.getElementById("analyze-btn") as HTMLButtonElement;
    expect(analyzeBtn.disabled).toBe(false);
  });

  it("renders outcome 'disease' with severity, confidence, remedies, and also possible", async () => {
    const diseaseResponse: PredictResponse = {
      status: "ok",
      outcome: "disease",
      crop: "tomato",
      detected_crop: null,
      prediction: {
        class_id: "tomato_early_blight",
        display_name: "Early Blight",
        confidence: 0.93,
        is_healthy: false,
      },
      top_k: [
        { class_id: "tomato_early_blight", display_name: "Early Blight", confidence: 0.93 },
        { class_id: "tomato_late_blight", display_name: "Late Blight", confidence: 0.05 },
      ],
      advice: {
        disease_name: "Early Blight",
        causal_agent: "Alternaria solani (fungus)",
        severity: "moderate",
        symptoms: ["Brown spots with ring-like marks", "Yellowing around spots"],
        organic_remedy: "Remove infected lower leaves; spray neem oil.",
        chemical_remedy: "Chlorothalonil or mancozeb; follow label dose.",
        prevention: ["Rotate crops every season", "Water at the base"],
      },
      message: "Likely Early Blight on your tomato leaf.",
      latency_ms: 142,
      model_version: "mnv2-v1",
    };

    vi.spyOn(api, "predict").mockResolvedValue(diseaseResponse);

    const user = userEvent.setup();
    render(<DiagnosePanel />);

    // Select crop & file
    await user.click(screen.getByRole("button", { name: /tomato/i }));
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(["valid"], "leaf.jpg", { type: "image/jpeg" })] },
    });

    // Click Diagnose
    const analyzeBtn = document.getElementById("analyze-btn")!;
    await user.click(analyzeBtn);

    // Verify disease elements
    expect(await screen.findByText("Early Blight")).toBeDefined();
    expect(screen.getByText(/Alternaria solani/i)).toBeDefined();
    expect(screen.getByText(/93% confident/i)).toBeDefined();
    expect(screen.getByText(/Moderate Severity/i)).toBeDefined();
    expect(screen.getByText("Symptoms")).toBeDefined();
    expect(screen.getByText(/Brown spots with ring-like marks/i)).toBeDefined();
    expect(screen.getByText("Organic Remedy")).toBeDefined();
    expect(screen.getByText(/Remove infected lower leaves/i)).toBeDefined();
    expect(screen.getByText("Chemical Remedy")).toBeDefined();
    expect(screen.getByText(/Generic active ingredient/i)).toBeDefined();
    expect(screen.getByText("Prevention")).toBeDefined();
    expect(screen.getByText(/Rotate crops every season/i)).toBeDefined();
    expect(screen.getByText(/Also possible:/i)).toBeDefined();
    expect(screen.getByText(/Late Blight \(5%\)/i)).toBeDefined();
    expect(screen.getByText(/Diagnosed in 142 ms/i)).toBeDefined();
  });

  it("renders outcome 'healthy' with CheckCircle2 and care tips", async () => {
    const healthyResponse: PredictResponse = {
      status: "ok",
      outcome: "healthy",
      crop: "tomato",
      detected_crop: null,
      prediction: {
        class_id: "tomato_healthy",
        display_name: "Healthy",
        confidence: 0.95,
        is_healthy: true,
      },
      top_k: [{ class_id: "tomato_healthy", display_name: "Healthy", confidence: 0.95 }],
      advice: {
        disease_name: "Healthy",
        causal_agent: "None",
        severity: "low",
        symptoms: [],
        organic_remedy: "Keep watering regularly and inspect weekly.",
        chemical_remedy: "None needed.",
        prevention: ["Maintain good airflow and drainage."],
      },
      message: "Your tomato leaf looks healthy.",
      latency_ms: 110,
      model_version: "mnv2-v1",
    };

    vi.spyOn(api, "predict").mockResolvedValue(healthyResponse);

    const user = userEvent.setup();
    render(<DiagnosePanel />);

    await user.click(screen.getByRole("button", { name: /tomato/i }));
    fireEvent.change(document.getElementById("file-input")!, {
      target: { files: [new File(["valid"], "leaf.jpg", { type: "image/jpeg" })] },
    });

    await user.click(document.getElementById("analyze-btn")!);

    expect(await screen.findByText(/Plant Appears Healthy/i)).toBeDefined();
    expect(screen.getByText("Your tomato leaf looks healthy.")).toBeDefined();
    expect(screen.getByText(/Keep watering regularly/i)).toBeDefined();
  });

  it("renders outcome 'low_confidence' with photo tips and retake button", async () => {
    const lowConfResponse: PredictResponse = {
      status: "ok",
      outcome: "low_confidence",
      crop: "tomato",
      detected_crop: null,
      prediction: null,
      top_k: [
        { class_id: "tomato_early_blight", display_name: "Early Blight", confidence: 0.35 },
        { class_id: "tomato_late_blight", display_name: "Late Blight", confidence: 0.3 },
      ],
      advice: null,
      message:
        "No clear disease detected. Retake the photo in daylight with the leaf flat and filling most of the frame.",
      latency_ms: 95,
      model_version: "mnv2-v1",
    };

    vi.spyOn(api, "predict").mockResolvedValue(lowConfResponse);

    const user = userEvent.setup();
    render(<DiagnosePanel />);

    await user.click(screen.getByRole("button", { name: /tomato/i }));
    fireEvent.change(document.getElementById("file-input")!, {
      target: { files: [new File(["valid"], "leaf.jpg", { type: "image/jpeg" })] },
    });

    await user.click(document.getElementById("analyze-btn")!);

    expect(await screen.findByText(/Uncertain Classification/i)).toBeDefined();
    expect(screen.getByText(/Photo tips:/i)).toBeDefined();

    // Clicking "Retake photo" keeps selected crop
    const retakeBtn = screen.getByRole("button", { name: /retake photo/i });
    await user.click(retakeBtn);

    // Check crop is still selected
    const tomatoBtn = screen.getByRole("button", { name: /tomato/i });
    expect(tomatoBtn.getAttribute("data-state")).toBe("on");
    // Dropzone is back
    expect(document.getElementById("dropzone")).toBeDefined();
  });

  it("renders outcome 'crop_mismatch' with switch button and re-submits", async () => {
    const mismatchResponse: PredictResponse = {
      status: "ok",
      outcome: "crop_mismatch",
      crop: "tomato",
      detected_crop: "maize",
      prediction: null,
      top_k: [],
      advice: null,
      message: "This looks like a maize leaf, not tomato. Check your crop selection or retake the photo.",
      latency_ms: 90,
      model_version: "mnv2-v1",
    };

    const predictSpy = vi.spyOn(api, "predict").mockResolvedValue(mismatchResponse);

    const user = userEvent.setup();
    render(<DiagnosePanel />);

    await user.click(screen.getByRole("button", { name: /tomato/i }));
    const leafFile = new File(["valid"], "leaf.jpg", { type: "image/jpeg" });
    fireEvent.change(document.getElementById("file-input")!, {
      target: { files: [leafFile] },
    });

    await user.click(document.getElementById("analyze-btn")!);

    expect(await screen.findByText(/Crop Mismatch Detected/i)).toBeDefined();
    const switchBtn = screen.getByRole("button", { name: /switch to maize/i });
    expect(switchBtn).toBeDefined();

    // Click switch button
    await user.click(switchBtn);

    // Should call predict again with maize and same file
    expect(predictSpy).toHaveBeenCalledTimes(2);
    expect(predictSpy).toHaveBeenLastCalledWith(leafFile, "maize");
  });

  it("shows error state with mapped message and Try again button", async () => {
    vi.spyOn(api, "predict").mockRejectedValue({
      status: "error",
      code: "NETWORK",
      message: "Cannot reach the server. Check your connection.",
    });

    const user = userEvent.setup();
    render(<DiagnosePanel />);

    await user.click(screen.getByRole("button", { name: /tomato/i }));
    fireEvent.change(document.getElementById("file-input")!, {
      target: { files: [new File(["valid"], "leaf.jpg", { type: "image/jpeg" })] },
    });

    await user.click(document.getElementById("analyze-btn")!);

    expect(await screen.findByText(/Diagnosis Failed/i)).toBeDefined();
    expect(screen.getByText(/Cannot reach the server/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
  });
});
