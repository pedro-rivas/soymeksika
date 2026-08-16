import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Facebook-style biome palette. Font glyphs: Noto Sans only. */
export const STYLE = {
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

function setZoomRange(
  map: MapLibreMap,
  layerId: string,
  minzoom: number,
  maxzoom: number = 24,
) {
  if (!map.getLayer(layerId)) return;
  map.setLayerZoomRange(layerId, minzoom, maxzoom);
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

  setPaintIfExists(map, "landcover_ice_shelf", "fill-color", STYLE.ice);
  setPaintIfExists(map, "landcover_glacier", "fill-color", STYLE.ice);
  setPaintIfExists(map, "landcover_wood", "fill-color", STYLE.wood);

  const beforeWater = map.getLayer("water") ? "water" : undefined;
  addLandcoverLayer(map, "landcover_sand", "sand", STYLE.sand, beforeWater);
  addLandcoverLayer(map, "landcover_ice", "ice", STYLE.ice, beforeWater);
  addLandcoverLayer(map, "landcover_grass", "grass", STYLE.grass, beforeWater);
  setPaintIfExists(map, "landcover_wood", "fill-color", STYLE.wood);

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
      3,
      11,
      7,
      14,
      11,
      22,
    ]);
    map.setLayoutProperty("label_city_capital", "icon-image", [
      "step",
      ["zoom"],
      "circle_11_black",
      9,
      "",
    ]);
    map.setLayoutProperty("label_city_capital", "icon-size", 0.45);
    map.setLayoutProperty("label_city_capital", "icon-allow-overlap", true);
    map.setLayoutProperty("label_city_capital", "text-anchor", "left");
    map.setLayoutProperty("label_city_capital", "text-offset", [0.6, 0]);
    map.setLayoutProperty("label_city_capital", "text-justify", "left");
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
    minzoom: 2,
    maxzoom: 5,
    layout: {
      "text-field": SPANISH_NAME,
      "text-font": ["Noto Sans Bold"],
      "text-transform": "uppercase",
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 18, 4.5, 24],
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

const TOURIST_POI_FILTER: ExpressionSpecification = [
  "all",
  ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
  [
    "any",
    [
      "match",
      ["get", "class"],
      ["attraction", "art_gallery", "castle", "zoo", "park", "stadium"],
      true,
      false,
    ],
    [
      "match",
      ["get", "subclass"],
      [
        "museum",
        "attraction",
        "viewpoint",
        "theme_park",
        "gallery",
        "monument",
        "memorial",
        "artwork",
        "castle",
        "zoo",
      ],
      true,
      false,
    ],
  ],
];

const TOURIST_POI_ICON: ExpressionSpecification = [
  "match",
  ["get", "subclass"],
  [
    "museum",
    "viewpoint",
    "theme_park",
    "monument",
    "memorial",
    "artwork",
    "gallery",
  ],
  ["get", "subclass"],
  ["get", "class"],
];

function addTouristPoiLayer(
  map: MapLibreMap,
  id: string,
  minzoom: number,
  rankFilter: ExpressionSpecification,
) {
  if (map.getLayer(id) || !map.getSource("openmaptiles")) return;

  map.addLayer({
    id,
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "poi",
    minzoom,
    filter: ["all", TOURIST_POI_FILTER, rankFilter],
    layout: {
      "icon-image": TOURIST_POI_ICON,
      "icon-size": 0.9,
      "icon-optional": true,
      "icon-allow-overlap": false,
      "text-field": SPANISH_NAME,
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 0.65],
      "text-max-width": 9,
      "text-optional": true,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#374151",
      "text-halo-color": STYLE.halo,
      "text-halo-width": 1.25,
      "text-halo-blur": 0.5,
    },
  });
}

function applyTouristPois(map: MapLibreMap) {
  addTouristPoiLayer(map, "tourist_poi_important", 12, [
    "all",
    [">=", ["get", "rank"], 1],
    ["<", ["get", "rank"], 7],
  ]);
  addTouristPoiLayer(map, "tourist_poi_mid", 14, [
    "all",
    [">=", ["get", "rank"], 7],
    ["<", ["get", "rank"], 20],
  ]);
  addTouristPoiLayer(map, "tourist_poi_dense", 16, [
    ">=",
    ["get", "rank"],
    20,
  ]);
}

/** Same pastel basemap + label hierarchy used on the home map. */
export function applyHomeMapStyle(map: MapLibreMap) {
  applyPastelBasemap(map);
  applySpanishNames(map);
  applyLabelStyles(map);
  addContinentLabels(map);
  applyTouristPois(map);

  setZoomRange(map, "label_continent", 2, 5);
  setZoomRange(map, "label_country_1", 4.5, 9);
  setZoomRange(map, "label_country_2", 4.5, 9);
  setZoomRange(map, "label_country_3", 5, 9);
  setZoomRange(map, "label_state", 6, 8);
  setZoomRange(map, "label_city_capital", 3, 22);
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
}
