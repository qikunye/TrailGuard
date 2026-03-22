import { Loader } from "@googlemaps/js-api-loader";

let _loader = null;
function getLoader() {
  if (!_loader) {
    _loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      version: "weekly",
    });
  }
  return _loader;
}

export const loadGoogleMaps = () => getLoader().importLibrary("maps");
export const loadRoutesLib  = () => getLoader().importLibrary("routes");
export const loadPlacesLib  = () => getLoader().importLibrary("places");
export const loadMarkerLib  = () => getLoader().importLibrary("marker");

export const DARK_MAP_STYLES = [
  { elementType: "geometry",              stylers: [{ color: "#1c1c1c" }] },
  { elementType: "labels.text.fill",      stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke",    stylers: [{ color: "#1c1c1c" }] },
  { featureType: "road", elementType: "geometry",          stylers: [{ color: "#2d2d2d" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway",  elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "road", elementType: "labels.text.fill",  stylers: [{ color: "#9ca3af" }] },
  { featureType: "water", elementType: "geometry",         stylers: [{ color: "#0f172a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
  { featureType: "poi",     stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2d2d2d" }] },
];
