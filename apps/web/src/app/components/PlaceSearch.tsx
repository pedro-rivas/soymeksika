"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type PlaceResult = {
  name: string;
  lngLat: [number, number];
};

type NominatimResult = {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  onSelect: (place: PlaceResult) => void;
};

const DEBOUNCE_MS = 350;
const MIN_QUERY_LEN = 3;

function primaryName(result: NominatimResult): string {
  if (result.name?.trim()) return result.name.trim();
  return result.display_name.split(",")[0]?.trim() || result.display_name;
}

export default function PlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setError(null);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "5");
        url.searchParams.set("q", q);

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) throw new Error("Search failed");

        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
        setError("Could not search places");
        setOpen(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const selectResult = (result: NominatimResult) => {
    const lng = Number(result.lon);
    const lat = Number(result.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    const place: PlaceResult = {
      name: primaryName(result),
      lngLat: [lng, lat],
    };
    onSelect(place);
    setQuery(place.name);
    setResults([]);
    setOpen(false);
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setResults([]);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && results.length > 0) {
        selectResult(results[0]!);
      }
    }
  };

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1 text-sm">
      <label className="font-medium text-zinc-800" htmlFor="place-search">
        Search place
      </label>
      <input
        id="place-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="rounded border border-zinc-300 px-2 py-1.5 outline-none focus:border-zinc-500"
        placeholder="e.g. Zócalo, CDMX"
        autoComplete="off"
      />

      {loading && (
        <p className="text-xs text-zinc-500" aria-live="polite">
          Searching…
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {open && results.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded border border-zinc-200 bg-white shadow-lg"
          role="listbox"
        >
          {results.map((result) => (
            <li key={result.place_id} role="option">
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-2 py-2 text-left hover:bg-zinc-50"
                onClick={() => selectResult(result)}
              >
                <span className="font-medium text-zinc-900">
                  {primaryName(result)}
                </span>
                <span className="line-clamp-2 text-xs text-zinc-500">
                  {result.display_name}
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-zinc-100 px-2 py-1.5 text-[10px] text-zinc-400">
            Search: © OpenStreetMap contributors
          </li>
        </ul>
      )}

      {open && !loading && query.trim().length >= MIN_QUERY_LEN && results.length === 0 && !error && (
        <p className="text-xs text-zinc-500">No places found</p>
      )}
    </div>
  );
}
