import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Known SG trail coordinates (approximate)
export const TRAILS = {
  macritchie: {
    name: "MacRitchie Reservoir Trail",
    center: [1.3504, 103.8199],
    zoom: 14,
    route: [
      [1.3412, 103.8152],[1.3438, 103.8123],[1.3471, 103.8098],
      [1.3504, 103.8107],[1.3538, 103.8134],[1.3562, 103.8178],
      [1.3551, 103.8219],[1.3522, 103.8248],[1.3490, 103.8241],
      [1.3459, 103.8220],[1.3435, 103.8195],[1.3412, 103.8152],
    ],
    distance: "11 km", difficulty: "Moderate",
  },
  bukittimah: {
    name: "Bukit Timah Summit Trail",
    center: [1.3537, 103.7762],
    zoom: 15,
    route: [
      [1.3490, 103.7748],[1.3505, 103.7755],[1.3518, 103.7759],
      [1.3530, 103.7761],[1.3537, 103.7762],[1.3543, 103.7768],
    ],
    distance: "3 km", difficulty: "Moderate",
  },
  southernridges: {
    name: "Southern Ridges",
    center: [1.2744, 103.8003],
    zoom: 13,
    route: [
      [1.2822, 103.7948],[1.2800, 103.7975],[1.2780, 103.8002],
      [1.2759, 103.8018],[1.2744, 103.8030],[1.2722, 103.8045],
      [1.2703, 103.8058],[1.2688, 103.8073],
    ],
    distance: "9 km", difficulty: "Easy",
  },
  chestnut: {
    name: "Chestnut Nature Park",
    center: [1.3803, 103.7663],
    zoom: 14,
    route: [
      [1.3770, 103.7645],[1.3783, 103.7654],[1.3796, 103.7660],
      [1.3808, 103.7668],[1.3818, 103.7675],[1.3808, 103.7668],
    ],
    distance: "6 km", difficulty: "Easy",
  },
  labrador: {
    name: "Labrador Nature Reserve",
    center: [1.2688, 103.8025],
    zoom: 15,
    route: [
      [1.2672, 103.8012],[1.2680, 103.8020],[1.2688, 103.8025],
      [1.2695, 103.8032],[1.2688, 103.8040],[1.2680, 103.8033],
    ],
    distance: "4 km", difficulty: "Easy",
  },
};

export function matchTrail(name = "") {
  const s = name.toLowerCase();
  if (s.includes("macritchie") || s.includes("mac ritchie")) return TRAILS.macritchie;
  if (s.includes("timah"))          return TRAILS.bukittimah;
  if (s.includes("southern") || s.includes("ridges")) return TRAILS.southernridges;
  if (s.includes("chestnut"))       return TRAILS.chestnut;
  if (s.includes("labrador"))       return TRAILS.labrador;
  return null;
}

const dot = (color) =>
  L.divIcon({
    html: `<div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 8px ${color}80"></div>`,
    className: "",
    iconAnchor: [6, 6],
  });

function FitBounds({ positions }) {
  const map = useMap();
  if (positions?.length > 1) map.fitBounds(positions, { padding: [36, 36] });
  return null;
}

export default function TrailMap({ trailName, className = "", style = {} }) {
  const matched   = trailName ? matchTrail(trailName) : null;
  const center    = matched?.center  ?? [1.3521, 103.8198];
  const zoom      = matched?.zoom    ?? 12;
  const route     = matched?.route   ?? null;

  return (
    <div className={`overflow-hidden ${className}`} style={{ height: "100%", minHeight: 220, ...style }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#0a0f0d" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        {route && (
          <>
            <FitBounds positions={route} />
            <Polyline positions={route} pathOptions={{ color: "#4ade80", weight: 3.5, opacity: 0.9 }} />
            <Marker position={route[0]} icon={dot("#4ade80")} />
            <Marker position={route[route.length - 1]} icon={dot("#f87171")} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
