"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function createPinIcon() {
  return L.divIcon({
    className: "custom-map-pin",
    html: `
      <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0z"
          fill="#2A81CB"
          stroke="#1a5f9a"
          stroke-width="1"
        />
        <circle cx="15" cy="14" r="5.5" fill="#FFFFFF"/>
      </svg>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
  });
}

const PINS = [
  {
    id: "zocalo",
    name: "Zócalo / Centro Histórico",
    position: L.latLng(19.4326, -99.1332),
  },
  {
    id: "coyoacan",
    name: "Coyoacán (Frida Kahlo Museum)",
    position: L.latLng(19.3551, -99.1625),
  },
];

function InvalidateSize() {
  const map = useMap();

  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);
    return () => window.clearTimeout(id);
  }, [map]);

  return null;
}

export default function Map() {
  return (
    <MapContainer
      center={[19.4, -99.15]}
      zoom={3}
      minZoom={3}
      scrollWheelZoom={true}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <InvalidateSize />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {PINS.map((pin) => (
        <Marker key={pin.id} position={pin.position} icon={createPinIcon()}>
          <Popup>{pin.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
