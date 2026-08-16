"use client";

import type { CountrySummary } from "../lib/countries";
import type { HighlightPhase } from "../lib/animations/countryHighlight";
import {
  TITLE_STYLES,
  type TitleStyleId,
} from "../lib/animations/titleStyles";

const PHASE_LABELS: Record<HighlightPhase, string> = {
  idle: "Ready",
  arriving: "Flying to country…",
  highlighting: "Highlighting…",
  naming: "Showing name…",
  holding: "Holding highlight…",
  closing: "Closing highlight…",
};

const SELECT_CLASS =
  "w-full appearance-none rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 pr-8 text-sm text-zinc-100 outline-none transition focus:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-50";

interface AnimationPanelProps {
  countries: CountrySummary[];
  selected: string;
  onSelect: (name: string) => void;
  titleStyle: TitleStyleId;
  onTitleStyleChange: (style: TitleStyleId) => void;
  phase: HighlightPhase;
  onPlay: () => void;
  onStop: () => void;
}

function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AnimationPanel({
  countries,
  selected,
  onSelect,
  titleStyle,
  onTitleStyleChange,
  phase,
  onPlay,
  onStop,
}: AnimationPanelProps) {
  const playing = phase !== "idle";
  const loading = countries.length === 0;

  return (
    <aside
      aria-label="Travel animations"
      className="fixed top-4 left-14 z-[100000] w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 text-zinc-100 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
            Travel animations
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-white">
            Country Highlight
          </h2>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
          01
        </span>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-2">
        <p className="text-xs leading-relaxed text-zinc-400">
          Flies to the selected country, fades in a glowing highlight, reveals
          the Spanish name, then closes it out.
        </p>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Country
          </span>
          <span className="relative block">
            <select
              aria-label="Country to highlight"
              value={selected}
              onChange={(e) => onSelect(e.target.value)}
              disabled={playing || loading}
              className={SELECT_CLASS}
            >
              {loading ? (
                <option>Loading countries…</option>
              ) : (
                countries.map((country) => (
                  <option key={country.name} value={country.name}>
                    {country.name}
                  </option>
                ))
              )}
            </select>
            <SelectChevron />
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Title animation
          </span>
          <span className="relative block">
            <select
              aria-label="Title animation style"
              value={titleStyle}
              onChange={(e) =>
                onTitleStyleChange(e.target.value as TitleStyleId)
              }
              disabled={playing}
              className={SELECT_CLASS}
            >
              {TITLE_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          {playing ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
                <rect
                  width="10"
                  height="10"
                  x="1"
                  y="1"
                  rx="1.5"
                  fill="currentColor"
                />
              </svg>
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onPlay}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
                <path
                  d="M3 1.7v8.6c0 .8.9 1.3 1.6.9l6.6-4.3a1 1 0 0 0 0-1.7L4.6.8a1 1 0 0 0-1.6.9Z"
                  fill="currentColor"
                />
              </svg>
              Play animation
            </button>
          )}

          <span className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                playing ? "bg-amber-400" : "bg-zinc-600"
              }`}
            />
            <span className="truncate">{PHASE_LABELS[phase]}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
