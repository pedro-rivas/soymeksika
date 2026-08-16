import { NextResponse } from "next/server";
import { searchFlights } from "../../../lib/flights/search";
import { summarizeFlights } from "../../../lib/flights/summarize";

export const runtime = "nodejs";
export const maxDuration = 120;

function isDev() {
  return process.env.NODE_ENV === "development";
}

function parsePositiveInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value == null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function parseAirport(value: string | null, fallback: string): string {
  const code = (value ?? fallback).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return fallback;
  return code;
}

export async function GET(request: Request) {
  if (!isDev()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const origin = parseAirport(searchParams.get("origin"), "MEX");
    const dest = parseAirport(searchParams.get("dest"), "IST");
    const days = parsePositiveInt(searchParams.get("days"), 60, 7, 90);
    const every = parsePositiveInt(searchParams.get("every"), 3, 1, 14);
    const format = searchParams.get("format") === "raw" ? "raw" : "llm";

    if (origin === dest) {
      return NextResponse.json(
        { error: "origin and dest must differ" },
        { status: 400 },
      );
    }

    const result = await searchFlights({ origin, dest, days, every });
    const summary =
      format === "llm" ? await summarizeFlights(result) : undefined;

    return NextResponse.json({
      ...result,
      ...(summary != null ? { summary } : {}),
    });
  } catch (err) {
    console.error("Failed to search flights", err);
    return NextResponse.json(
      { error: "Failed to search flights" },
      { status: 500 },
    );
  }
}
