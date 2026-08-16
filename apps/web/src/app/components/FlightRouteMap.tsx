"use client";

import { useEffect, useRef } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
} from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveAirports } from "../../lib/flights/airports";
import {
  airportFractions,
  buildRouteLine,
  pointAlongLine,
} from "../../lib/flights/geo";
import { STYLE_URL, applyHomeMapStyle } from "../lib/mapStyle";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const ROUTE_SOURCE = "flight-route";
const ROUTE_AHEAD_SOURCE = "flight-route-ahead";
const ROUTE_LAYER = "flight-route-line";
const ROUTE_GLOW = "flight-route-glow";
const ROUTE_AHEAD = "flight-route-ahead";
const ANIM_MS = 5500;
const PLANE_BEARING_OFFSET = -45;

type Props = {
  airports: string[];
  originFallback: string;
  destFallback: string;
  /** Change to remount / restart the animation. */
  replayKey?: number;
};

type MarkerKind = "origin" | "stop" | "dest";

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lineSlice(line: [number, number][], t: number): [number, number][] {
  if (line.length < 2) return line.slice();
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= 0) return [line[0]];
  if (clamped >= 1) return line.slice();

  const idx = clamped * (line.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const a = line[i];
  const b = line[Math.min(i + 1, line.length - 1)];
  const tip: [number, number] = [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
  ];
  return [...line.slice(0, i + 1), tip];
}

function asLineFeature(coordinates: [number, number][]) {
  const coords =
    coordinates.length >= 2
      ? coordinates
      : ([coordinates[0], coordinates[0]] as [number, number][]);
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: coords,
    },
  };
}

function airportMarkerEl(code: string, kind: MarkerKind) {
  const el = document.createElement("div");
  // Do NOT set transform on this root — MapLibre positions markers via transform.
  el.style.cssText = "opacity:1;";

  const colors = {
    origin: { bg: "#0f172a", ring: "#38bdf8", label: "#0ea5e9" },
    stop: { bg: "#334155", ring: "#94a3b8", label: "#64748b" },
    dest: { bg: "#0f172a", ring: "#f59e0b", label: "#d97706" },
  }[kind];

  el.innerHTML = `
    <div class="airport-marker" style="
      position:relative; display:flex; flex-direction:column; align-items:center; gap:4px;
      opacity:0; transform:scale(0.4);
      transition: opacity 280ms ease, transform 320ms cubic-bezier(0.34,1.4,0.64,1);
    ">
      <div class="pulse-ring" style="
        position:absolute; top:0; left:50%; width:42px; height:42px;
        margin-left:-21px; border-radius:9999px;
        border:2px solid ${colors.ring};
        opacity:0; transform:scale(0.85);
        transition: opacity 200ms ease, transform 400ms ease;
        pointer-events:none;
      "></div>
      <div style="
        width:40px; height:40px; border-radius:9999px;
        background:${colors.bg}; color:#fff;
        font-size:11px; font-weight:700; letter-spacing:0.04em;
        display:flex; align-items:center; justify-content:center;
        box-shadow: 0 0 0 3px ${colors.ring}, 0 10px 24px rgba(15,23,42,0.35);
        position:relative; z-index:1;
      ">${code}</div>
      <div style="
        font-size:10px; font-weight:600; color:${colors.label};
        text-transform:uppercase; letter-spacing:0.08em;
        text-shadow: 0 1px 2px rgba(255,255,255,0.9);
      ">${kind === "origin" ? "From" : kind === "dest" ? "To" : "Stop"}</div>
    </div>
  `;
  return el;
}

function showMarker(el: HTMLElement, pulse: boolean) {
  const inner = el.querySelector(".airport-marker") as HTMLElement | null;
  if (inner) {
    inner.style.opacity = "1";
    inner.style.transform = "scale(1)";
  }
  const ring = el.querySelector(".pulse-ring") as HTMLElement | null;
  if (!ring) return;
  if (pulse) {
    ring.style.opacity = "0.85";
    ring.style.transform = "scale(1.55)";
  } else {
    ring.style.opacity = "0";
    ring.style.transform = "scale(0.85)";
  }
}

function planeEl() {
  const el = document.createElement("div");
  el.style.cssText = "will-change: transform;";
  el.innerHTML = `
    <div class="plane-root" style="
      width:44px; height:44px; border-radius:9999px;
      background:#0f172a; color:#fff;
      display:flex; align-items:center; justify-content:center;
      box-shadow: 0 0 0 3px #38bdf8, 0 12px 28px rgba(15,23,42,0.45);
      transform: rotate(0deg);
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>
  `;
  return el;
}

