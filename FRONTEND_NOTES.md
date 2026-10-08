# Frontend Implementation Notes: AI Crop-Disease Detector

## Overview
The frontend of the **AI Crop-Disease Detector** is built mobile-first for hackathon use (in-field farmers' assistant), adhering strictly to the contract defined in `docs/API_CONTRACT.md`.

## Tech Stack & Tooling
- **Framework:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 with `@tailwindcss/vite` plugin and `@/` path alias in `tsconfig.json` and `vite.config.ts`
- **UI Components:** `shadcn/ui` installed to `/src/components/ui/` (`button`, `card`, `badge`, `progress`, `alert`, `skeleton`, `toggle-group`)
- **Icons:** `lucide-react`
- **Testing:** `vitest` with `@testing-library/react` and `jsdom`

## Component Architecture

### 1. WebGL Black Hole Hero (`/src/components/ui/blackhole-hero-section.tsx`)
- Integrated from the original 21st.dev WebGL accretion disc component.
- **Shader & Physics Integrity:** The Raymarching vertex & fragment shaders (`fv`, `iv`, `cv`, `sv`, `ov`, `rv`), relativistic beaming, Doppler shifts, and Kerr metric light bending formulas are 100% preserved and untouched.
- **Accessibility & Performance:**
  - Respects `prefers-reduced-motion` by settling in 16 frames and freezing the render loop.
  - Pauses updates when off-screen via `IntersectionObserver` or backgrounded via `visibilitychange`.
  - Supports WebGL context loss (`webglcontextlost`) and restoration (`webglcontextrestored`).
  - Safe switch: `VITE_ENABLE_HERO=false` swaps the WebGL canvas for a static radial gradient (`radial-gradient(ellipse_at_72%_46%,#8E3A0B_0%,#1a0c04_35%,#000_70%)`).

### 2. Crop Hero Section (`/src/components/crop-hero.tsx`)
- Adapted hero layout with farmer assistant copy ("Catch the disease before it spreads").
- Responsive viewport logic via `useNarrow("(max-width: 767px)")`:
  - **Mobile (< 768px):** Turns the layout 90° with `scrim="top"`, `focus=[0.5, 0.76]`, `elevation=-7`, `steps=180`, `resolution=0.5`.
  - **Desktop (>= 768px):** `scrim="left"`, `focus=[0.72, 0.46]`, `elevation=-5.5`, `steps=260`, `resolution=0.6`.

### 3. API Client & Types (`/src/lib/types.ts`, `/src/lib/api.ts`)
- Exactly mirrors `docs/API_CONTRACT.md`:
  - `CropId` ("tomato" | "maize")
  - `Outcome` ("disease" | "healthy" | "low_confidence" | "crop_mismatch")
  - `Advice`, `Candidate`, `PredictResponse`, `ApiError`
- `predict(image: File, crop: CropId, mock?: Outcome)`:
  - Base URL resolved from `VITE_API_URL ?? "http://localhost:5000"`.
  - Appends `?mock=<value>` when `mock` argument or `VITE_MOCK_OUTCOME` is set.
  - 20-second timeout handled via `AbortController`.
  - Parses structured non-2xx `ApiError` responses.
  - Throws `{ code: "NETWORK", message: "Cannot reach the server. Check your connection." }` on network failure.
- `getCrops()`: Fetches `/api/crops` with hardcoded fallback (`tomato`, `maize`) if unreachable.

### 4. Diagnosis Panel & State Machine (`/src/components/diagnose-panel.tsx`)
- Single source of truth managed via `useReducer` (`idle` -> `preview` -> `loading` -> `result` | `error`).
- Required DOM IDs:
  - `id="crop-select"`: `ToggleGroup` (type single) with Tomato (Leaf) and Maize (Wheat) options.
  - `id="dropzone"`: Drag-and-drop plus click-to-browse area.
  - `id="file-input"`: Hidden input with `capture="environment"` to trigger native phone cameras.
  - `id="preview"`: `<img>` using `URL.createObjectURL` with cleanup revoking to avoid memory leaks.
  - `id="analyze-btn"`: Full-width button, disabled until crop and image are selected.
- **Client-Side Validation:**
  - Enforces JPG, PNG, WebP format and `<= 5 MB` file size before making any network call.
  - Displays inline destructive `Alert` if invalid.
- **Loading State:**
  - Disables all inputs, shows animated `Loader2` spinner and `Skeleton` placeholder card with "Analyzing leaf...".
- **Outcome Handling (`aria-live="polite"`):**
  - **disease:** Severity badge (green/amber/red), disease name, causal agent, confidence progress bar, message, 4 treatment sections (Symptoms, Organic remedy, Chemical remedy with generic active ingredient, Prevention), "Also possible" second candidate, and latency footer.
  - **healthy:** Emerald card, `CheckCircle2` icon, healthy status message, and care tips.
  - **low_confidence:** Amber card, `AlertTriangle` icon, photo tips checklist, and "Retake photo" button (preserves selected crop).
  - **crop_mismatch:** Amber card, mismatch message, "Switch to {detected_crop}" button (auto-updates crop and re-submits image), and "Retake photo" button.
- **Error Handling:**
  - Destructive alert mapping backend codes (`NO_FILE`, `BAD_FILE_TYPE`, `CORRUPT_IMAGE`, `IMAGE_TOO_SMALL`, `FILE_TOO_LARGE`, `INVALID_CROP`, `MODEL_NOT_LOADED`, `NETWORK`) to user-friendly messages with a "Try again" button.

### 5. Layout & Responsive Design (`/src/App.tsx`)
- Dark theme (`bg-black` / `zinc-950` with `amber-400` accents).
- Single-column on mobile (`< 768px`), two columns from `md` (left: inputs & dropzone, right: diagnosis output).
- Minimum touch target size of 44 px on all interactive controls (`button`, `toggle-group`, file dropzone).
- Three workflow cards in `#how` section: "Pick your crop" (`Sprout`), "Upload one leaf" (`Camera`), "Get a remedy" (`FlaskConical`).
- Footer advisory disclaimer: *"Advice is guidance only. Confirm with your local agriculture extension officer before spraying."*

---

## Assumptions
1. **API Port & Host:** Development backend is assumed to run at `http://localhost:5000` (configurable via `VITE_API_URL` in `.env`). On macOS, port 5000 may conflict with AirPlay Receiver (`ControlCenter`), but Flask bound to `127.0.0.1:5000` functions properly.
2. **Mock Mode in Development:** When `VITE_MOCK_OUTCOME` is populated in `.env` (e.g. `disease`, `healthy`, `low_confidence`, `crop_mismatch`), the API client automatically forwards it to the backend via `?mock=<value>`.
3. **Workspace Organization:** The project root is linked between `/Users/shaswatsinha/frontend` and `/Users/shaswatsinha/Documents/crop/frontend` so paths resolve uniformly.
4. **Offline Resilience:** If `/api/crops` is down or unconfigured, the frontend automatically falls back to standard options `tomato` and `maize`.
