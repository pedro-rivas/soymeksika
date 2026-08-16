"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { googleFlightsSearchUrl } from "../../lib/flights/googleUrl";

type FlightOffer = {
  date: string;
  returnDate?: string;
  price: number;
  currency: string;
  airline: string;
  duration: string;
  stops: number;
  departTime: string;
  arriveTime: string;
  airports?: string[];
};

type FlightSearchResponse = {
  origin: string;
  dest: string;
  currency: string;
  stayDays?: number;
  sampledDates: number;
  cheapestPerDate: FlightOffer[];
  topOffers: FlightOffer[];
  searchedAt: string;
  summary?: string;
  error?: string;
};

const FlightRouteMap = dynamic(() => import("../components/FlightRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-600">
      Loading map…
    </div>
  ),
});

function formatPrice(offer: FlightOffer): string {
  return `${offer.currency} $${offer.price.toLocaleString("en-US")}`;
}

function stopsLabel(stops: number): string {
  if (stops === 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

function routeLabel(offer: FlightOffer, origin: string, dest: string): string {
  const codes =
    offer.airports && offer.airports.length >= 2
      ? offer.airports
      : [origin, dest];
  return codes.join(" → ");
}

function dateRangeLabel(offer: FlightOffer): string {
  if (offer.returnDate) return `${offer.date} → ${offer.returnDate}`;
  return offer.date;
}

function OfferCard({
  offer,
  origin,
  dest,
  onOpen,
}: {
  offer: FlightOffer;
  origin: string;
  dest: string;
  onOpen: (offer: FlightOffer) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(offer)}
      className="group w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-zinc-900 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{formatPrice(offer)}</p>
        <p className="text-sm text-zinc-500">{dateRangeLabel(offer)}</p>
      </div>
      <p className="mt-1 text-sm text-zinc-700">
        Round-trip · {offer.airline} · outbound {offer.duration} ·{" "}
        {stopsLabel(offer.stops)}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {offer.departTime} → {offer.arriveTime} ·{" "}
          {routeLabel(offer, origin, dest)}
        </p>
        <span className="shrink-0 text-xs font-medium text-zinc-400 transition group-hover:text-zinc-900">
          View route →
        </span>
      </div>
    </button>
  );
}

export default function FlightsPageClient() {
  const [origin, setOrigin] = useState("MEX");
  const [dest, setDest] = useState("IST");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FlightSearchResponse | null>(null);
  const [selected, setSelected] = useState<FlightOffer | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  const openRoute = useCallback((offer: FlightOffer) => {
    setSelected(offer);
    setReplayKey(0);
  }, []);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSelected(null);

      try {
        const params = new URLSearchParams({
          origin: origin.trim().toUpperCase(),
          dest: dest.trim().toUpperCase(),
          format: "llm",
        });
        const res = await fetch(`/api/flights?${params.toString()}`);
        const json = (await res.json()) as FlightSearchResponse;

        if (!res.ok) {
          throw new Error(json.error || `Request failed (${res.status})`);
        }

        setData(json);
        setReplayKey(0);
      } catch (err) {
        setData(null);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [origin, dest],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const routeOrigin = data?.origin ?? origin;
  const routeDest = data?.dest ?? dest;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Dev tool
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cheap flights finder
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Round-trip prices (~7-night stay) over the next ~2 months. Tap a
              flight to watch the outbound route on the map.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            ← Map
          </Link>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Origin</span>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="MEX"
              className="rounded-lg border border-zinc-300 px-3 py-2 uppercase tracking-widest outline-none focus:border-zinc-900"
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Destination</span>
            <input
              value={dest}
              onChange={(e) => setDest(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="IST"
              className="rounded-lg border border-zinc-300 px-3 py-2 uppercase tracking-widest outline-none focus:border-zinc-900"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Searching…" : "Find cheapest"}
          </button>
        </form>

        {loading && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Scanning ~20 dates. This usually takes 10–30 seconds…
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {data && (
          <section className="flex flex-col gap-4">
            {data.summary && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Summary
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                  {data.summary}
                </p>
              </div>
            )}

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Top 10 cheapest
              </h2>
              {data.topOffers.length === 0 ? (
                <p className="text-sm text-zinc-600">No offers found.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.topOffers.map((offer) => (
                    <li
                      key={`${offer.date}-${offer.price}-${offer.airline}-${offer.departTime}`}
                    >
                      <OfferCard
                        offer={offer}
                        origin={routeOrigin}
                        dest={routeDest}
                        onOpen={openRoute}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Cheapest by date
              </h2>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Dates</th>
                      <th className="px-3 py-2 font-medium">Price (RT)</th>
                      <th className="px-3 py-2 font-medium">Airline</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">
                        Stops
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cheapestPerDate.map((offer) => (
                      <tr
                        key={offer.date}
                        className="cursor-pointer border-t border-zinc-100 transition hover:bg-zinc-50"
                        onClick={() => openRoute(offer)}
                      >
                        <td className="px-3 py-2">{dateRangeLabel(offer)}</td>
                        <td className="px-3 py-2 font-medium">
                          {formatPrice(offer)}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">
                          {offer.airline}
                        </td>
                        <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell">
                          {stopsLabel(offer.stops)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Sampled {data.sampledDates} dates · searched{" "}
                {new Date(data.searchedAt).toLocaleString()} · tap a row to view
                the route
              </p>
            </div>
          </section>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[200000] flex flex-col bg-zinc-950/55 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Flight route map"
        >
          <div className="relative m-0 flex h-full w-full flex-col overflow-hidden bg-zinc-100 sm:m-4 sm:h-[calc(100%-2rem)] sm:rounded-2xl sm:shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 sm:p-4">
              <div className="pointer-events-auto mx-auto flex max-w-3xl items-start justify-between gap-3 rounded-2xl border border-white/60 bg-white/80 px-3 py-2.5 shadow-lg backdrop-blur-md sm:px-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {formatPrice(selected)} · {selected.airline}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {dateRangeLabel(selected)} · {selected.departTime} →{" "}
                    {selected.arriveTime} · outbound {selected.duration} ·{" "}
                    {stopsLabel(selected.stops)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(selected.airports && selected.airports.length >= 2
                      ? selected.airports
                      : [routeOrigin, routeDest]
                    ).map((code, i, arr) => (
                      <span key={`${code}-${i}`} className="contents">
                        <span className="inline-flex items-center rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                          {code}
                        </span>
                        {i < arr.length - 1 && (
                          <span className="self-center text-[10px] text-zinc-400">
                            →
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <a
                    href={googleFlightsSearchUrl({
                      origin: routeOrigin,
                      dest: routeDest,
                      date: selected.date,
                      returnDate: selected.returnDate,
                      currency: selected.currency,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700"
                  >
                    Book on Google Flights
                  </a>
                  <button
                    type="button"
                    onClick={() => setReplayKey((k) => k + 1)}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100"
                  >
                    Replay
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              <FlightRouteMap
                key={replayKey}
                replayKey={replayKey}
                airports={
                  selected.airports && selected.airports.length >= 2
                    ? selected.airports
                    : [routeOrigin, routeDest]
                }
                originFallback={routeOrigin}
                destFallback={routeDest}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
