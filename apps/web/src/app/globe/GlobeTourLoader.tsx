"use client";

import dynamic from "next/dynamic";

const GlobeTour = dynamic(() => import("./GlobeTour"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-sm text-white/70">
      Loading globe…
    </div>
  ),
});

export default function GlobeTourLoader() {
  return <GlobeTour />;
}
