/** Build a Google Flights search URL for a round-trip itinerary. */
export function googleFlightsSearchUrl(opts: {
  origin: string;
  dest: string;
  date: string;
  returnDate?: string;
  currency?: string;
}): string {
  const origin = opts.origin.trim().toUpperCase();
  const dest = opts.dest.trim().toUpperCase();
  const date = opts.date.trim();
  const returnDate = opts.returnDate?.trim();
  const currency = (opts.currency ?? "MXN").toUpperCase();

  const q = returnDate
    ? `Round trip flights from ${origin} to ${dest} departing ${date} returning ${returnDate}`
    : `Round trip flights from ${origin} to ${dest} on ${date}`;

  const params = new URLSearchParams({
    hl: "en",
    curr: currency,
    q,
  });

  return `https://www.google.com/travel/flights?${params.toString()}`;
}
