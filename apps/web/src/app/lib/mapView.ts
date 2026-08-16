import type { Pin } from "./pins";

export type MapView = {
  center: [number, number];
  zoom: number;
};

const FALLBACK_CENTER: [number, number] = [-99.15, 19.4];
/** Original map start zoom — kept for all pin counts. */
const INITIAL_ZOOM = 2;
const NEIGHBOR_RADIUS_KM = 250;
const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in km between two lng/lat points. */
function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Average lng/lat with antimeridian unwrap so points near ±180°
 * do not average toward 0.
 */
function centroid(points: [number, number][]): [number, number] {
  if (points.length === 0) return FALLBACK_CENTER;
  if (points.length === 1) return points[0];

  const refLng = points[0][0];
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of points) {
    let unwrapped = lng;
    const delta = lng - refLng;
    if (delta > 180) unwrapped = lng - 360;
    else if (delta < -180) unwrapped = lng + 360;
    sumLng += unwrapped;
    sumLat += lat;
  }
  const n = points.length;
  let avgLng = sumLng / n;
  // Normalize to [-180, 180]
  avgLng = ((avgLng + 180) % 360 + 360) % 360 - 180;
  return [avgLng, sumLat / n];
}

/**
 * Compute the initial map camera from pin locations.
 * Centers on the densest neighborhood (most pins within ~250 km)
 * at the original INITIAL_ZOOM.
 */
export function initialViewFromPins(pins: Pin[]): MapView {
  if (pins.length === 0) {
    return { center: FALLBACK_CENTER, zoom: INITIAL_ZOOM };
  }

  if (pins.length === 1) {
    return { center: pins[0].lngLat, zoom: INITIAL_ZOOM };
  }

  const coords = pins.map((p) => p.lngLat);

  let bestNeighbors: [number, number][] = [];
  for (let i = 0; i < coords.length; i++) {
    const neighbors: [number, number][] = [];
    for (let j = 0; j < coords.length; j++) {
      if (haversineKm(coords[i], coords[j]) <= NEIGHBOR_RADIUS_KM) {
        neighbors.push(coords[j]);
      }
    }
    if (neighbors.length > bestNeighbors.length) {
      bestNeighbors = neighbors;
    }
  }

  return { center: centroid(bestNeighbors), zoom: INITIAL_ZOOM };
}
