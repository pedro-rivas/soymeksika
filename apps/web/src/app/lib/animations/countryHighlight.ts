import type {
  FilterSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { CountryBounds, CountryCollection, CountryFeature } from "../countries";
import { countryBounds } from "../countries";

export type HighlightPhase =
  | "idle"
  | "arriving"
  | "highlighting"
  | "holding"
  | "closing";

export const COUNTRY_SOURCE_ID = "countries";

export const COUNTRY_LAYERS = {
  hit: "country-hit",
  dim: "country-dim",
  fill: "country-highlight-fill",
  glow: "country-highlight-glow",
  line: "country-highlight-line",
} as const;

const COLORS = {
  dim: "#0F172A",
  fill: "#FF9F1C",
  glow: "#FFB84D",
  line: "#FFE3AE",
} as const;

const NO_COUNTRY = "__none__";

const FLY_MS = 2600;
const HIGHLIGHT_MS = 900;
const DIM_MS = 900;
const HOLD_MS = 700;
const CLOSE_MS = 1100;
const MAX_COUNTRY_ZOOM = 5.5;

type GeoJSONSourceSpec = Extract<
  Parameters<MapLibreMap["addSource"]>[1],
  { type: "geojson" }
>;

interface StopToken {
  stopped: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function animate(
  durationMs: number,
  token: StopToken,
  onFrame: (t: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      if (token.stopped) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      onFrame(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function installCountryLayers(
  map: MapLibreMap,
  data: CountryCollection,
): void {
  if (map.getSource(COUNTRY_SOURCE_ID)) return;
  map.addSource(COUNTRY_SOURCE_ID, {
    type: "geojson",
    data,
  } as unknown as GeoJSONSourceSpec);

  const empty: FilterSpecification = ["==", ["get", "NAME"], NO_COUNTRY];

  map.addLayer({
    id: COUNTRY_LAYERS.hit,
    type: "fill",
    source: COUNTRY_SOURCE_ID,
    paint: { "fill-color": "#000000", "fill-opacity": 0 },
  });

  map.addLayer({
    id: COUNTRY_LAYERS.dim,
    type: "fill",
    source: COUNTRY_SOURCE_ID,
    filter: ["!=", ["get", "NAME"], NO_COUNTRY],
    paint: { "fill-color": COLORS.dim, "fill-opacity": 0 },
  });

  map.addLayer({
    id: COUNTRY_LAYERS.fill,
    type: "fill",
    source: COUNTRY_SOURCE_ID,
    filter: empty,
    paint: { "fill-color": COLORS.fill, "fill-opacity": 0 },
  });

  map.addLayer({
    id: COUNTRY_LAYERS.glow,
    type: "line",
    source: COUNTRY_SOURCE_ID,
    filter: empty,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": COLORS.glow,
      "line-width": 4,
      "line-blur": 4,
      "line-opacity": 0,
    },
  });

  map.addLayer({
    id: COUNTRY_LAYERS.line,
    type: "line",
    source: COUNTRY_SOURCE_ID,
    filter: empty,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": COLORS.line,
      "line-width": 2,
      "line-opacity": 0,
    },
  });
}

function prepareLayers(map: MapLibreMap, name: string): void {
  const selected: FilterSpecification = ["==", ["get", "NAME"], name];
  const others: FilterSpecification = ["!=", ["get", "NAME"], name];
  map.setFilter(COUNTRY_LAYERS.fill, selected);
  map.setFilter(COUNTRY_LAYERS.glow, selected);
  map.setFilter(COUNTRY_LAYERS.line, selected);
  map.setFilter(COUNTRY_LAYERS.dim, others);
}

function resetCountryLayers(map: MapLibreMap): void {
  if (!map.getLayer(COUNTRY_LAYERS.fill)) return;
  prepareLayers(map, NO_COUNTRY);
  map.setPaintProperty(COUNTRY_LAYERS.dim, "fill-opacity", 0);
  map.setPaintProperty(COUNTRY_LAYERS.fill, "fill-opacity", 0);
  map.setPaintProperty(COUNTRY_LAYERS.glow, "line-opacity", 0);
  map.setPaintProperty(COUNTRY_LAYERS.line, "line-opacity", 0);
}

function flyToCountry(
  map: MapLibreMap,
  bounds: CountryBounds,
): Promise<void> {
  return new Promise((resolve) => {
    const canvas = map.getCanvas();
    const padding = Math.round(
      Math.min(canvas.clientWidth, canvas.clientHeight) * 0.16,
    );
    map.once("moveend", () => resolve());
    map.fitBounds(bounds, {
      padding,
      duration: FLY_MS,
      maxZoom: MAX_COUNTRY_ZOOM,
      essential: true,
    });
  });
}

async function highlightIn(map: MapLibreMap, token: StopToken): Promise<void> {
  const dimRamp = animate(DIM_MS, token, (t) => {
    map.setPaintProperty(
      COUNTRY_LAYERS.dim,
      "fill-opacity",
      lerp(0, 0.32, easeOutCubic(t)),
    );
  });

  const fillRamp = animate(HIGHLIGHT_MS, token, (raw) => {
    const t = easeOutCubic(raw);
    map.setPaintProperty(COUNTRY_LAYERS.fill, "fill-opacity", lerp(0, 0.4, t));
    map.setPaintProperty(COUNTRY_LAYERS.line, "line-opacity", lerp(0, 1, t));
    map.setPaintProperty(COUNTRY_LAYERS.line, "line-width", lerp(1.4, 2.2, t));
    map.setPaintProperty(COUNTRY_LAYERS.glow, "line-opacity", lerp(0, 0.22, t));
    map.setPaintProperty(COUNTRY_LAYERS.glow, "line-width", lerp(4, 9, t));
    map.setPaintProperty(COUNTRY_LAYERS.glow, "line-blur", lerp(2, 6, t));
  });

  await Promise.all([dimRamp, fillRamp]);
}

async function hold(_map: MapLibreMap, _token: StopToken): Promise<void> {
  await wait(HOLD_MS);
}

async function closeOut(map: MapLibreMap, token: StopToken): Promise<void> {
  await animate(CLOSE_MS, token, (raw) => {
    const t = easeInOutCubic(raw);
    map.setPaintProperty(COUNTRY_LAYERS.fill, "fill-opacity", lerp(0.4, 0, t));
    map.setPaintProperty(COUNTRY_LAYERS.line, "line-opacity", lerp(1, 0, t));
    map.setPaintProperty(COUNTRY_LAYERS.glow, "line-opacity", lerp(0.22, 0, t));
    map.setPaintProperty(COUNTRY_LAYERS.dim, "fill-opacity", lerp(0.32, 0, t));
  });
}

/**
 * Plays the "Country Highlight" travel intro: fly to the country, dim the
 * rest of the world, fade in a glowing highlight, hold, then close the
 * highlight out so the next animation can take over.
 */
export class CountryHighlightPlayer {
  private token: StopToken | null = null;

  async play(
    map: MapLibreMap,
    feature: CountryFeature,
    onPhase?: (phase: HighlightPhase) => void,
  ): Promise<void> {
    this.stop(map);
    const token: StopToken = { stopped: false };
    this.token = token;
    const setPhase = (phase: HighlightPhase) => {
      if (!token.stopped) onPhase?.(phase);
    };

    const name =
      typeof feature.properties.NAME === "string" ? feature.properties.NAME : "";
    const bounds = countryBounds(feature);

    prepareLayers(map, name);

    try {
      if (bounds) {
        setPhase("arriving");
        await flyToCountry(map, bounds);
        if (token.stopped) return;
      }

      setPhase("highlighting");
      await highlightIn(map, token);
      if (token.stopped) return;

      setPhase("holding");
      await hold(map, token);
      if (token.stopped) return;

      setPhase("closing");
      await closeOut(map, token);
      if (token.stopped) return;
    } finally {
      if (this.token === token) this.token = null;
      resetCountryLayers(map);
      if (!token.stopped) onPhase?.("idle");
    }
  }

  stop(map?: MapLibreMap): void {
    if (!this.token) return;
    this.token.stopped = true;
    this.token = null;
    if (map) {
      map.stop();
      resetCountryLayers(map);
    }
  }
}
