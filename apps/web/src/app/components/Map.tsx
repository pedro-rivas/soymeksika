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

/** Facebook-style biome palette. Font glyphs: Noto Sans only. */
const STYLE = {
  land: "#B6F09E",
  water: "#7CDCFD",
  waterway: "#A8E4FF",
  sand: "#FFF9D1",
  ice: "#F7FFFE",
  grass: "#B8F19F",
  wood: "#A8E88A",
  urban: "#F5F1E6",
  building: "#F0EBE3",
  park: "#E8F5E9",
  border: "#B0B0B0",
  roadCasing: "#D5D5D5",
  roadInner: "#FFFFFF",
  roadMinor: "#E8E8E8",
  continent: "#FFFFFF",
  continentHalo: "rgba(40,40,40,0.75)",
  country: "#8A593E",
  city: "#202124",
  town: "#2D2D2D",
  neighborhood: "#70757A",
  halo: "#FFFFFF",
  pin: "#007AFF",
  pinStroke: "#0056B3",
} as const;

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
      fill="${STYLE.pin}"
      stroke="${STYLE.pinStroke}"
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

function setPaintIfExists(
  map: MapLibreMap,
  layerId: string,
  prop: string,
  value: unknown,
) {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(
      layerId,
      prop as Parameters<MapLibreMap["setPaintProperty"]>[1],
      value as Parameters<MapLibreMap["setPaintProperty"]>[2],
    );
  } catch {
    // Layer may not support this paint property.
  }
}

function addLandcoverLayer(
  map: MapLibreMap,
  id: string,
  className: string,
  color: string,
  beforeId?: string,
) {
  if (map.getLayer(id) || !map.getSource("openmaptiles")) return;

  map.addLayer(
    {
      id,
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      maxzoom: 14,
      filter: [
        "all",
        ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        ["==", ["get", "class"], className],
      ],
      paint: {
        "fill-color": color,
        "fill-opacity": 1,
      },
    },
    beforeId && map.getLayer(beforeId) ? beforeId : undefined,
  );
}

function applyPastelBasemap(map: MapLibreMap) {
  setPaintIfExists(map, "background", "background-color", STYLE.land);
  setPaintIfExists(map, "water", "fill-color", STYLE.water);
  setPaintIfExists(map, "waterway", "line-color", STYLE.waterway);
  setPaintIfExists(map, "landuse_residential", "fill-color", STYLE.urban);
  setPaintIfExists(map, "building", "fill-color", STYLE.building);
  setPaintIfExists(map, "park", "fill-color", STYLE.park);

  // Ice (existing Positron layers + class=ice)
  setPaintIfExists(map, "landcover_ice_shelf", "fill-color", STYLE.ice);
  setPaintIfExists(map, "landcover_glacier", "fill-color", STYLE.ice);
  setPaintIfExists(map, "landcover_wood", "fill-color", STYLE.wood);

  // Insert biome fills under water so oceans stay on top of landcover
  const beforeWater = map.getLayer("water") ? "water" : undefined;
  addLandcoverLayer(map, "landcover_sand", "sand", STYLE.sand, beforeWater);
  addLandcoverLayer(map, "landcover_ice", "ice", STYLE.ice, beforeWater);
  addLandcoverLayer(map, "landcover_grass", "grass", STYLE.grass, beforeWater);
  setPaintIfExists(map, "landcover_wood", "fill-color", STYLE.wood);

  // Soften borders for a flatter Facebook-like look
  for (const id of ["boundary_2", "boundary_3", "boundary_disputed"]) {
    setPaintIfExists(map, id, "line-color", STYLE.border);
    setPaintIfExists(map, id, "line-opacity", [
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      0.15,
      6,
      0.35,
      10,
      0.55,
    ]);
  }

  for (const id of [
    "highway_major_casing",
    "highway_motorway_casing",
    "highway_motorway_bridge_casing",
    "tunnel_motorway_casing",
  ]) {
    setPaintIfExists(map, id, "line-color", STYLE.roadCasing);
  }
  for (const id of [
    "highway_major_inner",
    "highway_motorway_inner",
    "highway_motorway_bridge_inner",
    "tunnel_motorway_inner",
  ]) {
    setPaintIfExists(map, id, "line-color", STYLE.roadInner);
  }
  setPaintIfExists(map, "highway_minor", "line-color", STYLE.roadMinor);
  setPaintIfExists(map, "highway_path", "line-color", STYLE.roadMinor);
}

