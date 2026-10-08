"use client";
import { useEffect, useState } from "react";
import { ArrowDown, Leaf } from "lucide-react";
import { BlackHoleHeroSection } from "@/components/ui/blackhole-hero-section";

function useNarrow(query = "(max-width: 767px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, [query]);
  return narrow;
}

function HeroCopy() {
  return (
    <div className="flex h-full min-h-[92svh] items-start px-6 pt-14 sm:px-10 md:min-h-[720px] md:items-center md:pt-0 lg:px-20">
      <div className="max-w-[34rem]">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
          <Leaf className="h-3.5 w-3.5 text-amber-400" /> AI Crop-Disease Detector
        </span>
        <h1 className="mt-5 text-[2.5rem] font-light leading-[1.05] tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.25rem]">
          Catch the disease
          <br />
          before it spreads
        </h1>
        <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-white/60">
          Pick your crop, upload a photo of one leaf, and get a diagnosis with
          a remedy in seconds. Built for tomato and maize.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3 md:mt-10">
          <a
            href="#diagnose"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-white/90"
          >
            Diagnose a leaf <ArrowDown className="h-4 w-4" />
          </a>
          <a
            href="#how"
            className="rounded-full border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
          >
            How it works
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CropHero() {
  const narrow = useNarrow();
  // Safety switch for weak demo laptops: VITE_ENABLE_HERO=false swaps the WebGL canvas for a static gradient.
  const enabled = import.meta.env.VITE_ENABLE_HERO !== "false";
  return (
    <section className="relative min-h-[92svh] w-full md:min-h-[720px]">
      {enabled ? (
        <BlackHoleHeroSection
          focus={narrow ? [0.5, 0.76] : [0.72, 0.46]}
          scrim={narrow ? "top" : "left"}
          scrimStrength={0.9}
          distance={24}
          elevation={narrow ? -7 : -5.5}
          fov={narrow ? 58 : 42}
          glow={narrow ? 0.85 : 1}
          steps={narrow ? 180 : 260}
          resolution={narrow ? 0.5 : 0.6}
        >
          <HeroCopy />
        </BlackHoleHeroSection>
      ) : (
        <div className="relative h-full min-h-[92svh] w-full bg-[radial-gradient(ellipse_at_72%_46%,#8E3A0B_0%,#1a0c04_35%,#000_70%)] md:min-h-[720px]">
          <HeroCopy />
        </div>
      )}
    </section>
  );
}
