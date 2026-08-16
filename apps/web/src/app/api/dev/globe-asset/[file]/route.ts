import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED = new Set(["earth-night.jpg", "earth-topology.png"]);

const CONTENT_TYPES: Record<string, string> = {
  "earth-night.jpg": "image/jpeg",
  "earth-topology.png": "image/png",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const { file } = await context.params;
  if (!ALLOWED.has(file)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const fullPath = path.join(process.cwd(), "dev-assets", "globe", file);
    const data = await readFile(fullPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": CONTENT_TYPES[file] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
