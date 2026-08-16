"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import type { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Same-origin worker so Turbopack/Next can load vector tiles reliably.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const CENTER: [number, number] = [-99.15, 19.4];
const INITIAL_ZOOM = 3;
const MIN_ZOOM = 3;

const SPANISH_NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:es"],
  ["get", "name:latin"],
  ["get", "name_en"],
  ["get", "name"],
];

const PINS = [
  {
    id: "zocalo",
    name: "Zócalo / Centro Histórico",
    lngLat: [-99.1332, 19.4326] as [number, number],
  },
  {
    id: "coyoacan",
    name: "Coyoacán (Frida Kahlo Museum)",
    lngLat: [-99.1625, 19.3551] as [number, number],
  },
];

const PIN_SVG = `
  <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0z"
      fill="#2A81CB"
      stroke="#1a5f9a"
      stroke-width="1"
    />
    <circle cx="15" cy="14" r="5.5" fill="#FFFFFF"/>
  </svg>
`;

function createPinElement(title: string) {
  const el = document.createElement("div");
  el.className = "custom-map-pin";
  el.title = title;
  el.innerHTML = PIN_SVG;
  return el;
}

function setZoomRange(
  map: MapLibreMap,
  layerId: string,
  minzoom: number,
  maxzoom: number = 24,
) {
  if (!map.getLayer(layerId)) return;
  map.setLayerZoomRange(layerId, minzoom, maxzoom);
}

function setVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function applySpanishNames(map: MapLibreMap) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    if (!map.getLayer(layer.id)) continue;
    const textField = map.getLayoutProperty(layer.id, "text-field");
    if (textField == null) continue;
    try {
      map.setLayoutProperty(layer.id, "text-field", SPANISH_NAME);
    } catch {
      // Some symbol layers (shields/icons) reject text-field updates.
    }
  }
}

function applyPastelBasemap(map: MapLibreMap) {
  if (map.getLayer("background")) {
    map.setPaintProperty("background", "background-color", "#dce9c9");
  }
  if (map.getLayer("water")) {
    map.setPaintProperty("water", "fill-color", "#a8d4ea");
  }
  if (map.getLayer("landuse_residential")) {
    map.setPaintProperty("landuse_residential", "fill-color", "#e8efd8");
  }
  if (map.getLayer("landcover_wood")) {
    map.setPaintProperty("landcover_wood", "fill-color", "#c5d9a8");
  }
}

function applyLabelStyles(map: MapLibreMap) {
  for (const id of ["label_country_1", "label_country_2", "label_country_3"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "text-color", "#6b5b4a");
    map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,0.85)");
    map.setPaintProperty(id, "text-halo-width", 1.5);
    map.setLayoutProperty(id, "text-transform", "uppercase");
    map.setLayoutProperty(id, "text-font", ["Noto Sans Bold"]);
  }

  for (const id of ["label_city_capital", "label_city"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "text-color", "#1a1a1a");
    map.setPaintProperty(id, "text-halo-color", "#ffffff");
    map.setPaintProperty(id, "text-halo-width", 1.25);
    map.setLayoutProperty(id, "text-font", ["Noto Sans Bold"]);
    map.setLayoutProperty(id, "text-transform", "none");
  }

  for (const id of ["label_town", "label_village"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "text-color", "#222222");
    map.setPaintProperty(id, "text-halo-color", "#ffffff");
    map.setPaintProperty(id, "text-halo-width", 1);
    map.setLayoutProperty(id, "text-font", ["Noto Sans Regular"]);
  }

  if (map.getLayer("label_other")) {
    map.setPaintProperty("label_other", "text-color", "#6b6b6b");
    map.setPaintProperty("label_other", "text-halo-color", "#ffffff");
    map.setPaintProperty("label_other", "text-halo-width", 1);
    map.setLayoutProperty("label_other", "text-transform", "uppercase");
    map.setLayoutProperty("label_other", "text-font", ["Noto Sans Regular"]);
  }

  if (map.getLayer("label_state")) {
    map.setPaintProperty("label_state", "text-color", "#6b5b4a");
    map.setLayoutProperty("label_state", "text-transform", "uppercase");
  }
}

function addContinentLabels(map: MapLibreMap) {
  if (map.getLayer("label_continent")) return;
  if (!map.getSource("openmaptiles")) return;

  map.addLayer({
    id: "label_continent",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "place",
    filter: ["==", ["get", "class"], "continent"],
    minzoom: 3,
    maxzoom: 5,
    layout: {
      "text-field": SPANISH_NAME,
      "text-font": ["Noto Sans Bold"],
      "text-transform": "uppercase",
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 18, 4.5, 22],
      "text-max-width": 10,
      "text-letter-spacing": 0.08,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "rgba(40,40,40,0.75)",
      "text-halo-width": 1.75,
    },
  });
}

/**
 * Progressive labels: continent → country → city → town → neighborhood/POI
 */
function applyLabelHierarchy(map: MapLibreMap) {
  applyPastelBasemap(map);
  applySpanishNames(map);
  applyLabelStyles(map);
  addContinentLabels(map);

  setZoomRange(map, "label_continent", 3, 5);

  // Countries appear as continents fade out
  setZoomRange(map, "label_country_1", 4.5, 9);
  setZoomRange(map, "label_country_2", 4.5, 9);
  setZoomRange(map, "label_country_3", 5, 9);

  setZoomRange(map, "label_state", 6, 8);

  setZoomRange(map, "label_city_capital", 7, 22);
  setZoomRange(map, "label_city", 7.5, 22);

  setZoomRange(map, "label_town", 10, 22);
  setZoomRange(map, "label_village", 12, 22);

  setZoomRange(map, "label_other", 13, 22);

  setZoomRange(map, "water_name_point_label", 6, 22);
  setZoomRange(map, "water_name_line_label", 6, 22);
  setZoomRange(map, "waterway_line_label", 12, 22);

  setZoomRange(map, "airport", 13, 22);
  setZoomRange(map, "highway-name-major", 13, 22);
  setZoomRange(map, "highway-name-minor", 15, 22);
  setZoomRange(map, "highway-name-path", 16, 22);
  setZoomRange(map, "highway-shield-non-us", 12, 22);
  setZoomRange(map, "highway-shield-us-interstate", 12, 22);
  setZoomRange(map, "road_shield_us", 13, 22);

  for (const id of ["poi_r1", "poi_r7", "poi_r20", "poi_transit"]) {
    setVisibility(map, id, false);
    setZoomRange(map, id, 14, 22);
  }
}

export default function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      attributionControl: { compact: true },
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-left");

    const onLoad = () => {
      try {
        applyLabelHierarchy(map);
      } catch (err) {
        console.error("Failed to apply map label hierarchy", err);
      }

      map.resize();

      markersRef.current = PINS.map((pin) =>
        new Marker({ element: createPinElement(pin.name), anchor: "bottom" })
          .setLngLat(pin.lngLat)
          .setPopup(new Popup({ offset: 28 }).setText(pin.name))
          .addTo(map),
      );
    };

    map.on("load", onLoad);
    map.on("error", (e) => {
      console.error("MapLibre error", e.error ?? e);
    });

    mapRef.current = map;

    return () => {
      map.off("load", onLoad);
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    />
  );
}
