import { useState } from "react";

export default function PhotoUpload({ onUpload }) {
  const [preview,  setPreview]  = useState(null);
  const [fileName, setFileName] = useState("");

  function process(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onUpload?.(file);
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <h2 className="text-[0.95rem] font-semibold text-fg mb-3">
        Evidence Photo <span className="text-muted font-normal">(optional)</span>
      </h2>

      {preview ? (
        <div className="relative">
          <img src={preview} alt="preview" className="w-full max-h-48 object-cover rounded-xl" />
          <button
            type="button"
            onClick={() => { setPreview(null); setFileName(""); }}
            className="absolute top-2 right-2 bg-black/60 border-none rounded-full w-7 h-7 text-white cursor-pointer text-sm flex items-center justify-center"
          >
            ✕
          </button>
          <p className="text-xs text-muted mt-1.5">{fileName}</p>
        </div>
      ) : (
        <label
          htmlFor="photo-upload"
          onDrop={e => { e.preventDefault(); process(e.dataTransfer.files?.[0]); }}
          onDragOver={e => e.preventDefault()}
          className="block border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer bg-surface hover:border-primary transition-colors"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted mx-auto mb-2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <p className="text-sm text-muted mb-0.5">Drag &amp; drop or click to upload</p>
          <p className="text-xs text-muted">JPG, PNG, HEIC up to 10MB</p>
          <input id="photo-upload" type="file" accept="image/*" onChange={e => process(e.target.files?.[0])} className="hidden" />
        </label>
      )}
    </div>
  );
}
