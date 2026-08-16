import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["192.168.1.125"],
  transpilePackages: ["maplibre-gl"],
  // fast-flights-ts optionally imports native node-libcurl for HTML fallback;
  // keep both external so webpack doesn't try to resolve the .node binding.
  serverExternalPackages: ["fast-flights-ts", "node-libcurl"],
};

export default nextConfig;
