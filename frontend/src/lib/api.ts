import type { ApiError, CropId, CropsResponse, Outcome, PredictResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const FALLBACK_CROPS: CropsResponse = {
  crops: [
    {
      id: "tomato",
      display_name: "Tomato",
    },
    {
      id: "maize",
      display_name: "Maize",
    },
  ],
};

export async function getCrops(): Promise<CropsResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${BASE_URL}/api/crops`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      return FALLBACK_CROPS;
    }
    const data = await res.json();
    return data;
  } catch {
    return FALLBACK_CROPS;
  } finally {
    clearTimeout(timer);
  }
}

export async function predict(
  image: File,
  crop: CropId,
  mock?: Outcome
): Promise<PredictResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  const formData = new FormData();
  formData.append("image", image);
  formData.append("crop", crop);

  // Check mock override: either explicitly passed mock arg, or env VITE_MOCK_OUTCOME (dev only)
  const effectiveMock = mock || (import.meta.env.DEV ? import.meta.env.VITE_MOCK_OUTCOME as Outcome | undefined : undefined);
  let url = `${BASE_URL}/api/predict`;
  if (effectiveMock && effectiveMock.trim() !== "") {
    url += `?mock=${encodeURIComponent(effectiveMock.trim())}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      let errPayload: ApiError;
      try {
        errPayload = await res.json();
      } catch {
        errPayload = {
          status: "error",
          code: `HTTP_${res.status}`,
          message: res.statusText || "Server error occurred.",
        };
      }
      throw errPayload;
    }

    const json: PredictResponse = await res.json();
    return json;
  } catch (err: any) {
    if (err && err.status === "error" && err.code) {
      // Already an ApiError thrown above
      throw err as ApiError;
    }

    // Network error, abort/timeout error, etc.
    const networkError: ApiError = {
      status: "error",
      code: "NETWORK",
      message: "Cannot reach the server. Check your connection.",
    };
    throw networkError;
  } finally {
    clearTimeout(timer);
  }
}
