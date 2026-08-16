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
import { buildRouteLine, pointAlongLine } from "../../lib/flights/geo";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const ROUTE_SOURCE = "flight-route";
const ROUTE_LAYER = "flight-route-line";
const ROUTE_GLOW = "flight-route-glow";
const PLANE_SOURCE = "flight-plane";
const ANIM_MS = 4200;

type Props = {
  airports: string[];
  originFallback: string;
  destFallback: string;
};

function airportMarkerEl(code: string, kind: "origin" | "stop" | "dest") {
  const el = document.createElement("div");
  el.className = "flex flex-col items-center";
  const colors = {
    origin: { bg: "#0f172a", ring: "#38bdf8" },
    stop: { bg: "#475569", ring: "#94a3b8" },
    dest: { bg: "#0f172a", ring: "#f59e0b" },
  }[kind];
  el.innerHTML = `
    <div style="
      width: 34px; height: 34px; border-radius: 9999px;
      background: ${colors.bg}; color: white; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 3px ${colors.ring}, 0 8px 20px rgba(15,23,42,0.35);
      letter-spacing: 0.04em;
    ">${code}</div>
  `;
  return el;
}

function planeEl() {
  const el = document.createElement("div");
  el.innerHTML = `
    <div style="
      width: 28px; height: 28px; border-radius: 9999px;
      background: #0f172a; color: white;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 16px rgba(15,23,42,0.4);
      transform: rotate(0deg);
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const planeRef = useRef<Marker | null>(null);
  const rafRef = useRef<number | null>(null);

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
    const bounds = new LngLatBounds();
    for (const p of points) bounds.extend(p.lngLat);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 72, maxZoom: 5, duration: 0 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const cleanupMarkers = () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      planeRef.current?.remove();
      planeRef.current = null;
    };

    const startAnimation = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const started = performance.now();

      const tick = (now: number) => {
        const raw = (now - started) / ANIM_MS;
        // Ease in-out, then loop with a short pause feel via modulo.
        const cycle = raw % 1.15;
        const t = Math.min(1, cycle);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const { lngLat, bearing } = pointAlongLine(line, eased);

        if (planeRef.current) {
          planeRef.current.setLngLat(lngLat);
          const root = planeRef.current.getElement().firstElementChild as
            | HTMLElement
            | null;
          if (root) root.style.transform = `rotate(${bearing}deg)`;
        }

        const src = map.getSource(PLANE_SOURCE) as GeoJSONSource | undefined;
        src?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: lngLat },
        });

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    map.on("load", () => {
      cleanupMarkers();

      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: line },
        },
      });

      map.addLayer({
        id: ROUTE_GLOW,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 8,
          "line-opacity": 0.25,
          "line-blur": 2,
        },
      });

      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#0f172a",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      map.addSource(PLANE_SOURCE, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: line[0] },
        },
      });

      points.forEach((p, i) => {
        const kind =
          i === 0 ? "origin" : i === points.length - 1 ? "dest" : "stop";
        const marker = new Marker({
          element: airportMarkerEl(p.code, kind),
          anchor: "center",
        })
          .setLngLat(p.lngLat)
          .addTo(map);
        markersRef.current.push(marker);
      });

      planeRef.current = new Marker({
        element: planeEl(),
        anchor: "center",
      })
        .setLngLat(line[0])
        .addTo(map);

      map.fitBounds(bounds, { padding: 80, maxZoom: 5, duration: 900 });
      startAnimation();
    });

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      cleanupMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [airports, originFallback, destFallback]);

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
