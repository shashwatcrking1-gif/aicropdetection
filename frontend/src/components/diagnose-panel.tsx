"use client";

import React, { useReducer, useEffect, useRef } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  FlaskConical,
  Leaf,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UploadCloud,
  Wheat,
} from "lucide-react";

import type { ApiError, CropId, PredictResponse } from "@/lib/types";
import { predict } from "@/lib/api";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Maximum upload file size (5 MB)
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Map backend error codes to user-friendly messages
function getFriendlyErrorMessage(code: string, rawMessage?: string): string {
  switch (code) {
    case "NO_FILE":
      return "No leaf photo was detected. Please choose or capture an image.";
    case "BAD_FILE_TYPE":
      return "Only JPG, PNG, and WebP images are supported.";
    case "CORRUPT_IMAGE":
      return "The photo appears corrupted or cannot be read. Please take a new photo.";
    case "IMAGE_TOO_SMALL":
      return "The image is too small (minimum 64×64 pixels). Please capture a closer photo.";
    case "FILE_TOO_LARGE":
      return "The photo exceeds 5 MB. Please choose a smaller photo.";
    case "INVALID_CROP":
      return "Please select either Tomato or Maize.";
    case "MODEL_NOT_LOADED":
      return "The diagnostic AI model is currently offline. Please try again in a moment.";
    case "NETWORK":
      return "Cannot reach the server. Check your connection.";
    default:
      return rawMessage || "Something went wrong. Please try again.";
  }
}

// -------------------------------------------------------------
// State Machine Types & Reducer
// -------------------------------------------------------------

export type PanelStatus = "idle" | "preview" | "loading" | "result" | "error";

export interface PanelState {
  status: PanelStatus;
  crop: CropId | null;
  file: File | null;
  previewUrl: string | null;
  validationError: string | null;
  result: PredictResponse | null;
  error: ApiError | null;
}

export type PanelAction =
  | { type: "SELECT_CROP"; crop: CropId }
  | { type: "SELECT_FILE_SUCCESS"; file: File; previewUrl: string }
  | { type: "SELECT_FILE_ERROR"; message: string }
  | { type: "REMOVE_IMAGE" }
  | { type: "START_LOADING" }
  | { type: "SET_RESULT"; result: PredictResponse }
  | { type: "SET_ERROR"; error: ApiError }
  | { type: "RETAKE_PHOTO" }
  | { type: "SWITCH_CROP_AND_RETRY"; newCrop: CropId }
  | { type: "RESET" };

const initialState: PanelState = {
  status: "idle",
  crop: null,
  file: null,
  previewUrl: null,
  validationError: null,
  result: null,
  error: null,
};

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "SELECT_CROP":
      return {
        ...state,
        crop: action.crop,
        validationError: null,
      };

    case "SELECT_FILE_SUCCESS":
      return {
        ...state,
        file: action.file,
        previewUrl: action.previewUrl,
        validationError: null,
        status: "preview",
        result: null,
        error: null,
      };

    case "SELECT_FILE_ERROR":
      return {
        ...state,
        validationError: action.message,
      };

    case "REMOVE_IMAGE":
      return {
        ...state,
        file: null,
        previewUrl: null,
        validationError: null,
        status: "idle",
        result: null,
        error: null,
      };

    case "START_LOADING":
      return {
        ...state,
        status: "loading",
        validationError: null,
        error: null,
      };

    case "SET_RESULT":
      return {
        ...state,
        status: "result",
        result: action.result,
        error: null,
      };

    case "SET_ERROR":
      return {
        ...state,
        status: "error",
        error: action.error,
      };

    case "RETAKE_PHOTO":
      return {
        ...state,
        file: null,
        previewUrl: null,
        validationError: null,
        result: null,
        error: null,
        status: "idle",
      };

    case "SWITCH_CROP_AND_RETRY":
      return {
        ...state,
        crop: action.newCrop,
        status: "loading",
        error: null,
        result: null,
      };

    case "RESET":
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

// -------------------------------------------------------------
// DiagnosePanel Component
// -------------------------------------------------------------

