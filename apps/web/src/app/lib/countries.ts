export interface CountryProperties {
  NAME?: string;
  NAME_LONG?: string;
  ISO_A2?: string;
  CONTINENT?: string;
  [key: string]: unknown;
}

export type CountryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }
  | { type: string; coordinates?: unknown };

export interface CountryFeature {
  type: "Feature";
  properties: CountryProperties;
  geometry: CountryGeometry;
}

export interface CountryCollection {
  type: "FeatureCollection";
  features: CountryFeature[];
}

export interface CountrySummary {
  name: string;
  iso2: string;
  continent: string;
}

export type CountryBounds = [[number, number], [number, number]];

let cache: Promise<CountryCollection> | null = null;

export function loadCountries(): Promise<CountryCollection> {
  if (!cache) {
    cache = fetch("/data/countries.geojson").then((res) => {
      if (!res.ok) {
        cache = null;
        throw new Error(`Failed to load countries.geojson (${res.status})`);
      }
      return res.json() as Promise<CountryCollection>;
    });
  }
  return cache;
}

export function listCountries(data: CountryCollection): CountrySummary[] {
  const byName = new Map<string, CountrySummary>();
  for (const feature of data.features) {
    const { NAME, ISO_A2, CONTINENT } = feature.properties;
    if (typeof NAME !== "string" || NAME.length === 0 || byName.has(NAME)) {
      continue;
    }
    byName.set(NAME, {
      name: NAME,
      iso2: typeof ISO_A2 === "string" ? ISO_A2 : "",
      continent: typeof CONTINENT === "string" ? CONTINENT : "",
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findCountry(
  data: CountryCollection,
  name: string,
): CountryFeature | undefined {
  return data.features.find((f) => f.properties.NAME === name);
}

/**
 * Minimal-arc bounding box: longitudes are wrapped onto the shortest arc that
 * contains the country, so antimeridian-spanning countries (Russia, Fiji, USA
 * via Alaska) frame correctly instead of zooming out to the whole world. When
 * the arc crosses 180°, the east edge stays above 180°, which MapLibre treats
 * as a wrapped longitude.
 */
export function countryBounds(feature: CountryFeature): CountryBounds | null {
  const longitudes: number[] = [];
  let minLat = Infinity;
  let maxLat = -Infinity;

  const walk = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords as [number, number];
      longitudes.push(lng);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const child of coords) walk(child);
  };
  walk(feature.geometry.coordinates);

  if (longitudes.length === 0 || !Number.isFinite(minLat)) return null;

  const sorted = longitudes
    .map((lng) => ((lng % 360) + 360) % 360)
    .sort((a, b) => a - b);

  let widestGap = -1;
  let arcStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1];
    const gap = next - sorted[i];
    if (gap > widestGap) {
      widestGap = gap;
      arcStart = (i + 1) % sorted.length;
    }
  }

  let west = sorted[arcStart];
  let east = sorted[(arcStart - 1 + sorted.length) % sorted.length];
  if (east <= west) east += 360;
  if (west > 180) {
    west -= 360;
    east -= 360;
  }

  return [
    [west, Math.max(minLat, -85)],
    [east, Math.min(maxLat, 85)],
  ];
}
