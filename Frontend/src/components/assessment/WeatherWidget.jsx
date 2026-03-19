export default function WeatherWidget({ weather }) {
  const d = weather ?? { temp: 28, condition: "Partly Cloudy", wind: 12, humidity: 75, feelsLike: 31 };

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[0.95rem] font-semibold text-fg">Current Weather</h2>
        <span className="text-xs text-muted">Approx. trail area</span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <span className="text-5xl">⛅</span>
        <div>
          <div className="text-[2rem] font-bold text-fg leading-none">{d.temp}°C</div>
          <div className="text-sm text-muted">{d.condition}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: "💨", label: "Wind",       value: `${d.wind} km/h` },
          { icon: "💧", label: "Humidity",   value: `${d.humidity}%` },
          { icon: "🌡", label: "Feels Like", value: `${d.feelsLike}°C` },
        ].map(item => (
          <div key={item.label} className="bg-surface rounded-xl p-2.5 text-center">
            <div className="text-xl">{item.icon}</div>
            <div className="text-[0.7rem] text-muted mb-0.5">{item.label}</div>
            <div className="text-sm font-semibold text-fg">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