export default function FlightRouteMap({
  airports,
  originFallback,
  destFallback,
  replayKey = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markerElsRef = useRef<HTMLElement[]>([]);
  const planeRef = useRef<Marker | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const codes =
      airports.length >= 2
        ? airports
        : [originFallback, destFallback].filter(Boolean);
    const points = resolveAirports(codes);

    if (points.length < 2) {
      return;
    }

    const line = buildRouteLine(points.map((p) => p.lngLat));
    const fractions = airportFractions(
      line,
      points.map((p) => p.lngLat),
    );
    const bounds = new LngLatBounds();
    for (const p of points) bounds.extend(p.lngLat);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 88, maxZoom: 5, duration: 0 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const cleanupMarkers = () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      markerElsRef.current = [];
      planeRef.current?.remove();
      planeRef.current = null;
    };

    const setProgress = (t: number) => {
      const src = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
      src?.setData(asLineFeature(lineSlice(line, t)));
    };

    const updateMarkersForProgress = (t: number) => {
      markerElsRef.current.forEach((el, i) => {
        const frac = fractions[i] ?? (i === 0 ? 0 : 1);
        const revealed = t + 0.02 >= frac;
        const near = Math.abs(t - frac) < 0.06;
        if (revealed) showMarker(el, near);
      });
    };

    const startAnimation = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const started = performance.now();

      setProgress(0);
      markerElsRef.current.forEach((el, i) => {
        const inner = el.querySelector(".airport-marker") as HTMLElement | null;
        if (i === 0) {
          showMarker(el, true);
        } else if (inner) {
          inner.style.opacity = "0";
          inner.style.transform = "scale(0.4)";
        }
      });

      const tick = (now: number) => {
        const elapsed = now - started;
        const done = elapsed >= ANIM_MS;
        const tRaw = done ? 1 : elapsed / ANIM_MS;
        const t = easeInOut(Math.min(1, tRaw));
        const { lngLat, bearing } = pointAlongLine(line, t);

        setProgress(t);
        updateMarkersForProgress(t);

        if (planeRef.current) {
          planeRef.current.setLngLat(lngLat);
          const root = planeRef.current
            .getElement()
            .querySelector(".plane-root") as HTMLElement | null;
          if (root) {
            root.style.transform = `rotate(${bearing + PLANE_BEARING_OFFSET}deg)`;
          }
        }

        // Play once; Replay remounts via replayKey.
        if (!done) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          // Leave dest pulsing as the resting state.
          const last = markerElsRef.current[markerElsRef.current.length - 1];
          if (last) showMarker(last, true);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    map.on("load", () => {
      cleanupMarkers();

      try {
        applyHomeMapStyle(map);
      } catch (err) {
        console.error("Failed to apply home map style", err);
      }

      map.addSource(ROUTE_AHEAD_SOURCE, {
        type: "geojson",
        data: asLineFeature(line),
      });

      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: asLineFeature([line[0]]),
      });

      map.addLayer({
        id: ROUTE_AHEAD,
        type: "line",
        source: ROUTE_AHEAD_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#94a3b8",
          "line-width": 2,
          "line-opacity": 0.45,
          "line-dasharray": [1.2, 2.2],
        },
      });

      map.addLayer({
        id: ROUTE_GLOW,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 10,
          "line-opacity": 0.35,
          "line-blur": 2.5,
        },
      });

      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#0f172a",
          "line-width": 3.5,
          "line-opacity": 0.95,
        },
      });

      points.forEach((p, i) => {
        const kind: MarkerKind =
          i === 0 ? "origin" : i === points.length - 1 ? "dest" : "stop";
        const el = airportMarkerEl(p.code, kind);
        const marker = new Marker({ element: el, anchor: "center" })
          .setLngLat(p.lngLat)
          .addTo(map);
        markersRef.current.push(marker);
        markerElsRef.current.push(el);
      });

      planeRef.current = new Marker({
        element: planeEl(),
        anchor: "center",
      })
        .setLngLat(line[0])
        .addTo(map);

      map.fitBounds(bounds, { padding: 96, maxZoom: 5, duration: 1000 });
      startTimerRef.current = window.setTimeout(startAnimation, 350);
    });

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (startTimerRef.current != null) {
        window.clearTimeout(startTimerRef.current);
      }
      cleanupMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [airports, originFallback, destFallback, replayKey]);

  const resolved = resolveAirports(
    airports.length >= 2
      ? airports
      : [originFallback, destFallback].filter(Boolean),
  );

  if (resolved.length < 2) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-100 px-6 text-center text-sm text-zinc-600">
        Couldn’t plot this route — missing airport coordinates for{" "}
        {(airports.length ? airports : [originFallback, destFallback]).join(
          " → ",
        )}
        .
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
