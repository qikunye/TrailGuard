export default async function handler(req, res) {
  const { lat, lng, hours = 48 } = req.query;
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const hoursInt = Math.min(parseInt(hours) || 48, 240);

  try {
    const url = `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${key}&location.latitude=${lat}&location.longitude=${lng}&hours=${hoursInt}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Weather API error" });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
