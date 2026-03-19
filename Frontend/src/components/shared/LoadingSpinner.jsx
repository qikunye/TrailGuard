export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div
        className="w-9 h-9 rounded-full border-[3px] border-line border-t-primary"
        style={{ animation: "spin 0.7s linear infinite" }}
      />
    </div>
  );
}
