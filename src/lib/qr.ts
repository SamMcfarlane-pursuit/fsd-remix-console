/**
 * Unified QR Code Standards & Attendance Ingestion Utilities
 * Supports ISO/IEC 18004 Standard QR codes, universal smartphone deep links,
 * optical turnstile badge tokens, and muster station posters.
 */

export interface ParsedQRResult {
  type: "occupant" | "station" | "token" | "unknown";
  occupantId?: string;
  badgeCode?: string;
  quadrant?: string;
  stationName?: string;
  locationCategory?: "inside-building" | "outside-assembly" | "offsite";
  token?: string;
  phone?: string;
  name?: string;
  rawText: string;
}

// Cached mobile network origin (e.g., http://192.168.1.60:3000)
let cachedMobileOrigin: string = "";

/**
 * Retrieve the reachable mobile origin for QR codes
 * (replaces localhost with LAN IP so phone cameras can connect seamlessly)
 */
export function getMobileNetworkOrigin(): string {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("muster_custom_network_origin");
    if (custom) return custom;

    const stored = localStorage.getItem("muster_mobile_network_origin");
    if (stored) return stored;

    const winOrigin = window.location.origin;
    if (!winOrigin.includes("localhost") && !winOrigin.includes("127.0.0.1")) {
      return winOrigin;
    }
  }
  return cachedMobileOrigin || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
}

/**
 * Set custom mobile network origin override (e.g. cloud tunnel or LAN IP)
 */
export function setCustomMobileOrigin(origin: string): void {
  if (typeof window !== "undefined") {
    if (origin.trim()) {
      localStorage.setItem("muster_custom_network_origin", origin.trim());
    } else {
      localStorage.removeItem("muster_custom_network_origin");
    }
    window.dispatchEvent(new CustomEvent("muster-origin-changed", { detail: { origin } }));
  }
}

/**
 * Query backend to discover server's local LAN IPv4 address
 */
export async function discoverMobileOrigin(): Promise<string> {
  try {
    const res = await fetch("/api/system/network-info");
    if (res.ok) {
      const data = await res.json();
      if (data.mobileOrigin) {
        cachedMobileOrigin = data.mobileOrigin;
        if (typeof window !== "undefined") {
          localStorage.setItem("muster_mobile_network_origin", data.mobileOrigin);
          window.dispatchEvent(new CustomEvent("muster-origin-changed", { detail: { origin: data.mobileOrigin } }));
        }
        return data.mobileOrigin;
      }
    }
  } catch (e) {
    console.warn("Could not discover mobile network origin:", e);
  }
  return getMobileNetworkOrigin();
}

/**
 * Auto-discover on module load in browser
 */
if (typeof window !== "undefined") {
  discoverMobileOrigin().catch(() => {});
}

/**
 * Generate standard Turnstile Badge QR payload that is both
 * (1) directly decodable by optical kiosk hardware (extracts OCC-xxx / CONED-BADGE-xxx)
 * (2) clickable / openable by any native iOS / Android camera app
 */
export function generateOccupantBadgePayload(
  occupantId: string,
  quadrant: string = "NW",
  originUrl?: string
): string {
  const origin = originUrl || getMobileNetworkOrigin();
  if (origin) {
    return `${origin}/?mode=signin&id=${occupantId}&badge=CONED-BADGE-${occupantId}-${quadrant}&quad=${quadrant}`;
  }
  return `CONED-BADGE-${occupantId}-${quadrant}`;
}

/**
 * Generate standard Muster Station Poster QR payload
 */
export function generateStationPosterPayload(
  station: "AssemblyPointA" | "AssemblyPointB" | "Floor07Kiosk" | string,
  originUrl?: string
): string {
  const origin = originUrl || getMobileNetworkOrigin();
  const loc = station.includes("Floor") || station.includes("Kiosk") ? "inside-building" : "outside-assembly";
  return `${origin}/?station=${encodeURIComponent(station)}&loc=${loc}&scan=1`;
}

/**
 * Robust, universal QR payload parser
 * Parses URLs, badge codes, plain IDs, JSON, and phone numbers
 */
