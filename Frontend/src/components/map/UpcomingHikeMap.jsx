import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";

const SG = [1.3521, 103.8198];

const makeIcon = (color, size = 12) =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 6px ${color}80"></div>`,
    className: "",
    iconAnchor: [size / 2, size / 2],
  });

const startIcon = makeIcon("#4ade80");
const endIcon   = makeIcon("#f87171");

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length > 1) map.fitBounds(positions, { padding: [30, 30] });
  }, [positions, map]);
  return null;
}

export default function UpcomingHikeMap({ hike, height = 280 }) {
  const hasRoute = hike?.path?.length > 1;
  const center = hasRoute
    ? [hike.startLat, hike.startLng]
    : SG;

  return (
    <div style={{ height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        style={{ height: "100%", width: "100%", background: "#0a0f0d" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {hasRoute && (
          <>
            <Polyline positions={hike.path} pathOptions={{ color: "#4ade80", weight: 4, opacity: 0.9 }} />
            <FitBounds positions={hike.path} />
            <Marker position={[hike.startLat, hike.startLng]} icon={startIcon} />
            <Marker position={[hike.endLat,   hike.endLng]}   icon={endIcon}   />
          </>
        )}
      </MapContainer>
    </div>
  );
}
