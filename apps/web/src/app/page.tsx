import Link from "next/link";
import MapLoader from "./components/MapLoader";
import SocialLinks from "./components/SocialLinks";

export default function Home() {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="h-screen w-screen overflow-hidden">
      <SocialLinks />
      <MapLoader />
      {isDev && (
        <Link
          href="/flights"
          className="fixed bottom-3 right-3 z-[100000] rounded-full border border-zinc-300 bg-white/95 px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur transition hover:bg-zinc-100"
        >
          Vuelos
        </Link>
      )}
    </main>
  );
}
