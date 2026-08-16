import type { Map as MapLibreMap } from "maplibre-gl";
import type { CountryBounds, CountryFeature } from "../countries";
import { countryBounds } from "../countries";

export const FLAG_SOURCE_ID = "country-flag-overlay";
export const FLAG_LAYER_ID = "country-flag-overlay-layer";

const MAX_CANVAS = 1024;

function normalizeIso(iso2: string): string | null {
  const iso = iso2.trim().toLowerCase();
  if (iso.length !== 2 || iso === "-99") return null;
  if (!/^[a-z]{2}$/.test(iso)) return null;
  return iso;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load flag: ${url}`));
    img.src = url;
  });
}

type LngLat = [number, number];

function projectToCanvas(
  lng: number,
  lat: number,
  bounds: CountryBounds,
  width: number,
  height: number,
): { x: number; y: number } {
  const [[west, south], [east, north]] = bounds;
  const x = ((lng - west) / (east - west)) * width;
  const y = ((north - lat) / (north - south)) * height;
  return { x, y };
}

function drawCountryClipPath(
  ctx: CanvasRenderingContext2D,
  feature: CountryFeature,
  bounds: CountryBounds,
  width: number,
  height: number,
): void {
  const geometry = feature.geometry;
  const polygons: LngLat[][][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates as LngLat[][]]
      : geometry.type === "MultiPolygon"
        ? (geometry.coordinates as LngLat[][][])
        : [];

  ctx.beginPath();
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (ring.length === 0) continue;
      const first = projectToCanvas(ring[0][0], ring[0][1], bounds, width, height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < ring.length; i++) {
        const p = projectToCanvas(ring[i][0], ring[i][1], bounds, width, height);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    }
  }
}

/**
 * Builds one flag image stretched over the country bbox and clipped to the
 * country polygon, then installs it as a MapLibre image source (not tiled).
 */
export async function installFlagOverlay(
  map: MapLibreMap,
  feature: CountryFeature,
  iso2: string,
): Promise<boolean> {
  const iso = normalizeIso(iso2);
  const bounds = countryBounds(feature);
  if (!iso || !bounds) return false;

  const [[west, south], [east, north]] = bounds;
  if (!(east > west) || !(north > south)) return false;

  try {
    const img = await loadImageElement(
      `https://flagcdn.com/w1280/${iso}.png`,
    );

    const lngSpan = east - west;
    const latSpan = north - south;
    const aspect = lngSpan / Math.max(latSpan, 1e-6);
    let width: number;
    let height: number;
    if (aspect >= 1) {
      width = MAX_CANVAS;
      height = Math.max(64, Math.round(MAX_CANVAS / aspect));
    } else {
      height = MAX_CANVAS;
      width = Math.max(64, Math.round(MAX_CANVAS * aspect));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    // Stretch a single flag across the country bounding box…
    ctx.drawImage(img, 0, 0, width, height);
    // …then keep only pixels inside the country outline.
    ctx.globalCompositeOperation = "destination-in";
    drawCountryClipPath(ctx, feature, bounds, width, height);
    ctx.fill("evenodd");
    ctx.globalCompositeOperation = "source-over";

    const dataUrl = canvas.toDataURL("image/png");
    removeFlagOverlay(map);

    map.addSource(FLAG_SOURCE_ID, {
      type: "image",
      url: dataUrl,
      coordinates: [
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ],
    });

    // Sit under the glow/line layers so the amber outline still frames it.
    const beforeId = map.getLayer("country-highlight-glow")
      ? "country-highlight-glow"
      : undefined;

    map.addLayer(
      {
        id: FLAG_LAYER_ID,
        type: "raster",
        source: FLAG_SOURCE_ID,
        paint: {
          "raster-opacity": 0,
          "raster-fade-duration": 0,
        },
      },
      beforeId,
    );

    return true;
  } catch (err) {
    console.error("Flag overlay failed", err);
    removeFlagOverlay(map);
    return false;
  }
}

export function removeFlagOverlay(map: MapLibreMap): void {
  if (map.getLayer(FLAG_LAYER_ID)) {
    map.removeLayer(FLAG_LAYER_ID);
  }
  if (map.getSource(FLAG_SOURCE_ID)) {
    map.removeSource(FLAG_SOURCE_ID);
  }
}

export function setFlagOverlayOpacity(
  map: MapLibreMap,
  opacity: number,
): void {
  if (!map.getLayer(FLAG_LAYER_ID)) return;
  map.setPaintProperty(
    FLAG_LAYER_ID,
    "raster-opacity",
    Math.min(1, Math.max(0, opacity)),
  );
}

export function hasFlagOverlay(map: MapLibreMap): boolean {
  return !!map.getLayer(FLAG_LAYER_ID);
}
