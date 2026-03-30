export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/orchestrator";

export const SEVERITY_LEVELS = [
  { value: 1, label: "Minor",    description: "Small cuts, bruises, no mobility loss" },
  { value: 2, label: "Moderate", description: "Sprain, moderate pain, limited mobility" },
  { value: 3, label: "Serious",  description: "Fracture, significant pain, cannot walk" },
  { value: 4, label: "Critical", description: "Life-threatening, unconscious, severe bleeding" },
  { value: 5, label: "Fatal",    description: "Fatality on trail" },
];

export const HAZARD_TYPES = [
  "Fallen Tree",
  "Flooding",
  "Landslide",
  "Washed-out Bridge",
  "Unsafe Cliff Edge",
  "Wildlife",
  "Fire Damage",
  "Other",
];

export const ASSESSMENT_VERDICTS = {
  GO:      { label: "Go",          className: "go",      icon: "✓" },
  CAUTION: { label: "Caution",     className: "caution", icon: "⚠" },
  NO_GO:   { label: "Do Not Go",   className: "no-go",   icon: "✕" },
};

export const TRAIL_STATUS = {
  OPEN:    { label: "Open",    className: "open" },
  CAUTION: { label: "Caution", className: "caution" },
  CLOSED:  { label: "Closed",  className: "closed" },
};
