"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  createPin,
  deletePin,
  fetchPins,
  type Pin,
  type PinLinks,
} from "../lib/pins";
import AddPinModal from "./AddPinModal";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 text-zinc-600">
      Loading map…
    </div>
  ),
});

const IS_DEV = process.env.NODE_ENV === "development";

export default function MapLoader() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinsReady, setPinsReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draftLngLat, setDraftLngLat] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setPicking(true);
    setModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPicking(false);
    setDraftLngLat(null);
  };

  const handleMapClick = useCallback(
    (lngLat: [number, number]) => {
      if (!picking) return;
      setDraftLngLat(lngLat);
    },
    [picking],
  );

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
      />

      {IS_DEV && (
        <>
          <button
            type="button"
            onClick={openModal}
            className="fixed bottom-4 left-4 z-[100000] rounded-md bg-black px-3 py-2 text-sm font-medium text-white shadow-md transition hover:bg-zinc-800"
          >
            Add pin
          </button>

          {modalOpen && (
            <AddPinModal
              lngLat={draftLngLat}
              pins={pins}
              onClose={closeModal}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      {error && (
        <p className="pointer-events-none fixed bottom-4 right-4 z-[100000] rounded-md bg-red-600 px-3 py-2 text-sm text-white">
          {error}
        </p>
      )}
    </>
  );
}
