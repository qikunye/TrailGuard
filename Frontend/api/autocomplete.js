export default async function handler(req, res) {
  const { input } = req.query;
  const key = process.env.GOOGLE_MAPS_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:sg&location=1.3521,103.8198&radius=50000&key=${key}`;
  const response = await fetch(url);
  const data = await response.json();

  res.json({
    predictions: (data.predictions || []).map(p => ({
      description:   p.description,
      placeId:       p.place_id,
      mainText:      p.structured_formatting.main_text,
      secondaryText: p.structured_formatting.secondary_text || "",
    })),
  });
}
