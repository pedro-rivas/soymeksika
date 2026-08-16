"use client";

import { useState, type FormEvent } from "react";
import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  type Pin,
  type PinLinks,
  type SocialPlatform,
} from "../lib/pins";
import PlaceSearch, { type PlaceResult } from "./PlaceSearch";

type Props = {
  lngLat: [number, number] | null;
  pins: Pin[];
  onClose: () => void;
  onSave: (input: {
    name: string;
    lngLat: [number, number];
    links: PinLinks;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPickLocation: (place: PlaceResult) => void;
};

const emptyLinks = (): Record<SocialPlatform, string> => ({
  youtube: "",
  tiktok: "",
  facebook: "",
  instagram: "",
});

function pinListLabel(pin: Pin) {
  if (pin.name) return pin.name;
  const first = SOCIAL_PLATFORMS.find((p) => pin.links[p]);
  return first ? SOCIAL_LABELS[first] : "Untitled pin";
}

export default function AddPinModal({
  lngLat,
  pins,
  onClose,
  onSave,
  onDelete,
  onPickLocation,
}: Props) {
  const [name, setName] = useState("");
  const [links, setLinks] = useState(emptyLinks);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlaceSelect = (place: PlaceResult) => {
    onPickLocation(place);
    setName((prev) => (prev.trim() ? prev : place.name));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!lngLat) {
      setError("Search a place or click the map to set a location");
      return;
    }

    const cleaned: PinLinks = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const value = links[platform].trim();
      if (value) cleaned[platform] = value;
    }

    if (Object.keys(cleaned).length === 0) {
      setError("Add at least one social link");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), lngLat, links: cleaned });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const clearLink = (platform: SocialPlatform) => {
    setLinks((prev) => ({ ...prev, [platform]: "" }));
  };

  return (
    <div
      className="pointer-events-none fixed inset-y-0 right-0 z-[100001] flex items-stretch p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-pin-title"
    >
      <div className="pointer-events-auto flex max-h-full w-full max-w-sm flex-col overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="add-pin-title" className="text-lg font-semibold text-zinc-900">
            Add pin
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            Close
          </button>
        </div>

        <p className="mb-3 text-sm text-zinc-600">
          Search for a place or click the map to set the location. Name is
          optional. Add at least one video link.
        </p>

        <div className="mb-3">
          <PlaceSearch onSelect={handlePlaceSelect} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
              Name <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 outline-none focus:border-zinc-500"
              placeholder="e.g. Zócalo"
              autoFocus
            />
          </label>

          <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-2 py-2 text-sm text-zinc-700">
            {lngLat ? (
              <span>
                Location: {lngLat[1].toFixed(5)}, {lngLat[0].toFixed(5)}
              </span>
            ) : (
              <span className="text-amber-700">
                Search a place or click the map…
              </span>
            )}
          </div>

          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform} className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-800">
                  {SOCIAL_LABELS[platform]} URL
                </span>
                {links[platform] ? (
                  <button
                    type="button"
                    onClick={() => clearLink(platform)}
                    className="text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <input
                type="url"
                value={links[platform]}
                onChange={(e) =>
                  setLinks((prev) => ({ ...prev, [platform]: e.target.value }))
                }
                className="rounded border border-zinc-300 px-2 py-1.5 outline-none focus:border-zinc-500"
                placeholder="https://…"
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || !lngLat}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save pin"}
          </button>
        </form>

        {pins.length > 0 && (
          <div className="mt-5 border-t border-zinc-200 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-800">
              Existing pins
            </h3>
            <ul className="flex flex-col gap-2">
              {pins.map((pin) => (
                <li
                  key={pin.id}
                  className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1.5 text-sm"
                >
                  <span className="truncate text-zinc-800">
                    {pinListLabel(pin)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(pin.id)}
                    disabled={deletingId === pin.id}
                    className="shrink-0 text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === pin.id ? "…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
