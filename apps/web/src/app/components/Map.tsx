"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import type { MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  type Pin,
} from "../lib/pins";
import { initialViewFromPins } from "../lib/mapView";
import { STYLE, STYLE_URL, applyHomeMapStyle } from "../lib/mapStyle";
import { SOCIAL_ICON_SVG } from "./socialIcons";

// Same-origin worker so Turbopack/Next can load vector tiles reliably.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const TOOLTIP_MIN_ZOOM = 10;
const PIN_SVG = `
  <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0z"
      fill="${STYLE.pin}"
      stroke="${STYLE.pinStroke}"
      stroke-width="1"
    />
    <circle cx="15" cy="14" r="5.5" fill="#FFFFFF"/>
  </svg>
`;

const DRAFT_PIN_SVG = `
  <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0z"
      fill="#F59E0B"
      stroke="#B45309"
      stroke-width="1"
      stroke-dasharray="3 2"
    />
    <circle cx="15" cy="14" r="5.5" fill="#FFFFFF"/>
  </svg>
`;

const GOOGLE_MAPS_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;

function googleMapsUrl(lngLat: [number, number]): string {
  const [lng, lat] = lngLat;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function createPinTooltipContent(pin: Pin) {
  const root = document.createElement("div");
  root.className = "pin-tooltip-inner";

  if (pin.name) {
    const title = document.createElement("div");
    title.className = "pin-tooltip-title";
    title.textContent = pin.name;
    root.appendChild(title);
  }

  const row = document.createElement("div");
  row.className = "pin-tooltip-links";

  const links = SOCIAL_PLATFORMS.filter((p) => pin.links[p]);
  for (const platform of links) {
    const href = pin.links[platform]!;
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "pin-tooltip-link";
    const label = pin.name
      ? `${pin.name} on ${SOCIAL_LABELS[platform]}`
      : SOCIAL_LABELS[platform];
    a.setAttribute("aria-label", label);
    // Keep link clicks from toggling the wrap open/closed
    a.addEventListener("click", (e) => e.stopPropagation());
    a.innerHTML = SOCIAL_ICON_SVG[platform];
    row.appendChild(a);
  }

  const maps = document.createElement("a");
  maps.href = googleMapsUrl(pin.lngLat);
  maps.target = "_blank";
  maps.rel = "noopener noreferrer";
  maps.className = "pin-tooltip-link";
  maps.setAttribute(
    "aria-label",
    pin.name ? `${pin.name} on Google Maps` : "Open in Google Maps",
  );
  maps.addEventListener("click", (e) => e.stopPropagation());
  maps.innerHTML = GOOGLE_MAPS_ICON_SVG;
  row.appendChild(maps);

  root.appendChild(row);

  return root;
}

function closeOpenPinTooltips(except?: HTMLElement) {
  document.querySelectorAll(".pin-wrap.is-open").forEach((node) => {
    if (except && node === except) return;
    node.classList.remove("is-open");
  });
}

function createPinElement(pin: Pin, getMap: () => MapLibreMap | null) {
  const wrap = document.createElement("div");
  wrap.className = "pin-wrap";
  wrap.tabIndex = 0;
  if (pin.name) wrap.setAttribute("aria-label", pin.name);
  else wrap.setAttribute("aria-label", "Video pin");

  const pinEl = document.createElement("div");
  pinEl.className = "custom-map-pin";
  pinEl.innerHTML = PIN_SVG;

  const tooltip = document.createElement("div");
  tooltip.className = "pin-tooltip";
  tooltip.appendChild(createPinTooltipContent(pin));

  wrap.appendChild(tooltip);
  wrap.appendChild(pinEl);

  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    const map = getMap();
    if (map && map.getZoom() < TOOLTIP_MIN_ZOOM) {
      closeOpenPinTooltips();
      map.easeTo({
        center: pin.lngLat,
        zoom: TOOLTIP_MIN_ZOOM,
        duration: 1200,
      });
      return;
    }
    const willOpen = !wrap.classList.contains("is-open");
    closeOpenPinTooltips(wrap);
    wrap.classList.toggle("is-open", willOpen);
  });

  return wrap;
}

