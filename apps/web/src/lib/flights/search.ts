import {
  createQuery,
  fetchFlightsHtml,
  parse,
  Passengers,
  type Currency,
  type Flights,
} from "fast-flights-ts";

export type FlightOffer = {
  date: string;
  price: number;
  currency: string;
  airline: string;
  duration: string;
  stops: number;
  departTime: string;
  arriveTime: string;
  /** Ordered IATA codes along the itinerary (origin → stops → destination). */
  airports: string[];
};

export type FlightSearchResult = {
  origin: string;
  dest: string;
  currency: string;
  sampledDates: number;
  cheapestPerDate: FlightOffer[];
  topOffers: FlightOffer[];
  searchedAt: string;
};

type CacheEntry = {
  expiresAt: number;
  result: FlightSearchResult;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_CURRENCY: Currency = "MXN";
const DEFAULT_CONCURRENCY = 3;
const cache = new Map<string, CacheEntry>();

const SUPPORTED_CURRENCIES = new Set<string>([
  "MXN",
  "USD",
  "EUR",
  "TRY",
  "GBP",
]);

function asCurrency(value: string): Currency {
  const upper = value.toUpperCase();
  return (SUPPORTED_CURRENCIES.has(upper) ? upper : DEFAULT_CURRENCY) as Currency;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sampleDates(days: number, every: number): string[] {
  const dates: string[] = [];
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  // Start from tomorrow so same-day queries don't return empty.
  start.setUTCDate(start.getUTCDate() + 1);

  for (let offset = 0; offset < days; offset += every) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + offset);
    dates.push(formatDate(d));
  }
  return dates;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatClock(dt: { time: readonly [number, number] } | undefined): string {
  if (!dt?.time) return "";
  const [hour, minute] = dt.time;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toUtcMs(dt: {
  date: readonly [number, number, number];
  time: readonly [number, number];
}): number {
  const [y, mo, d] = dt.date;
  const [h, mi] = dt.time;
  return Date.UTC(y, mo - 1, d, h, mi);
}

function totalTripMinutes(flight: Flights): number {
  const legs = flight.flights;
  if (!legs.length) return 0;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const start = toUtcMs(first.departure);
  const end = toUtcMs(last.arrival);
  const doorToDoor = Math.round((end - start) / 60_000);
  if (Number.isFinite(doorToDoor) && doorToDoor > 0) return doorToDoor;
  return legs.reduce((sum, leg) => sum + leg.duration, 0);
}

function routeAirports(flight: Flights): string[] {
  const codes: string[] = [];
  for (const leg of flight.flights) {
    const from = leg.from_airport.code?.toUpperCase();
    const to = leg.to_airport.code?.toUpperCase();
    if (from && codes[codes.length - 1] !== from) codes.push(from);
    if (to && codes[codes.length - 1] !== to) codes.push(to);
  }
  return codes;
}

function normalizeOffer(
  flight: Flights,
  date: string,
  currency: string,
): FlightOffer | null {
  if (!Number.isFinite(flight.price) || flight.price <= 0) return null;
  const legs = flight.flights;
  if (!legs.length) return null;

  const first = legs[0];
  const last = legs[legs.length - 1];

  return {
    date,
    price: flight.price,
    currency,
    airline: flight.airlines.join(", ") || "Unknown",
    duration: formatDuration(totalTripMinutes(flight)),
    stops: Math.max(0, legs.length - 1),
    departTime: formatClock(first.departure),
    arriveTime: formatClock(last.arrival),
    airports: routeAirports(flight),
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function jitter(ms: number): Promise<void> {
  const delay = ms + Math.floor(Math.random() * ms);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function searchDate(
  origin: string,
  dest: string,
  date: string,
  currency: Currency,
): Promise<FlightOffer | null> {
  try {
    const query = createQuery({
      flights: [{ date, from_airport: origin, to_airport: dest }],
      seat: "economy",
      trip: "one-way",
      passengers: new Passengers({ adults: 1 }),
      currency,
      language: "en",
    });

    // Prefer HTML bootstrap parse over RPC: Google's GetShoppingResults
    // envelope changes often and currently returns empty [0][2] for us.
    const html = await fetchFlightsHtml(query, {
      timeout: 30_000,
      maxRetries: 2,
      retryDelay: 1_500,
    });
    const results = parse(html);

    let best: FlightOffer | null = null;
    for (const flight of results) {
      const offer = normalizeOffer(flight, date, currency);
      if (!offer) continue;
      if (!best || offer.price < best.price) best = offer;
    }
    return best;
  } catch (err) {
    console.warn(`[flights] Failed for ${origin}->${dest} on ${date}:`, err);
    return null;
  }
}

export type SearchFlightsOptions = {
  origin?: string;
  dest?: string;
  days?: number;
  every?: number;
  currency?: string;
  concurrency?: number;
  bypassCache?: boolean;
};

export async function searchFlights(
  options: SearchFlightsOptions = {},
): Promise<FlightSearchResult> {
  const origin = (options.origin ?? "MEX").toUpperCase().trim();
  const dest = (options.dest ?? "IST").toUpperCase().trim();
  const days = Math.min(Math.max(options.days ?? 60, 7), 90);
  const every = Math.min(Math.max(options.every ?? 3, 1), 14);
  const currency = asCurrency(options.currency ?? DEFAULT_CURRENCY);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const cacheKey = `v2|${origin}|${dest}|${days}|${every}|${currency}`;
  if (!options.bypassCache) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.result;
    }
  }

  const dates = sampleDates(days, every);
  const perDate = await mapPool(dates, concurrency, async (date, index) => {
    if (index > 0) await jitter(200);
    return searchDate(origin, dest, date, currency);
  });

  const cheapestPerDate = perDate
    .filter((o): o is FlightOffer => o != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const topOffers = [...cheapestPerDate]
    .sort((a, b) => a.price - b.price || a.date.localeCompare(b.date))
    .slice(0, 10);

  const result: FlightSearchResult = {
    origin,
    dest,
    currency,
    sampledDates: dates.length,
    cheapestPerDate,
    topOffers,
    searchedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}