export function DiagnosePanel() {
  const [state, dispatch] = useReducer(panelReducer, initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Revoke ObjectURL to prevent memory leaks
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    previewUrlRef.current = state.previewUrl;
  }, [state.previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleClearPreview = () => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    dispatch({ type: "REMOVE_IMAGE" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFullReset = () => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    dispatch({ type: "RESET" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRetakePhoto = () => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    dispatch({ type: "RETAKE_PHOTO" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Client-side file validation
  const validateAndSelectFile = (file: File) => {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isExtensionOk = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeOk = ALLOWED_MIME_TYPES.includes(file.type);

    if (!isExtensionOk && !isMimeOk) {
      dispatch({
        type: "SELECT_FILE_ERROR",
        message: "Invalid file type. Please upload a JPG, PNG, or WebP image.",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      dispatch({
        type: "SELECT_FILE_ERROR",
        message: "File is too large. Image must be 5 MB or smaller.",
      });
      return;
    }

    // Revoke previous URL if any
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    dispatch({
      type: "SELECT_FILE_SUCCESS",
      file,
      previewUrl: objectUrl,
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (state.status === "loading") return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (state.status !== "loading") {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Perform Diagnose API call
  const runDiagnose = async (fileToDiagnose: File, cropToDiagnose: CropId) => {
    dispatch({ type: "START_LOADING" });
    try {
      const response = await predict(fileToDiagnose, cropToDiagnose);
      dispatch({ type: "SET_RESULT", result: response });
    } catch (err: any) {
      const apiErr: ApiError =
        err?.status === "error"
          ? err
          : {
              status: "error",
              code: "INTERNAL",
              message: err?.message || "Something went wrong. Please try again.",
            };
      dispatch({ type: "SET_ERROR", error: apiErr });
    }
  };

  const handleDiagnoseClick = () => {
    if (!state.crop || !state.file) return;
    runDiagnose(state.file, state.crop);
  };

  const handleSwitchCropAndRetry = (detectedCrop: CropId) => {
    if (!state.file) return;
    dispatch({ type: "SWITCH_CROP_AND_RETRY", newCrop: detectedCrop });
    runDiagnose(state.file, detectedCrop);
  };

  const isLoading = state.status === "loading";
  const isDiagnoseDisabled = !state.crop || !state.file || isLoading;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* 2-column layout on md+ screen, 1 column on mobile */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Left Column: Crop selection, Dropzone, Preview */}
        <div className="flex flex-col gap-6">
          {/* Section 1: Crop Select */}
          <div className="flex flex-col gap-2.5">
            <label className="text-sm font-medium text-zinc-300">
              1. Select crop <span className="text-amber-400">*</span>
            </label>
            <ToggleGroup
              id="crop-select"
              type="single"
              value={state.crop ?? ""}
              onValueChange={(val: string) => {
                if (val === "tomato" || val === "maize") {
                  dispatch({ type: "SELECT_CROP", crop: val as CropId });
                }
              }}
              className="grid w-full grid-cols-2 gap-3"
            >
              <ToggleGroupItem
                value="tomato"
                disabled={isLoading}
                className="flex h-14 min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 text-base font-medium text-zinc-200 transition-all hover:border-amber-400/40 hover:bg-zinc-800 data-[state=on]:border-amber-400 data-[state=on]:bg-amber-400/10 data-[state=on]:text-amber-400 disabled:opacity-50"
              >
                <Leaf className="h-5 w-5 text-amber-400" />
                Tomato
              </ToggleGroupItem>
              <ToggleGroupItem
                value="maize"
                disabled={isLoading}
                className="flex h-14 min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 text-base font-medium text-zinc-200 transition-all hover:border-amber-400/40 hover:bg-zinc-800 data-[state=on]:border-amber-400 data-[state=on]:bg-amber-400/10 data-[state=on]:text-amber-400 disabled:opacity-50"
              >
                <Wheat className="h-5 w-5 text-amber-400" />
                Maize
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Section 2: Dropzone & Upload */}
          <div className="flex flex-col gap-2.5">
            <label className="text-sm font-medium text-zinc-300">
              2. Leaf photo <span className="text-amber-400">*</span>
            </label>

            {/* Hidden file input supporting camera capture on mobile */}
            <input
              ref={fileInputRef}
              id="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              disabled={isLoading}
              onChange={handleFileInputChange}
            />

            {!state.previewUrl ? (
              <div
                id="dropzone"
                tabIndex={0}
                role="button"
                aria-label="Upload leaf photo"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onClick={() => {
                  if (!isLoading) {
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragOver
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80"
                } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
                  <Camera className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-100">
                  Tap to take or upload a leaf photo
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  One leaf, daylight, flat, filling the frame.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-zinc-400">
                  <UploadCloud className="h-3 w-3" /> JPG, PNG, WebP up to 5 MB
                </span>
              </div>
            ) : (
              /* Section 3: Image Preview with Remove Button */
              <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-black">
                  <img
                    id="preview"
                    src={state.previewUrl}
                    alt="Selected leaf photo"
                    className="h-full w-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label="Remove photo"
                    disabled={isLoading}
                    onClick={handleClearPreview}
                    className="absolute right-3 top-3 h-11 w-11 min-h-[44px] min-w-[44px] rounded-full bg-black/75 text-white shadow-lg backdrop-blur-md transition hover:bg-rose-600 focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between px-1 text-xs text-zinc-400">
                  <span className="truncate max-w-[200px]">
                    {state.file?.name}
                  </span>
                  <span>
                    {state.file
                      ? `${(state.file.size / (1024 * 1024)).toFixed(2)} MB`
                      : ""}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Inline Validation Error Alert */}
          {state.validationError && (
            <Alert variant="destructive" className="border-rose-900/50 bg-rose-950/40 text-rose-200">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <AlertTitle className="text-rose-100">Invalid File</AlertTitle>
              <AlertDescription className="text-rose-300">
                {state.validationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Diagnose Button */}
          <Button
            id="analyze-btn"
            size="lg"
            disabled={isDiagnoseDisabled}
            onClick={handleDiagnoseClick}
            className="h-12 min-h-[44px] w-full rounded-xl bg-amber-400 font-semibold text-zinc-950 transition-all hover:bg-amber-300 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing leaf...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                Diagnose <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>

        {/* Right Column: Loading Skeleton, Result Cards, or Error Display */}
        <div className="flex flex-col justify-start">
          {/* 1. Loading State */}
          {isLoading && (
            <Card className="border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <h3 className="text-lg font-medium text-white">Analyzing leaf...</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Evaluating lesion patterns and disease markers with deep vision...
                </p>
              </div>
              <div className="space-y-4 pt-4">
                <Skeleton className="h-4 w-3/4 bg-zinc-800" />
                <Skeleton className="h-3 w-full bg-zinc-800/80" />
                <Skeleton className="h-3 w-5/6 bg-zinc-800/80" />
                <div className="pt-2">
                  <Skeleton className="h-10 w-full rounded-lg bg-zinc-800" />
                </div>
              </div>
            </Card>
          )}

          {/* 2. Error State */}
          {state.status === "error" && state.error && (
            <Card className="border-rose-900/60 bg-rose-950/20 p-6 backdrop-blur-sm">
              <Alert variant="destructive" className="border-rose-900/50 bg-rose-950/50">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                <AlertTitle className="text-base font-semibold text-rose-200">
                  Diagnosis Failed
                </AlertTitle>
                <AlertDescription className="mt-2 text-sm text-rose-300">
                  {getFriendlyErrorMessage(state.error.code, state.error.message)}
                </AlertDescription>
              </Alert>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleDiagnoseClick}
                  variant="outline"
                  className="min-h-[44px] rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Try again
                </Button>
              </div>
            </Card>
          )}

          {/* 3. Result States by Outcome */}
          {state.status === "result" && state.result && (
            <div aria-live="polite" className="w-full">
              {/* Outcome A: Disease */}
              {state.result.outcome === "disease" && (
                <Card className="border-zinc-800 bg-zinc-900/90 text-zinc-100 shadow-2xl backdrop-blur-sm">
                  <CardHeader className="space-y-2 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                        Leaf Diagnosis
                      </span>
                      {state.result.advice && (
                        <SeverityBadge severity={state.result.advice.severity} />
                      )}
                    </div>
                    <CardTitle className="text-2xl font-semibold tracking-tight text-white">
                      {state.result.prediction?.display_name || "Detected Condition"}
                    </CardTitle>
                    {state.result.advice?.causal_agent && (
                      <CardDescription className="text-sm text-zinc-400">
                        Causal agent: {state.result.advice.causal_agent}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Confidence Progress */}
                    {state.result.prediction && (
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-300">Confidence Score</span>
                          <span className="font-semibold text-amber-400">
                            {Math.round(state.result.prediction.confidence * 100)}% confident
                          </span>
                        </div>
                        <Progress
                          value={Math.round(state.result.prediction.confidence * 100)}
                          className="h-2 w-full bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-amber-400"
                        />
                      </div>
                    )}

                    {/* Result Message */}
                    <p className="rounded-lg bg-zinc-800/40 p-3 text-sm leading-relaxed text-zinc-200">
                      {state.result.message}
                    </p>

                    {/* Four Treatment Sections */}
                    {state.result.advice && (
                      <div className="space-y-4 pt-1">
                        {/* Symptoms */}
                        {state.result.advice.symptoms && state.result.advice.symptoms.length > 0 && (
                          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                              <Stethoscope className="h-4 w-4 text-amber-400" />
                              Symptoms
                            </h4>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-300">
                              {state.result.advice.symptoms.map((symptom, idx) => (
                                <li key={idx}>{symptom}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Organic Remedy */}
                        {state.result.advice.organic_remedy && (
                          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                              <Leaf className="h-4 w-4" />
                              Organic Remedy
                            </h4>
                            <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
                              {state.result.advice.organic_remedy}
                            </p>
                          </div>
                        )}

                        {/* Chemical Remedy */}
                        {state.result.advice.chemical_remedy && (
                          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
                            <div className="flex items-center justify-between">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                                <FlaskConical className="h-4 w-4" />
                                Chemical Remedy
                              </h4>
                              <span className="text-[11px] font-medium text-zinc-400">
                                Generic active ingredient
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
                              {state.result.advice.chemical_remedy}
                            </p>
                          </div>
                        )}

                        {/* Prevention */}
                        {state.result.advice.prevention && state.result.advice.prevention.length > 0 && (
                          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                              <ShieldCheck className="h-4 w-4 text-amber-400" />
                              Prevention
                            </h4>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-300">
                              {state.result.advice.prevention.map((prev, idx) => (
                                <li key={idx}>{prev}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Also possible (second top_k candidate) */}
                    {state.result.top_k && state.result.top_k.length > 1 && (
                      <div className="border-t border-zinc-800 pt-3 text-xs text-zinc-400">
                        <span className="font-medium text-zinc-400">Also possible: </span>
                        <span>
                          {state.result.top_k[1].display_name} (
                          {Math.round(state.result.top_k[1].confidence * 100)}%)
                        </span>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-4 border-t border-zinc-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      Diagnosed in {state.result.latency_ms} ms
                    </span>
                    <Button
                      onClick={handleFullReset}
                      variant="outline"
                      className="min-h-[44px] w-full rounded-xl border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 sm:w-auto"
                    >
                      Try another leaf
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {/* Outcome B: Healthy */}
              {state.result.outcome === "healthy" && (
                <Card className="border-emerald-600/40 bg-emerald-950/20 text-emerald-100 shadow-2xl backdrop-blur-sm">
                  <CardHeader className="space-y-2 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-emerald-300">
                          Plant Appears Healthy
                        </CardTitle>
                        <CardDescription className="text-xs text-emerald-400/80">
                          No signs of active pathogens or lesions detected
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="rounded-lg bg-emerald-900/30 p-3.5 text-sm leading-relaxed text-emerald-200">
                      {state.result.message}
                    </p>

                    {state.result.advice && (
                      <div className="space-y-3 rounded-xl border border-emerald-800/30 bg-emerald-950/40 p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                          <Leaf className="h-4 w-4" /> Recommended Care Tips
                        </h4>
                        {state.result.advice.organic_remedy && (
                          <p className="text-xs leading-relaxed text-emerald-200/90">
                            {state.result.advice.organic_remedy}
                          </p>
                        )}
                        {state.result.advice.prevention && state.result.advice.prevention.length > 0 && (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-200/90">
                            {state.result.advice.prevention.map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-4 border-t border-emerald-900/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400/70">
                      <Clock className="h-3.5 w-3.5" />
                      Diagnosed in {state.result.latency_ms} ms
                    </span>
                    <Button
                      onClick={handleFullReset}
                      className="min-h-[44px] w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto"
                    >
                      Try another leaf
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {/* Outcome C: Low Confidence */}
              {state.result.outcome === "low_confidence" && (
                <Card className="border-amber-600/50 bg-amber-950/20 text-amber-100 shadow-2xl backdrop-blur-sm">
                  <CardHeader className="space-y-2 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-amber-300">
                          Uncertain Classification
                        </CardTitle>
                        <CardDescription className="text-xs text-amber-400/80">
                          Confidence fell below diagnostic threshold
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="rounded-lg bg-amber-900/30 p-3.5 text-sm leading-relaxed text-amber-200">
                      {state.result.message}
                    </p>

                    <div className="rounded-xl border border-amber-800/40 bg-amber-950/40 p-4">
                      <h4 className="text-sm font-semibold text-amber-300">Photo tips:</h4>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-amber-200/90">
                        <li>Ensure natural daylight (avoid harsh shadows or dark rooms)</li>
                        <li>Lay the leaf flat without folds or curling</li>
                        <li>Fill most of the frame with the single affected leaf</li>
                        <li>Avoid camera blur by holding still and tapping to focus</li>
                      </ul>
                    </div>
                  </CardContent>

                  <CardFooter className="flex flex-col gap-4 border-t border-amber-900/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-amber-400/70">
                      <Clock className="h-3.5 w-3.5" />
                      Diagnosed in {state.result.latency_ms} ms
                    </span>
                    <Button
                      onClick={handleRetakePhoto}
                      className="min-h-[44px] w-full rounded-xl bg-amber-500 font-medium text-black hover:bg-amber-400 sm:w-auto"
                    >
                      Retake photo
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {/* Outcome D: Crop Mismatch */}
              {state.result.outcome === "crop_mismatch" && (
                <Card className="border-amber-600/50 bg-amber-950/20 text-amber-100 shadow-2xl backdrop-blur-sm">
                  <CardHeader className="space-y-2 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-amber-300">
                          Crop Mismatch Detected
                        </CardTitle>
                        <CardDescription className="text-xs text-amber-400/80">
                          Image features do not match selected crop
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="rounded-lg bg-amber-900/30 p-3.5 text-sm leading-relaxed text-amber-200">
                      {state.result.message}
                    </p>
                  </CardContent>

                  <CardFooter className="flex flex-wrap items-center justify-end gap-3 border-t border-amber-900/40 pt-4">
                    <Button
                      onClick={handleRetakePhoto}
                      variant="outline"
                      className="min-h-[44px] rounded-xl border-amber-700/50 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50"
                    >
                      Retake photo
                    </Button>
                    {state.result.detected_crop && (
                      <Button
                        onClick={() =>
                          handleSwitchCropAndRetry(state.result!.detected_crop!)
                        }
                        className="min-h-[44px] rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300"
                      >
                        Switch to{" "}
                        {state.result.detected_crop.charAt(0).toUpperCase() +
                          state.result.detected_crop.slice(1)}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )}
            </div>
          )}

          {/* 4. Idle State Placeholder */}
          {state.status === "idle" && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/40 p-8 text-center text-zinc-400">
              <Leaf className="mb-3 h-10 w-10 text-zinc-400" />
              <h4 className="text-base font-medium text-zinc-300">Ready for Leaf Diagnosis</h4>
              <p className="mt-1 max-w-xs text-xs text-zinc-400">
                Choose your crop and upload a photo on the left to receive instant disease identification and remedies.
              </p>
            </div>
          )}

          {/* 5. Preview State Waiting to Diagnose */}
          {state.status === "preview" && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-8 text-center text-zinc-400">
              <Camera className="mb-3 h-10 w-10 text-amber-400/60" />
              <h4 className="text-base font-medium text-zinc-200">Photo Loaded</h4>
              <p className="mt-1 max-w-xs text-xs text-zinc-400">
                {!state.crop
                  ? "Select a crop (Tomato or Maize) above to enable diagnosis."
                  : 'Click "Diagnose" on the left to analyze the leaf.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "low" | "moderate" | "high" }) {
  if (severity === "low") {
    return (
      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
        Low Severity
      </Badge>
    );
  }
  if (severity === "moderate") {
    return (
      <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400">
        Moderate Severity
      </Badge>
    );
  }
  return (
    <Badge className="border-rose-500/40 bg-rose-500/15 text-rose-400">
      High Severity
    </Badge>
  );
}
