import { notFound } from "next/navigation";
import GlobeTourLoader from "./GlobeTourLoader";

export const metadata = {
  title: "Globe tour",
  robots: { index: false, follow: false },
};

export default function GlobePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <GlobeTourLoader />;
}
