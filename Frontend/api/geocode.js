export default async function handler(req, res) {
  const { address } = req.query;
  const key = process.env.GOOGLE_MAPS_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=SG&key=${key}`;
  const response = await fetch(url);
  const data = await response.json();

  const location = data.results?.[0]?.geometry?.location;
  if (!location) return res.status(404).json({ error: "Not found" });

  res.json({ lat: location.lat, lng: location.lng });
}
