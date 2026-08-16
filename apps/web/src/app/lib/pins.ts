export type SocialPlatform = "youtube" | "tiktok" | "facebook" | "instagram";

export type PinLinks = Partial<Record<SocialPlatform, string>>;

export type Pin = {
  id: string;
  name: string;
  lngLat: [number, number];
  links: PinLinks;
  /** ISO 8601 timestamp when the pin was created */
  createdAt: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
];

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
};

function normalizeLinks(raw: unknown): PinLinks {
  if (!raw || typeof raw !== "object") return {};
  const links: PinLinks = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const value = (raw as Record<string, unknown>)[platform];
    if (typeof value === "string" && value.trim()) {
      links[platform] = value.trim();
    }
  }
  return links;
}

export function parsePin(raw: unknown): Pin | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string") return null;
  if (!Array.isArray(obj.lngLat) || obj.lngLat.length !== 2) return null;
  const lng = Number(obj.lngLat[0]);
  const lat = Number(obj.lngLat[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const createdAt =
    typeof obj.createdAt === "string" && obj.createdAt.trim()
      ? obj.createdAt.trim()
      : new Date(0).toISOString();
  return {
    id: obj.id,
    name,
    lngLat: [lng, lat],
    links: normalizeLinks(obj.links),
    createdAt,
  };
}

export async function fetchPins(): Promise<Pin[]> {
  const res = await fetch("/api/pins", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load pins");
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(parsePin).filter((p): p is Pin => p != null);
}

export async function createPin(input: {
  name: string;
  lngLat: [number, number];
  links: PinLinks;
}): Promise<Pin> {
  const res = await fetch("/api/pins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to create pin");
  }
  const pin = parsePin(await res.json());
  if (!pin) throw new Error("Invalid pin response");
  return pin;
}

export async function deletePin(id: string): Promise<void> {
  const res = await fetch(`/api/pins?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to delete pin");
  }
}
