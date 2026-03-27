import { useState } from "react";
import { getTrailAssessment } from "../services/assessmentService.js";

/**
 * Derive experience tier label from hike count.
 * Mirrors the server-side rule in Hiker_Profile_Service._derive_experience_rating.
 */
export function deriveExpLevel(totalHikesCompleted = 0) {
  if (totalHikesCompleted >= 15) return "advanced";
  if (totalHikesCompleted >= 5)  return "intermediate";
  return "beginner";
}

/**
 * Normalize the raw orchestrator AssessmentResponse into a UI-friendly shape.
 *
 * Maps:
 *   finalDecision (GO|CAUTION|DO_NOT_GO) → verdict (GO|CAUTION|NO_GO)
 *   confidenceScore (0.0-1.0)            → confidence (0-100 integer)
 *   trailMeta.trailName                  → trailName
 *   weatherData.*                        → weather.*
 *   trailConditions + trailMeta          → trailStatus.*
 *   incidentData.*                       → incidents.*
 *   completionEstimate.*                 → completion.*
 *   keyReasons                           → keyReasons (pass-through)
 *   warnings                             → warnings (pass-through)
 */
function normalizeAssessment(raw) {
  const decisionMap = { GO: "GO", CAUTION: "CAUTION", DO_NOT_GO: "NO_GO" };
  return {
    verdict:    decisionMap[raw.finalDecision] ?? "CAUTION",
    confidence: Math.round((raw.confidenceScore ?? 0.75) * 100),
    trailName:  raw.trailMeta?.trailName || raw.trailId,
    date:       raw.plannedDate,
    startTime:  raw.plannedStartTime,
    reasoning:  raw.reasoning || "",
    keyReasons: raw.keyReasons || [],
    warnings:   raw.warnings  || [],

    weather: {
      temp:       raw.weatherData?.temperatureC,
      feelsLike:  raw.weatherData?.feelsLikeC,
      wind:       raw.weatherData?.windSpeedKph,
      humidity:   raw.weatherData?.humidity,
      conditions: raw.weatherData?.conditions,
      severity:   raw.weatherData?.severity,
      uvIndex:    raw.weatherData?.uvIndex,
      safetyFlags:raw.weatherData?.safetyFlags ?? [],
    },

    trailStatus: {
      operationalStatus:  raw.trailConditions?.operationalStatus,
      activeHazardCounts: raw.trailConditions?.activeHazardCounts ?? 0,
      highestSeverity:    raw.trailConditions?.highestSeverity ?? "none",
      hazardTypes:        raw.trailConditions?.hazardTypes ?? [],
      difficulty:         raw.trailMeta?.difficulty,
    },

    incidents: {
      count30Days: raw.incidentData?.incidentCount30Days ?? 0,
      count90Days: raw.incidentData?.incidentCount90Days ?? 0,
    },

    completion: {
      estimatedDuration:   raw.completionEstimate?.estimatedDurationHuman,
      estimatedReturn:     raw.completionEstimate?.estimatedReturnTime,
      returnsBeforeSunset: raw.completionEstimate?.returnsBeforeSunset,
    },

    // pass raw through so consumers can access any field
    _raw: raw,
  };
}

export function useAssessment() {
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function assess(payload) {
    setLoading(true);
    setError(null);
    try {
      const raw        = await getTrailAssessment(payload);
      const normalized = normalizeAssessment(raw);
      setResult(normalized);
      return normalized;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { result, loading, error, assess };
}
