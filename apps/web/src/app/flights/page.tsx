import { notFound } from "next/navigation";
import FlightsPageClient from "./FlightsPageClient";

export default function FlightsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <FlightsPageClient />;
}
