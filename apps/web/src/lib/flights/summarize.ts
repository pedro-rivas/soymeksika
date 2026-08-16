import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { FlightOffer, FlightSearchResult } from "./search";

function formatPrice(offer: FlightOffer): string {
  return `${offer.currency} $${offer.price.toLocaleString("en-US")}`;
}

function formatOfferLine(offer: FlightOffer, rank?: number): string {
  const prefix = rank != null ? `${rank}. ` : "";
  const stops =
    offer.stops === 0
      ? "nonstop"
      : offer.stops === 1
        ? "1 stop"
        : `${offer.stops} stops`;
  return `${prefix}${offer.date} → ${offer.returnDate} — ${formatPrice(offer)} · ${offer.airline} · outbound ${offer.duration} · ${stops} · ${offer.departTime}→${offer.arriveTime}`;
}

export function formatPlainSummary(result: FlightSearchResult): string {
  if (result.topOffers.length === 0) {
    return `No round-trip flights found for ${result.origin} ⇄ ${result.dest} in the next ${result.sampledDates} sampled dates.`;
  }

  const lines = [
    `Cheapest round-trip options ${result.origin} ⇄ ${result.dest} (${result.stayDays}-night stay, next ~2 months, currency ${result.currency}):`,
    "",
    ...result.topOffers.map((o, i) => formatOfferLine(o, i + 1)),
    "",
    `Sampled ${result.sampledDates} dates · ${result.cheapestPerDate.length} returned prices · searched ${result.searchedAt}`,
  ];
  return lines.join("\n");
}

export async function summarizeFlights(
  result: FlightSearchResult,
): Promise<string> {
  const fallback = formatPlainSummary(result);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey || result.topOffers.length === 0) {
    return fallback;
  }

  try {
    const openai = createOpenAI({ apiKey });
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "You format round-trip flight search results into a short, friendly summary for a traveler. " +
        "Prices are round-trip totals. Lead with the absolute cheapest option (include outbound and return dates), then mention 2–3 other good date pairs. " +
        "Keep it under 120 words. Use the exact prices and airlines given. No markdown headings.",
      prompt: [
        `Route: ${result.origin} ⇄ ${result.dest} (round-trip, ${result.stayDays}-night stay)`,
        `Currency: ${result.currency}`,
        "Top offers (cheapest first):",
        ...result.topOffers.map((o, i) => formatOfferLine(o, i + 1)),
      ].join("\n"),
    });

    const trimmed = text.trim();
    return trimmed || fallback;
  } catch (err) {
    console.warn("[flights] LLM summarize failed, using plain text:", err);
    return fallback;
  }
}
