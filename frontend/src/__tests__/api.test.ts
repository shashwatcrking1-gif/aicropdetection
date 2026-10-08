import { describe, it, expect, vi, beforeEach } from "vitest";
import { predict, getCrops } from "../lib/api";
import type { PredictResponse } from "../lib/types";

describe("API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("predict sends multipart FormData with image and crop", async () => {
    const mockResponse: PredictResponse = {
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
        symptoms: ["Brown spots with ring-like marks"],
        organic_remedy: "Remove infected leaves.",
        chemical_remedy: "Chlorothalonil.",
        prevention: ["Crop rotation"],
      },
      message: "Likely Early Blight on your tomato leaf.",
      latency_ms: 120,
      model_version: "mnv2-v1",
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    global.fetch = fetchMock;

    const dummyFile = new File(["test content"], "leaf.jpg", { type: "image/jpeg" });
    const result = await predict(dummyFile, "tomato");

    expect(result).toEqual(mockResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callArgs = fetchMock.mock.calls[0];
    const url = callArgs[0] as string;
    const options = callArgs[1] as RequestInit;

    expect(url).toContain("/api/predict");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);

    const formData = options.body as FormData;
    expect(formData.get("crop")).toBe("tomato");
    expect(formData.get("image")).toBe(dummyFile);
  });

  it("predict appends ?mock= when mock argument or env is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });
    global.fetch = fetchMock;

    const dummyFile = new File(["test"], "leaf.jpg", { type: "image/jpeg" });
    await predict(dummyFile, "maize", "low_confidence");

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("?mock=low_confidence");
  });

  it("throws parsed ApiError on non-2xx HTTP status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          status: "error",
          code: "IMAGE_TOO_SMALL",
          message: "Image must be at least 64x64 pixels.",
        }),
    });
    global.fetch = fetchMock;

    const dummyFile = new File(["test"], "leaf.jpg", { type: "image/jpeg" });
    await expect(predict(dummyFile, "tomato")).rejects.toEqual({
      status: "error",
      code: "IMAGE_TOO_SMALL",
      message: "Image must be at least 64x64 pixels.",
    });
  });

  it("throws NETWORK error on connection failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    global.fetch = fetchMock;

    const dummyFile = new File(["test"], "leaf.jpg", { type: "image/jpeg" });
    await expect(predict(dummyFile, "tomato")).rejects.toEqual({
      status: "error",
      code: "NETWORK",
      message: "Cannot reach the server. Check your connection.",
    });
  });

  it("getCrops returns fallback crops when server is down", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    global.fetch = fetchMock;

    const crops = await getCrops();
    expect(crops.crops).toHaveLength(2);
    expect(crops.crops[0].id).toBe("tomato");
    expect(crops.crops[1].id).toBe("maize");
  });
});