function applyLabelStyles(map: MapLibreMap) {
  for (const id of ["label_country_1", "label_country_2", "label_country_3"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "text-color", STYLE.country);
    map.setPaintProperty(id, "text-halo-color", STYLE.halo);
    map.setPaintProperty(id, "text-halo-width", 1.5);
    map.setLayoutProperty(id, "text-transform", "uppercase");
    map.setLayoutProperty(id, "text-font", ["Noto Sans Bold"]);
    map.setLayoutProperty(id, "text-letter-spacing", 0.06);
  }

  for (const id of ["label_city_capital", "label_city"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "text-color", STYLE.city);
    map.setPaintProperty(id, "text-halo-color", STYLE.halo);
    map.setPaintProperty(id, "text-halo-width", 1.5);
    map.setLayoutProperty(id, "text-font", ["Noto Sans Bold"]);
    map.setLayoutProperty(id, "text-transform", "none");
  }

  if (map.getLayer("label_city_capital")) {
    map.setLayoutProperty("label_city_capital", "text-size", [
      "interpolate",
      ["exponential", 1.2],
      ["zoom"],
      7,
      14,
      11,
      22,
    ]);
  }
  if (map.getLayer("label_city")) {
    map.setLayoutProperty("label_city", "text-size", [
      "interpolate",
      ["exponential", 1.2],
      ["zoom"],
      7.5,
      12,
      11,
      18,
    ]);
  }

  for (const id of ["label_town", "label_village"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "text-color", STYLE.town);
    map.setPaintProperty(id, "text-halo-color", STYLE.halo);
    map.setPaintProperty(id, "text-halo-width", 1.25);
    map.setLayoutProperty(id, "text-font", ["Noto Sans Regular"]);
  }

  if (map.getLayer("label_town")) {
    map.setLayoutProperty("label_town", "text-size", [
      "interpolate",
      ["exponential", 1.2],
      ["zoom"],
      10,
      11,
      13,
      14,
    ]);
  }
  if (map.getLayer("label_village")) {
    map.setLayoutProperty("label_village", "text-size", [
      "interpolate",
      ["exponential", 1.2],
      ["zoom"],
      12,
      10,
      14,
      12,
    ]);
  }

  if (map.getLayer("label_other")) {
    map.setPaintProperty("label_other", "text-color", STYLE.neighborhood);
    map.setPaintProperty("label_other", "text-halo-color", STYLE.halo);
    map.setPaintProperty("label_other", "text-halo-width", 1);
    map.setLayoutProperty("label_other", "text-transform", "uppercase");
    map.setLayoutProperty("label_other", "text-font", ["Noto Sans Regular"]);
    map.setLayoutProperty("label_other", "text-letter-spacing", 0.04);
  }

  if (map.getLayer("label_state")) {
    map.setPaintProperty("label_state", "text-color", STYLE.country);
    map.setPaintProperty("label_state", "text-halo-color", STYLE.halo);
    map.setPaintProperty("label_state", "text-halo-width", 1.5);
    map.setLayoutProperty("label_state", "text-transform", "uppercase");
    map.setLayoutProperty("label_state", "text-font", ["Noto Sans Bold"]);
    map.setLayoutProperty("label_state", "text-letter-spacing", 0.06);
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
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 20, 4.5, 24],
      "text-max-width": 10,
      "text-letter-spacing": 0.16,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": STYLE.continent,
      "text-halo-color": STYLE.continentHalo,
      "text-halo-width": 2,
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
