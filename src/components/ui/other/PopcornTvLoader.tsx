"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/utils/helpers";
import {
  alignRing,
  easeInOutCubic,
  morphPath,
  POPCORN_PATHS,
  samplePath,
  TV_PATHS,
  type Point,
} from "@/utils/morph";

/**
 * PopcornTvLoader
 * ---------------
 * A loading indicator that continuously morphs a popcorn bucket into a TV set
 * and back again.
 *
 * The morph is a real shape interpolation, not a cross fade: both icons are
 * described by the same number of closed sub paths, every sub path is sampled
 * into an equal amount of points, the rings are rotationally aligned (so the
 * shapes don't twist while morphing) and then point-by-point interpolated into
 * a smooth closed Catmull-Rom path on every frame.
 *
 * Before hydration (and when `prefers-reduced-motion` is set) the static
 * popcorn bucket is rendered instead.
 */

const HOLD_MS = 820;
const MORPH_MS = 880;
const CYCLE_MS = HOLD_MS * 2 + MORPH_MS * 2;

/** Kernels that pop out of the bucket while it is visible. */
const PARTICLES = [
  { cx: 38, cy: 42, r: 3 },
  { cx: 50, cy: 32, r: 2.4 },
  { cx: 62, cy: 42, r: 3 },
];

export interface PopcornTvLoaderProps {
  /** Visual size of the animation. */
  size?: "sm" | "md" | "lg";
  /** Optional caption rendered under the animation. */
  label?: string;
  /** Hides the caption (useful inside tight layouts). */
  hideLabel?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: 40, stroke: 5.5, text: "text-[11px]" },
  md: { box: 64, stroke: 5, text: "text-xs" },
  lg: { box: 92, stroke: 4.6, text: "text-sm" },
} as const;

/**
 * All loaders on a page share a single requestAnimationFrame loop (a busy home
 * page can mount eight of them) and a single measurement of both icons, so the
 * shapes stay perfectly in sync while the cost stays flat.
 */
type FrameHandler = (progress: number) => void;

const handlers = new Set<FrameHandler>();
let rafId = 0;
let startedAt = 0;
let cachedRings: { from: Point[][]; to: Point[][] } | null = null;

/** Progress (0 = popcorn, 1 = TV) for a point in time of the loop. */
const morphProgress = (elapsed: number): number => {
  const elapsedInCycle = elapsed % CYCLE_MS;

  if (elapsedInCycle < HOLD_MS) return 0;
  if (elapsedInCycle < HOLD_MS + MORPH_MS) {
    return easeInOutCubic((elapsedInCycle - HOLD_MS) / MORPH_MS);
  }
  if (elapsedInCycle < HOLD_MS * 2 + MORPH_MS) return 1;

  return 1 - easeInOutCubic((elapsedInCycle - HOLD_MS * 2 - MORPH_MS) / MORPH_MS);
};

const tick = (now: number) => {
  const progress = morphProgress(now - startedAt);
  handlers.forEach((handler) => handler(progress));
  rafId = requestAnimationFrame(tick);
};

const subscribe = (handler: FrameHandler) => {
  handlers.add(handler);
  if (!rafId) {
    startedAt = performance.now();
    rafId = requestAnimationFrame(tick);
  }
};

