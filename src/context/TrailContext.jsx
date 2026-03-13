import { createContext, useState } from "react";

export const TrailContext = createContext(null);

export function TrailProvider({ children }) {
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [assessmentResult, setAssessmentResult] = useState(null);

  return (
    <TrailContext.Provider
      value={{ selectedTrail, setSelectedTrail, assessmentResult, setAssessmentResult }}
    >
      {children}
    </TrailContext.Provider>
  );
}
