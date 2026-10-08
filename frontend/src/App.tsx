"use client";

import { Camera, FlaskConical, Sprout } from "lucide-react";
import CropHero from "@/components/crop-hero";
import { DiagnosePanel } from "@/components/diagnose-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-black text-white antialiased selection:bg-amber-400 selection:text-black">
      {/* 1. Hero Section */}
      <CropHero />

      {/* 2. Diagnose Section */}
      <section
        id="diagnose"
        className="relative w-full border-t border-zinc-900 bg-zinc-950 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-5xl px-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-1 text-xs font-medium text-amber-400">
            Instant Leaf Diagnosis
          </span>
          <h2 className="mt-4 text-3xl font-light tracking-tight text-white sm:text-4xl">
            Inspect your leaf
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Select your crop, provide a clear single-leaf photo, and let the model
            identify pathogens and suggest immediate remedies.
          </p>
        </div>

        <DiagnosePanel />
      </section>

      {/* 3. How It Works Section */}
      <section
        id="how"
        className="w-full border-t border-zinc-900 bg-black py-16 sm:py-24"
      >
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1 text-xs font-medium text-zinc-300">
              Diagnostic Workflow
            </span>
            <h2 className="mt-4 text-3xl font-light tracking-tight text-white sm:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400 sm:text-base">
              Designed for quick in-field decisions on mobile devices.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {/* Step 1: Pick your crop */}
            <Card className="border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm transition-all hover:border-zinc-700">
              <CardHeader className="p-0 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
                  <Sprout className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-mono text-xs text-amber-400">01</span>
                  <CardTitle className="text-lg font-medium text-white">
                    Pick your crop
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 text-sm leading-relaxed text-zinc-400">
                Choose Tomato or Maize to ensure the neural model isolates
                pathogens specific to the crop species.
              </CardContent>
            </Card>

            {/* Step 2: Upload one leaf */}
            <Card className="border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm transition-all hover:border-zinc-700">
              <CardHeader className="p-0 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
                  <Camera className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-mono text-xs text-amber-400">02</span>
                  <CardTitle className="text-lg font-medium text-white">
                    Upload one leaf
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 text-sm leading-relaxed text-zinc-400">
                Snap a photo in clear daylight. Lay the leaf flat so disease
                lesions, spots, and rust pustules fill the frame.
              </CardContent>
            </Card>

            {/* Step 3: Get a remedy */}
            <Card className="border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm transition-all hover:border-zinc-700">
              <CardHeader className="p-0 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-mono text-xs text-amber-400">03</span>
                  <CardTitle className="text-lg font-medium text-white">
                    Get a remedy
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 text-sm leading-relaxed text-zinc-400">
                Receive diagnosis results in milliseconds with tailored organic
                treatments, generic active ingredients, and prevention steps.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. Footer disclaimer */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-10 text-center">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-xs font-normal leading-relaxed text-zinc-400 sm:text-sm">
            Advice is guidance only. Confirm with your local agriculture
            extension officer before spraying.
          </p>
          <p className="mt-3 text-[11px] text-zinc-400">
            AI Crop-Disease Detector &bull; Mobile-First Farmer&apos;s Assistant
          </p>
        </div>
      </footer>
    </div>
  );
}