const unsubscribe = (handler: FrameHandler) => {
  handlers.delete(handler);
  if (!handlers.size && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
};

/** Measures both icons once with a throwaway, off screen SVG path element. */
const getRings = (): typeof cachedRings => {
  if (cachedRings || typeof document === "undefined") return cachedRings;

  const measuringSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  measuringSvg.setAttribute("width", "0");
  measuringSvg.setAttribute("height", "0");
  measuringSvg.setAttribute("aria-hidden", "true");
  measuringSvg.style.position = "absolute";
  measuringSvg.style.opacity = "0";
  measuringSvg.style.pointerEvents = "none";
  document.body.appendChild(measuringSvg);

  const measuringPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  measuringSvg.appendChild(measuringPath);

  try {
    const from = POPCORN_PATHS.map((d) => samplePath(measuringPath, d));
    const to = TV_PATHS.map((d, index) => alignRing(from[index], samplePath(measuringPath, d)));
    cachedRings = { from, to };
  } catch (error) {
    console.warn("PopcornTvLoader: path morph unavailable, keeping the static icon.", error);
  } finally {
    measuringSvg.remove();
  }

  return cachedRings;
};

const PopcornTvLoader: React.FC<PopcornTvLoaderProps> = ({
  size = "md",
  label,
  hideLabel = false,
  className,
}) => {
  const generatedId = useId();
  // useId() contains colons, which are not valid inside a `url(#id)` reference.
  const gradientId = `popcorn-tv-${generatedId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const reducedMotion = useReducedMotion();
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const [phase, setPhase] = useState<"popcorn" | "tv">("popcorn");
  const dimensions = SIZES[size] ?? SIZES.md;

  useEffect(() => {
    if (reducedMotion) return;

    const rings = getRings();
    if (!rings) return;

    let handler: FrameHandler | null = null;

    handler = (progress: number) => {
      for (let index = 0; index < rings.from.length; index++) {
        const element = pathRefs.current[index];
        if (element) {
          element.setAttribute("d", morphPath(rings.from[index], rings.to[index], progress));
        }
      }

      // Only re-renders when the phase actually flips.
      const nextPhase: "popcorn" | "tv" = progress > 0.5 ? "tv" : "popcorn";
      setPhase((previous) => (previous === nextPhase ? previous : nextPhase));
    };

    subscribe(handler);

    return () => {
      if (handler) unsubscribe(handler);
    };
  }, [reducedMotion]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
      className={cn("flex flex-col items-center justify-center gap-3 text-white/70", className)}
    >
      <div className="relative" style={{ width: dimensions.box, height: dimensions.box }}>
        <svg
          viewBox="0 0 100 100"
          className="size-full overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9CA3AF" />
              <stop offset="55%" stopColor="#6B7280" />
              <stop offset="100%" stopColor="#4B5563" />
            </linearGradient>
          </defs>

          {/* Breathing halo */}
          <motion.circle
            cx={50}
            cy={50}
            r={45}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={1.2}
            strokeDasharray="5 11"
            initial={{ opacity: 0.18, scale: 1, rotate: 0 }}
            animate={
              reducedMotion
                ? { opacity: 0.18, scale: 1, rotate: 0 }
                : { opacity: [0.14, 0.32, 0.14], scale: [0.94, 1.05, 0.94], rotate: [0, 180] }
            }
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Popping kernels (popcorn phase only) */}
          {!reducedMotion && (
            <motion.g
              animate={{ opacity: phase === "popcorn" ? 1 : 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {PARTICLES.map((particle, index) => (
                <motion.circle
                  key={`particle-${index}`}
                  cx={particle.cx}
                  cy={particle.cy}
                  r={particle.r}
                  fill={`url(#${gradientId})`}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: [0, -22], opacity: [0, 0.85, 0] }}
                  transition={{
                    duration: 1.7,
                    repeat: Infinity,
                    delay: index * 0.26,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.g>
          )}

          {/* The morphing icon itself */}
          <g
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={dimensions.stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {POPCORN_PATHS.map((d, index) => (
              <path
                key={`morph-${index}`}
                d={d}
                ref={(element) => {
                  pathRefs.current[index] = element;
                }}
              />
            ))}
          </g>
        </svg>
      </div>

      {label && !hideLabel && (
        <p className={cn("max-w-[22rem] text-center leading-snug text-white/60", dimensions.text)}>
          {label}
          <span className="ml-1 inline-flex items-end gap-0.5">
            {[0, 1, 2].map((index) => (
              <motion.span
                key={`dot-${index}`}
                className="size-1 rounded-full bg-current"
                animate={
                  reducedMotion ? { opacity: 0.4 } : { opacity: [0.25, 1, 0.25], y: [0, -2, 0] }
                }
                transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.18 }}
              />
            ))}
          </span>
        </p>
      )}
    </div>
  );
};

export default PopcornTvLoader;
