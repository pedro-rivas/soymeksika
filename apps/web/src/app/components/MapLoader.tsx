"use client";

import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 text-zinc-600">
      Loading map…
    </div>
  ),
});

export default function MapLoader() {
  return <Map />;
}
