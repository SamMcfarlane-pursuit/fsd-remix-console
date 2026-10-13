/**
 * Single source of truth for the Step 03 → Step 04 → Occupant phone pipeline.
 * Hazard, stairwell, and assembly-point values chosen in Step 03 flow unchanged
 * into the Step 04 broadcast composer and onto every occupant's phone, so they
 * must all come from this one list.
 *
 * Floor 07 has exactly two egress cores (Stair A east, Stair B west) and two
 * outdoor muster points (A and B). Do not add options that don't exist on the map.
 */

export const STAIRWELL_OPTIONS = [
  "Stairwell A (East Core · Door 7-A)",
  "Stairwell B (West Core · Door 7-B)",
  "Stairwells A & B (Both Cores)",
] as const;

export const ASSEMBLY_POINT_OPTIONS = [
  "Assembly Point A (Park Plaza · East 14th)",
  "Assembly Point B (Courtyard · East 15th)",
] as const;

export const DEFAULT_STAIRWELL = STAIRWELL_OPTIONS[0];
export const DEFAULT_ASSEMBLY_POINT = ASSEMBLY_POINT_OPTIONS[0];

export interface HazardOption {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  desc: string;
  recommendedStairwell: (typeof STAIRWELL_OPTIONS)[number];
}

export const HAZARD_OPTIONS: HazardOption[] = [
  {
    id: "office-fire",
    name: "Office Fire & Smoke Condition",
    shortName: "Office Fire",
    icon: "🔥",
    desc: "Active smoke or thermal detection in office suites. Immediate evacuation required.",
    recommendedStairwell: "Stairwell A (East Core · Door 7-A)",
  },
  {
    id: "gas-leak",
    name: "Natural Gas Leak / Odor",
    shortName: "Gas Leak",
    icon: "⛽",
    desc: "Combustible gas detection. No elevators, avoid electrical switches.",
    recommendedStairwell: "Stairwell B (West Core · Door 7-B)",
  },
  {
    id: "power-outage",
    name: "Electrical / Power Failure",
    shortName: "Power Failure",
    icon: "⚡",
    desc: "Floor 07 circuit trip. Emergency egress lighting active.",
    recommendedStairwell: "Stairwells A & B (Both Cores)",
  },
  {
    id: "active-threat",
    name: "Security Alert / Active Threat",
    shortName: "Security Alert",
    icon: "⚠️",
    desc: "Security perimeter breach. Follow warden direction for egress.",
    recommendedStairwell: "Stairwells A & B (Both Cores)",
  },
  {
    id: "severe-weather",
    name: "Severe Weather / Structural",
    shortName: "Severe Weather",
    icon: "🌪️",
    desc: "High wind, shattered glass, or flooding condition.",
    recommendedStairwell: "Stairwell A (East Core · Door 7-A)",
  },
];

export function getHazard(id?: string | null): HazardOption {
  return HAZARD_OPTIONS.find((h) => h.id === id) || HAZARD_OPTIONS[0];
}

/** Coerce any legacy/free-text value back to a real option on the floor map. */
export function normalizeStairwell(value?: string | null): string {
  if (!value) return DEFAULT_STAIRWELL;
  if ((STAIRWELL_OPTIONS as readonly string[]).includes(value)) return value;
  if (/a\s*&\s*b|both|all/i.test(value)) return STAIRWELL_OPTIONS[2];
  if (/stair\w*\s*b|west/i.test(value)) return STAIRWELL_OPTIONS[1];
  return STAIRWELL_OPTIONS[0];
}

export function normalizeAssemblyPoint(value?: string | null): string {
  if (!value) return DEFAULT_ASSEMBLY_POINT;
  if ((ASSEMBLY_POINT_OPTIONS as readonly string[]).includes(value)) return value;
  if (/point\s*b|courtyard|irving/i.test(value)) return ASSEMBLY_POINT_OPTIONS[1];
  return ASSEMBLY_POINT_OPTIONS[0];
}

/** Short label like "Stairwell A" for compact displays. */
export function shortStairwell(value: string): string {
  return value.split(" (")[0];
}

export function buildBroadcastDefaults(opts: {
  mode: "drill" | "incident" | null | undefined;
  hazardId: string | null | undefined;
  stairwell: string;
  assemblyPoint: string;
}) {
  const hazard = getHazard(opts.hazardId);
  const isIncident = opts.mode === "incident";
  const title = isIncident
    ? `🚨 EVACUATE NOW: ${hazard.shortName.toUpperCase()} ON FLOOR 07`
    : `🎯 DRILL: ${hazard.shortName.toUpperCase()} EVACUATION EXERCISE`;
  const narrative = isIncident
    ? `Attention Floor 07: this is a real emergency. ${hazard.name} reported. Evacuate now via ${opts.stairwell} and report to ${opts.assemblyPoint}. Do not use elevators. Tap "Safe Outside" on your phone when you arrive.`
    : `Attention Floor 07: this is a scheduled evacuation drill (${hazard.shortName}). Proceed calmly via ${opts.stairwell} to ${opts.assemblyPoint}. Do not use elevators. Tap "Safe Outside" on your phone when you arrive.`;
  return { title, narrative, priority: (isIncident ? "CRITICAL" : "HIGH") as "CRITICAL" | "HIGH" };
}
