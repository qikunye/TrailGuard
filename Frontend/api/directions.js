function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    for (let isLng = 0; isLng < 2; isLng++) {
      let shift = 0, result = 0, b;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (isLng) lng += delta; else lat += delta;
    }
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

export default async function handler(req, res) {
  const { origin_lat, origin_lng, dest_lat, dest_lng, mode = "walking" } = req.query;
  const key = process.env.GOOGLE_MAPS_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin_lat},${origin_lng}&destination=${dest_lat},${dest_lng}&mode=${mode}&key=${key}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.routes?.length) {
    return res.status(404).json({ error: `Directions failed: ${data.status}` });
  }

  const leg  = data.routes[0].legs[0];
  const path = decodePolyline(data.routes[0].overview_polyline.points);

  res.json({
    distanceMetres:  leg.distance.value,
    distanceText:    leg.distance.text,
    durationSeconds: leg.duration.value,
    durationText:    leg.duration.text,
    path,
  });
}
