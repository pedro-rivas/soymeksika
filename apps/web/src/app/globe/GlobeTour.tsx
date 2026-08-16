"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { TOUR_COUNTRIES, type TourCountry } from "./tourCountries";

/** Served only in development via /api/dev/globe-asset (not in public/). */
const EARTH_NIGHT_URL = "/api/dev/globe-asset/earth-night.jpg";
const EARTH_TOPOLOGY_URL = "/api/dev/globe-asset/earth-topology.png";

type CountryFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  Record<string, unknown>
>;

type FeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  Record<string, unknown>
>;

type LngLat = [number, number];

type PathDatum = {
  id: string;
  coords: LngLat[];
  color: string;
};

type LabelDatum = {
  id: string;
  lat: number;
  lng: number;
  flag: string;
  name: string;
};

type HighlightPoly = CountryFeature & {
  __color: string;
  __opacity: number;
};

const FLY_MS = 1200;
const TRACE_MS = 1400;
const FILL_MS = 550;
const LABEL_HOLD_MS = 900;
const BETWEEN_MS = 500;
const PATH_ALTITUDE = 0.012;
const FILL_ALTITUDE = 0.006;
const CAMERA_ALTITUDE = 1.65;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function featureName(feature: CountryFeature): string {
  const p = feature.properties ?? {};
  return String(p.ADMIN ?? p.NAME ?? p.name ?? "");
}

function ringArea(ring: LngLat[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(area / 2);
}

function getOuterRings(geometry: CountryFeature["geometry"]): LngLat[][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates[0] as LngLat[]];
  }
  return geometry.coordinates.map((poly) => poly[0] as LngLat[]);
}

function getMainRing(feature: CountryFeature): LngLat[] {
  const rings = getOuterRings(feature.geometry);
  let best = rings[0] ?? [];
  let bestArea = -1;
  for (const ring of rings) {
    const a = ringArea(ring);
    if (a > bestArea) {
      bestArea = a;
      best = ring;
    }
  }
  return best;
}

function centroidOfRing(ring: LngLat[]): { lat: number; lng: number } {
  if (ring.length === 0) return { lat: 0, lng: 0 };
  let lng = 0;
  let lat = 0;
  const n = ring.length > 1 ? ring.length - 1 : ring.length;
  for (let i = 0; i < n; i++) {
    lng += ring[i][0];
    lat += ring[i][1];
  }
  return { lat: lat / n, lng: lng / n };
}