function clearMarkers(markers: Marker[]) {
  for (const marker of markers) marker.remove();
}

export type MapProps = {
  pins: Pin[];
  picking?: boolean;
  onMapClick?: (lngLat: [number, number]) => void;
  draftLngLat?: [number, number] | null;
  focusTarget?: [number, number] | null;
};

export default function Map({
  pins,
  picking = false,
  onMapClick,
  draftLngLat = null,
  focusTarget = null,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const draftMarkerRef = useRef<Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const pickingRef = useRef(picking);
  // Capture initial camera once so later pin add/delete does not re-center.
  const initialViewRef = useRef(initialViewFromPins(pins));

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    pickingRef.current = picking;
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = picking ? "crosshair" : "";
  }, [picking]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const { center, zoom } = initialViewRef.current;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-left");

    const syncTooltipZoomGate = () => {
      const enabled = map.getZoom() >= TOOLTIP_MIN_ZOOM;
      map.getContainer().classList.toggle("map-tooltips-enabled", enabled);
      if (!enabled) closeOpenPinTooltips();
    };

    const onLoad = () => {
      try {
        applyHomeMapStyle(map);
      } catch (err) {
        console.error("Failed to apply map label hierarchy", err);
      }
      map.resize();
      syncTooltipZoomGate();
    };

    const handleClick = (e: MapMouseEvent) => {
      // Dismiss open pin tooltips when clicking the map (not a pin)
      closeOpenPinTooltips();
      if (!pickingRef.current) return;
      onMapClickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
    };

    map.on("load", onLoad);
    map.on("zoom", syncTooltipZoomGate);
    map.on("zoomend", syncTooltipZoomGate);
    map.on("click", handleClick);
    map.on("error", (e) => {
      console.error("MapLibre error", e.error ?? e);
    });

    mapRef.current = map;
    syncTooltipZoomGate();

    return () => {
      map.off("load", onLoad);
      map.off("zoom", syncTooltipZoomGate);
      map.off("zoomend", syncTooltipZoomGate);
      map.off("click", handleClick);
      clearMarkers(markersRef.current);
      markersRef.current = [];
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyMarkers = () => {
      clearMarkers(markersRef.current);
      markersRef.current = pins.map((pin) =>
        new Marker({
          element: createPinElement(pin, () => mapRef.current),
          anchor: "bottom",
        })
          .setLngLat(pin.lngLat)
          .addTo(map),
      );
    };

    if (map.isStyleLoaded()) {
      applyMarkers();
    } else {
      map.once("load", applyMarkers);
      return () => {
        map.off("load", applyMarkers);
      };
    }
  }, [pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget) return;

    const fly = () => {
      map.flyTo({
        center: focusTarget,
        zoom: Math.max(map.getZoom(), 13),
        essential: true,
      });
    };

    if (map.isStyleLoaded()) {
      fly();
    } else {
      map.once("load", fly);
      return () => {
        map.off("load", fly);
      };
    }
  }, [focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearDraft = () => {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
    };

    if (!draftLngLat) {
      clearDraft();
      return;
    }

    const applyDraft = () => {
      if (!draftMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "custom-map-pin draft-map-pin";
        el.innerHTML = DRAFT_PIN_SVG;
        el.setAttribute("aria-label", "Draft pin location");
        draftMarkerRef.current = new Marker({
          element: el,
          anchor: "bottom",
        });
      }
      draftMarkerRef.current.setLngLat(draftLngLat).addTo(map);
    };

    if (map.isStyleLoaded()) {
      applyDraft();
    } else {
      map.once("load", applyDraft);
      return () => {
        map.off("load", applyDraft);
      };
    }
  }, [draftLngLat]);

  useEffect(() => {
    return () => {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full${picking ? " map-picking" : ""}`}
      style={{ height: "100%", width: "100%" }}
    />
  );
}
