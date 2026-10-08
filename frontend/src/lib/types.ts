export type CropId = "tomato" | "maize";
export type Outcome = "disease" | "healthy" | "low_confidence" | "crop_mismatch";

export interface Advice {
  disease_name: string;
  causal_agent: string;
  severity: "low" | "moderate" | "high";
  symptoms: string[];
  organic_remedy: string;
  chemical_remedy: string;
  prevention: string[];
}

export interface Candidate {
  class_id: string;
  display_name: string;
  confidence: number;
}

export interface PredictResponse {
  status: "ok";
  outcome: Outcome;
  crop: CropId;
  detected_crop: CropId | null;
  prediction: (Candidate & { is_healthy: boolean }) | null;
  top_k: Candidate[];
  advice: Advice | null;
  message: string;
  latency_ms: number;
  model_version: string;
}

export interface ApiError {
  status: "error";
  code: string;
  message: string;
}

export interface CropInfo {
  id: CropId;
  display_name: string;
  classes?: Array<{
    class_id: string;
    display_name: string;
    is_healthy: boolean;
  }>;
}

export interface CropsResponse {
  crops: CropInfo[];
}