function sliceRingProgress(ring: LngLat[], progress: number): LngLat[] {
  if (ring.length < 2) return ring;
  const t = Math.min(1, Math.max(0, progress));
  const total = ring.length - 1;
  const exact = t * total;
  const endIdx = Math.max(1, Math.ceil(exact));
  return ring.slice(0, endIdx + 1);
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function animateValue(
  durationMs: number,
  signal: AbortSignal,
  onFrame: (t: number) => void,
): Promise<void> {
  if (durationMs <= 0) {
    onFrame(1);
    return;
  }
  const start = performance.now();
  await new Promise<void>((resolve, reject) => {
    let raf = 0;
    const onAbort = () => {
      cancelAnimationFrame(raf);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    const tick = (now: number) => {
      if (signal.aborted) return;
      const t = Math.min(1, (now - start) / durationMs);
      onFrame(t);
      if (t >= 1) {
        signal.removeEventListener("abort", onAbort);
        resolve();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

function createLabelElement(d: LabelDatum): HTMLElement {
  const el = document.createElement("div");
  el.className = "globe-tour-label";
  el.innerHTML = `<span class="globe-tour-label-flag">${d.flag}</span><span class="globe-tour-label-name">${d.name}</span>`;
  return el;
}

export default function GlobeTour() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [paths, setPaths] = useState<PathDatum[]>([]);
  const [highlights, setHighlights] = useState<HighlightPoly[]>([]);
  const [labels, setLabels] = useState<LabelDatum[]>([]);
  const [visited, setVisited] = useState<TourCountry[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading map…");

  const tourFeatures = useMemo(() => {
    const byName = new Map(countries.map((f) => [featureName(f), f]));
    return TOUR_COUNTRIES.map((tour) => {
      const feature = byName.get(tour.match);
      return feature ? { tour, feature } : null;
    }).filter(
      (x): x is { tour: TourCountry; feature: CountryFeature } => x !== null,
    );
  }, [countries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/countries.geojson");
        if (!res.ok) throw new Error(`Failed to load countries (${res.status})`);
        const geo = (await res.json()) as FeatureCollection;
        if (cancelled) return;
        const features = geo.features.filter(
          (f): f is CountryFeature =>
            f.geometry?.type === "Polygon" ||
            f.geometry?.type === "MultiPolygon",
        );
        setCountries(features);
        setReady(true);
        setStatus("Ready");
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(1, Math.floor(rect.width)), h: Math.max(1, Math.floor(rect.height)) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resetVisuals = useCallback(() => {
    setPaths([]);
    setHighlights([]);
    setLabels([]);
    setVisited([]);
  }, []);

  const runTour = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const runId = ++runIdRef.current;

    resetVisuals();
    setStatus("Tour starting…");

    const globe = globeRef.current;
    if (!globe || tourFeatures.length === 0) {
      setStatus("No tour countries found");
      return;
    }

    try {
      const controls = globe.controls();
      controls.autoRotate = false;
      controls.enableZoom = true;

      // Brief settle so the globe paints before we start flying.
      await sleep(400, signal);
      if (runId !== runIdRef.current) return;

      const completedPaths: PathDatum[] = [];
      const completedHighlights: HighlightPoly[] = [];
      const completedLabels: LabelDatum[] = [];
      const completedVisited: TourCountry[] = [];

      for (const { tour, feature } of tourFeatures) {
        if (signal.aborted || runId !== runIdRef.current) return;

        const ring = getMainRing(feature);
        const center = centroidOfRing(ring);
        setStatus(`Flying to ${tour.displayName}…`);

        globe.pointOfView(
          { lat: center.lat, lng: center.lng, altitude: CAMERA_ALTITUDE },
          FLY_MS,
        );
        await sleep(FLY_MS + 150, signal);

        setStatus(`Tracing ${tour.displayName}…`);
        const pathId = `path-${tour.match}`;
        await animateValue(TRACE_MS, signal, (t) => {
          const coords = sliceRingProgress(ring, t);
          setPaths([...completedPaths, { id: pathId, coords, color: tour.color }]);
        });
        completedPaths.push({
          id: pathId,
          coords: ring,
          color: tour.color,
        });
        setPaths([...completedPaths]);

        setStatus(`Filling ${tour.displayName}…`);
        const highlightBase = {
          ...feature,
          __color: tour.color,
          __opacity: 0,
        } as HighlightPoly;

        await animateValue(FILL_MS, signal, (t) => {
          const opacity = 0.15 + t * 0.55;
          setHighlights([
            ...completedHighlights,
            { ...highlightBase, __opacity: opacity },
          ]);
        });
        completedHighlights.push({ ...highlightBase, __opacity: 0.7 });
        setHighlights([...completedHighlights]);

        const label: LabelDatum = {
          id: `label-${tour.match}`,
          lat: center.lat,
          lng: center.lng,
          flag: tour.flag,
          name: tour.displayName,
        };
        completedLabels.push(label);
        setLabels([...completedLabels]);

        completedVisited.push(tour);
        setVisited([...completedVisited]);
        setStatus(tour.displayName);

        await sleep(LABEL_HOLD_MS, signal);
        await sleep(BETWEEN_MS, signal);
      }

      if (signal.aborted || runId !== runIdRef.current) return;
      setStatus("Tour complete");
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus(err instanceof Error ? err.message : "Tour failed");
    }
  }, [resetVisuals, tourFeatures]);

  useEffect(() => {
    if (!ready || tourFeatures.length === 0 || size.w === 0) return;
    const t = window.setTimeout(() => {
      void runTour();
    }, 200);
    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [ready, tourFeatures, size.w, size.h, runTour]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        void runTour();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runTour]);

  const polygonsData = useMemo(() => {
    const highlightIds = new Set(
      highlights.map((h) => featureName(h as CountryFeature)),
    );
    const base = countries.filter((f) => !highlightIds.has(featureName(f)));
    return [...base, ...highlights];
  }, [countries, highlights]);

  const wrapperStyle: CSSProperties = {
    cursor: "none",
  };

  return (
    <div
      ref={containerRef}
      className="globe-tour-root relative h-screen w-screen overflow-hidden bg-black"
      style={wrapperStyle}
    >
      <style>{`
        .globe-tour-root canvas {
          outline: none;
        }
        .globe-tour-label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(12, 16, 28, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          color: #fff;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.01em;
          white-space: nowrap;
          pointer-events: none;
          transform: translate(-50%, -120%) scale(0.85);
          opacity: 0;
          animation: globe-tour-label-in 420ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
        }
        .globe-tour-label-flag {
          font-size: 22px;
          line-height: 1;
        }
        .globe-tour-label-name {
          line-height: 1.1;
        }
        @keyframes globe-tour-label-in {
          from {
            opacity: 0;
            transform: translate(-50%, -110%) scale(0.7);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -120%) scale(1);
          }
        }
      `}</style>

      {size.w > 0 && size.h > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere
          atmosphereColor="#4ea8ff"
          atmosphereAltitude={0.18}
          globeImageUrl={EARTH_NIGHT_URL}
          bumpImageUrl={EARTH_TOPOLOGY_URL}
          polygonsData={polygonsData}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) => {
            const h = d as HighlightPoly;
            if (typeof h.__opacity === "number") {
              return hexToRgba(h.__color, h.__opacity);
            }
            return "rgba(20, 28, 48, 0.55)";
          }}
          polygonSideColor={() => "rgba(0,0,0,0.15)"}
          polygonStrokeColor={(d) => {
            const h = d as HighlightPoly;
            if (typeof h.__opacity === "number") {
              return hexToRgba(h.__color, Math.min(1, h.__opacity + 0.2));
            }
            return "rgba(120, 150, 200, 0.25)";
          }}
          polygonAltitude={(d) => {
            const h = d as HighlightPoly;
            return typeof h.__opacity === "number" ? FILL_ALTITUDE : 0.003;
          }}
          pathsData={paths}
          pathPoints="coords"
          pathPointLng={(p) => (p as LngLat)[0]}
          pathPointLat={(p) => (p as LngLat)[1]}
          pathColor={(d: object) => (d as PathDatum).color}
          pathStroke={2.2}
          pathPointAlt={() => PATH_ALTITUDE}
          htmlElementsData={labels}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.04}
          htmlElement={(d: object) => createLabelElement(d as LabelDatum)}
          htmlTransitionDuration={0}
        />
      )}

      <div className="pointer-events-none absolute left-5 top-5 z-10 w-[260px] rounded-2xl border border-white/10 bg-black/70 p-4 text-white shadow-2xl backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
          Places I&apos;ve Visited
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {visited.length === 0 ? (
            <li className="text-sm text-white/40">Tour starting…</li>
          ) : (
            visited.map((c) => (
              <li key={c.match} className="flex items-center gap-2.5 text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-base leading-none">{c.flag}</span>
                <span className="font-medium">{c.displayName}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
        {status} · press <span className="font-semibold text-white">R</span> to
        replay
      </div>
    </div>
  );
}
