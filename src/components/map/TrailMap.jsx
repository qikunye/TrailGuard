// Shared — Google Maps embed for a given trail
// Props: { trailId: string, center: { lat, lng }, zoom: number }
export default function TrailMap({ center, zoom = 13 }) {
  return (
    <div className="section-card" style={{ minHeight: 260 }}>
      <p className="page-subheading">TrailMap — Google Maps embed</p>
    </div>
  );
}
