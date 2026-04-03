import { useState, useRef, useEffect } from "react";

/**
 * CustomSelect — styled dropdown that matches the TrailGuard design system.
 *
 * Props:
 *   value       – current selected value (string)
 *   onChange    – (value) => void
 *   options     – [{ value, label }] or ["string", ...]
 *   placeholder – shown when nothing selected
 *   icon        – optional JSX to show on the left
 *   className   – extra class on the trigger button
 */
export default function CustomSelect({ value, onChange, options, placeholder = "Select…", icon, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const normalised = options.map(o =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  const selected = normalised.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center gap-2.5 px-4 py-3
          bg-surface border rounded-full
          text-[0.9rem] text-left cursor-pointer
          transition-all outline-none
          ${open
            ? "border-primary ring-2 ring-primary/20"
            : "border-line hover:border-primary/50"
          }
        `}
      >
        {icon && <span className="text-muted shrink-0">{icon}</span>}
        <span className={`flex-1 truncate ${selected ? "text-fg" : "text-muted"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="
          absolute z-50 left-0 right-0 mt-1.5
          bg-[#131a17] border border-line rounded-2xl
          shadow-[0_8px_32px_rgba(0,0,0,0.6)]
          py-1.5 overflow-hidden
          animate-in fade-in slide-in-from-top-1 duration-100
        ">
          {normalised.map(o => {
            const isActive = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`
                  w-full flex items-center justify-between gap-3
                  px-4 py-2.5 text-[0.9rem] text-left cursor-pointer
                  border-none transition-colors
                  ${isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-[#131a17] text-fg hover:bg-[#1a2420]"
                  }
                `}
              >
                <span>{o.label}</span>
                {isActive && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
