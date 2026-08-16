"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  createPin,
  deletePin,
  fetchPins,
  type Pin,
  type PinLinks,
} from "../lib/pins";
import AddPinModal from "./AddPinModal";
import type { PlaceResult } from "./PlaceSearch";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 text-zinc-600">
      Loading map…
    </div>
  ),
});

const IS_DEV = process.env.NODE_ENV === "development";

const DEV_PILL =
  "rounded-full border border-zinc-300 bg-white/95 px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur transition hover:bg-zinc-100";

const DEV_PILL_ACTIVE =
  "rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800";

export default function MapLoader() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinsReady, setPinsReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draftLngLat, setDraftLngLat] = useState<[number, number] | null>(null);
  const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animationsOpen, setAnimationsOpen] = useState(true);
  const animationControlsRef = useRef<{ stop: () => void } | null>(null);

  const refreshPins = useCallback(async () => {
    try {
      setPins(await fetchPins());
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Could not load pins");
    } finally {
      setPinsReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshPins();
  }, [refreshPins]);

  const openModal = () => {
    setDraftLngLat(null);
    setFocusTarget(null);
    setPicking(true);
    setModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPicking(false);
    setDraftLngLat(null);
    setFocusTarget(null);
  };

  const handleMapClick = useCallback(
    (lngLat: [number, number]) => {
      if (!picking) return;
      setDraftLngLat(lngLat);
    },
    [picking],
  );

  const handlePickLocation = useCallback((place: PlaceResult) => {
    setDraftLngLat(place.lngLat);
    setFocusTarget(place.lngLat);
  }, []);

  const handleSave = async (input: {
    name: string;
    lngLat: [number, number];
    links: PinLinks;
  }) => {
    await createPin(input);
    await refreshPins();
    closeModal();
  };

  const handleDelete = async (id: string) => {
    await deletePin(id);
    await refreshPins();
  };

  const handleAnimationControls = useCallback(
    (controls: { stop: () => void } | null) => {
      animationControlsRef.current = controls;
    },
    [],
  );

  const toggleAnimations = () => {
    setAnimationsOpen((open) => {
      if (open) animationControlsRef.current?.stop();
      return !open;
    });
  };

  if (!pinsReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 text-zinc-600">
        Loading map…
      </div>
    );
  }

  return (
    <>
      <Map
        pins={pins}
        picking={picking}
        onMapClick={handleMapClick}
        draftLngLat={draftLngLat}
        focusTarget={focusTarget}
        enableAnimations={IS_DEV}
        showAnimationPanel={IS_DEV && animationsOpen}
        onAnimationControls={handleAnimationControls}
      />

      {IS_DEV && (
        <>
          <div className="fixed bottom-3 right-3 z-[100000] flex flex-col items-end gap-2">
            <button
              type="button"
              aria-pressed={animationsOpen}
              onClick={toggleAnimations}
              className={animationsOpen ? DEV_PILL_ACTIVE : DEV_PILL}
            >
              Animations
            </button>
            <button type="button" onClick={openModal} className={DEV_PILL}>
              Pin
            </button>
            <Link href="/flights" className={DEV_PILL}>
              Vuelos
            </Link>
          </div>

          {modalOpen && (
            <AddPinModal
              lngLat={draftLngLat}
              pins={pins}
              onClose={closeModal}
              onSave={handleSave}
              onDelete={handleDelete}
              onPickLocation={handlePickLocation}
            />
          )}
        </>
      )}

      {error && (
        <p className="pointer-events-none fixed bottom-4 left-4 z-[100000] rounded-md bg-red-600 px-3 py-2 text-sm text-white">
          {error}
        </p>
      )}
    </>
  );
}