export function parseQRData(rawInput: string): ParsedQRResult {
  if (!rawInput || !rawInput.trim()) {
    return { type: "unknown", rawText: "" };
  }

  const raw = rawInput.trim();

  // 1. Check if rawInput is a JSON payload
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const obj = JSON.parse(raw);
      const id = obj.id || obj.occupantId || obj.badgeId;
      if (id) {
        return {
          type: "occupant",
          occupantId: String(id).toUpperCase(),
          badgeCode: obj.badgeCode || `CONED-BADGE-${id}-${obj.quadrant || "NW"}`,
          quadrant: obj.quadrant,
          name: obj.name,
          phone: obj.phone,
          rawText: raw,
        };
      }
    } catch {}
  }

  // 2. Check if rawInput is a URL
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.includes("?mode=") || raw.includes("?station=") || raw.includes("?id=")) {
    try {
      const parsedUrl = new URL(raw.startsWith("http") ? raw : `http://dummy.local/${raw}`);
      const params = parsedUrl.searchParams;

      const station = params.get("station");
      const loc = params.get("loc") as "inside-building" | "outside-assembly" | "offsite" | null;
      const token = params.get("token");
      const id = params.get("id") || params.get("occupantId") || params.get("user");
      const badge = params.get("badge");
      const phone = params.get("phone");
      const name = params.get("name");
      const quad = params.get("quad") || params.get("quadrant");

      if (station) {
        let stationReadable = station;
        if (station === "AssemblyPointA") stationReadable = "Assembly Point A (Park Plaza)";
        if (station === "AssemblyPointB") stationReadable = "Assembly Point B (Courtyard)";
        if (station === "Floor07Kiosk") stationReadable = "Floor 07 Main Entrance Kiosk";

        return {
          type: "station",
          stationName: stationReadable,
          locationCategory: loc || (station.includes("Floor") ? "inside-building" : "outside-assembly"),
          rawText: raw,
        };
      }

      if (token) {
        return {
          type: "token",
          token,
          rawText: raw,
        };
      }

      if (id || badge) {
        let resolvedId = id || "";
        if (!resolvedId && badge) {
          const match = badge.match(/CONED-BADGE-(OCC-\d+|VIS-\d+|[A-Za-z0-9_-]+)/i);
          resolvedId = match ? match[1] : badge;
        }
        return {
          type: "occupant",
          occupantId: resolvedId.toUpperCase(),
          badgeCode: badge || `CONED-BADGE-${resolvedId}`,
          quadrant: quad || undefined,
          phone: phone || undefined,
          name: name || undefined,
          rawText: raw,
        };
      }
    } catch {}
  }

  // 3. Check for standard CONED-BADGE format
  const badgeMatch = raw.match(/CONED-BADGE-(OCC-\d+|VIS-\d+|[A-Za-z0-9_-]+)(?:-([A-Z]{2}))?/i);
  if (badgeMatch && badgeMatch[1]) {
    return {
      type: "occupant",
      occupantId: badgeMatch[1].toUpperCase(),
      quadrant: badgeMatch[2] || undefined,
      badgeCode: raw,
      rawText: raw,
    };
  }

  // 4. Check for Station Poster strings
  if (raw.toLowerCase().includes("station") || raw.toLowerCase().includes("assembly") || raw.toLowerCase().includes("kiosk")) {
    let stationName = "Assembly Point A (Park Plaza)";
    let loc: "inside-building" | "outside-assembly" = "outside-assembly";

    if (raw.toLowerCase().includes("point b") || raw.toLowerCase().includes("courtyard") || raw.toLowerCase().includes("assemblypointb")) {
      stationName = "Assembly Point B (Courtyard)";
    } else if (raw.toLowerCase().includes("floor") || raw.toLowerCase().includes("kiosk") || raw.toLowerCase().includes("inside")) {
      stationName = "Floor 07 Main Entrance Kiosk";
      loc = "inside-building";
    }

    return {
      type: "station",
      stationName,
      locationCategory: loc,
      rawText: raw,
    };
  }

  // 5. Check for plain OCC-xxx or VIS-xxx ID
  const idMatch = raw.match(/^(OCC-\d+|VIS-\d+)$/i);
  if (idMatch) {
    return {
      type: "occupant",
      occupantId: idMatch[1].toUpperCase(),
      rawText: raw,
    };
  }

  // 6. Check for phone number (digits only >= 7)
  const cleanDigits = raw.replace(/\D/g, "");
  if (cleanDigits.length >= 10 && cleanDigits.length <= 15) {
    return {
      type: "occupant",
      phone: raw,
      rawText: raw,
    };
  }

  // 7. Treat as occupant Name
  if (raw.length >= 2 && !raw.includes("/")) {
    return {
      type: "occupant",
      name: raw,
      rawText: raw,
    };
  }

  return {
    type: "unknown",
    rawText: raw,
  };
}
