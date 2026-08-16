import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  SOCIAL_PLATFORMS,
  type Pin,
  type PinLinks,
} from "../../lib/pins";
import { readPins, writePins } from "../../lib/pinsStore";

function isDev() {
  return process.env.NODE_ENV === "development";
}

function sanitizeLinks(raw: unknown): PinLinks {
  if (!raw || typeof raw !== "object") return {};
  const links: PinLinks = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const value = (raw as Record<string, unknown>)[platform];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      links[platform] = url.toString();
    } catch {
      // skip invalid URLs
    }
  }
  return links;
}

export async function GET() {
  try {
    const pins = await readPins();
    return NextResponse.json(pins);
  } catch (err) {
    console.error("Failed to read pins", err);
    return NextResponse.json({ error: "Failed to read pins" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDev()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const obj = body as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";

    if (!Array.isArray(obj.lngLat) || obj.lngLat.length !== 2) {
      return NextResponse.json({ error: "lngLat is required" }, { status: 400 });
    }

    const lng = Number(obj.lngLat[0]);
    const lat = Number(obj.lngLat[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
    }

    const links = sanitizeLinks(obj.links);
    if (Object.keys(links).length === 0) {
      return NextResponse.json(
        { error: "At least one social link is required" },
        { status: 400 },
      );
    }

    const pin: Pin = {
      id: randomUUID(),
      name,
      lngLat: [lng, lat],
      links,
      createdAt: new Date().toISOString(),
    };

    const pins = await readPins();
    pins.push(pin);
    await writePins(pins);

    return NextResponse.json(pin, { status: 201 });
  } catch (err) {
    console.error("Failed to create pin", err);
    return NextResponse.json({ error: "Failed to create pin" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isDev()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const pins = await readPins();
    const next = pins.filter((p) => p.id !== id);
    if (next.length === pins.length) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    await writePins(next);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete pin", err);
    return NextResponse.json({ error: "Failed to delete pin" }, { status: 500 });
  }
}
