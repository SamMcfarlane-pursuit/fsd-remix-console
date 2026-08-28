// src/lib/geofence.ts
// Physical floor constraints and Assembly Point Geo-Fence validation engine
// for Floor 07 at Con Edison Facility (4 Irving Place, NY)

import { LocationCategory, QuadrantId } from "../types";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // in meters
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface FloorCADPosition {
  x: number; // 0 - 1000
  y: number; // 0 - 600
  floor?: number | string;
  quadrant?: QuadrantId;
  deskId?: string;
}

export interface LocationMetadata {
  coords?: GeoCoordinates | null;
  cad?: FloorCADPosition | null;
  source?: "gps" | "kiosk_beacon" | "qr_scanner" | "wifi_rtt" | "manual";
  floor?: number | string;
  claimedZone?: string;
  timestamp?: number;
}

export interface AssemblyPointDefinition {
  id: string;
  name: string;
  code: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  description: string;
}

export interface FloorPhysicalConstraints {
  facilityId: string;
  facilityName: string;
  floorNumber: number;
  buildingCenter: { lat: number; lng: number };
  buildingBoundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  buildingRadiusMeters: number;
  cadBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  assemblyPoints: AssemblyPointDefinition[];
}

export const FLOOR_07_CONSTRAINTS: FloorPhysicalConstraints = {
  facilityId: "coned-4-irving-fl07",
  facilityName: "Con Edison Headquarters · 4 Irving Place",
  floorNumber: 7,
  buildingCenter: {
    lat: 40.73516,
    lng: -73.98865,
  },
  buildingBoundingBox: {
    minLat: 40.73460,
    maxLat: 40.73570,
    minLng: -73.98940,
    maxLng: -73.98790,
  },
  buildingRadiusMeters: 75,
  cadBounds: {
    minX: 0,
    maxX: 1000,
    minY: 0,
    maxY: 600,
  },
  assemblyPoints: [
    {
      id: "asm-pt-a",
      name: "Assembly Point A (Park Plaza / Union Sq East)",
      code: "AP-A",
      center: { lat: 40.73595, lng: -73.98990 },
      radiusMeters: 80,
      description: "Primary Outdoor Assembly Zone - Park Plaza & Union Square East",
    },
    {
      id: "asm-pt-b",
      name: "Assembly Point B (Irving Place Sidewalk North)",
      code: "AP-B",
      center: { lat: 40.73420, lng: -73.98840 },
      radiusMeters: 65,
      description: "Secondary Outdoor Assembly - 15th St & Irving Place North Sidewalk",
    },
    {
      id: "asm-pt-c",
      name: "Assembly Point C (14th St South Concourse)",
      code: "AP-C",
      center: { lat: 40.73350, lng: -73.98750 },
      radiusMeters: 70,
      description: "Tertiary Outdoor Assembly - 14th St Pedestrian Plaza South",
    },
  ],
};

/**
 * Calculates Haversine distance in meters between two GPS coordinates
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface GeofenceValidationResult {
  locationCategory: LocationCategory;
  isInsideBuilding: boolean;
  isAtAssemblyPoint: boolean;
  assemblyPoint: string | null;
  detectedQuadrant: QuadrantId | null;
  resolvedLocationString: string;
  distanceToBuildingCenterMeters: number | null;
  distanceToNearestAssemblyMeters: number | null;
  nearestAssemblyPoint: AssemblyPointDefinition | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "HARDWARE_BEACON";
  auditDetails: string;
  rawMetadata: LocationMetadata;
}

/**
 * Core Geo-Fence Validation function
 * Compares current location metadata (GPS coordinates, CAD bounds, Wi-Fi/Kiosk Beacon)
 * against physical Floor 07 boundaries & designated exterior muster points.
 */
export function validateGeofence(
  metadata: LocationMetadata | null | undefined,
  constraints: FloorPhysicalConstraints = FLOOR_07_CONSTRAINTS
): GeofenceValidationResult {
  const safeMeta: LocationMetadata = metadata || { source: "manual" };
  const { coords, cad, source } = safeMeta;

  // 1. If explicit Floor CAD coordinates are provided (e.g. Kiosk, Touch Map or Indoor Positioning)
  if (cad && typeof cad.x === "number" && typeof cad.y === "number") {
    const isWithinCadX = cad.x >= constraints.cadBounds.minX && cad.x <= constraints.cadBounds.maxX;
    const isWithinCadY = cad.y >= constraints.cadBounds.minY && cad.y <= constraints.cadBounds.maxY;
    const isFloor07 = !cad.floor || String(cad.floor).includes("7");

    if (isWithinCadX && isWithinCadY && isFloor07) {
      let quad: QuadrantId = cad.quadrant || "NW";
      if (!cad.quadrant) {
        const isEast = cad.x >= 500;
        const isSouth = cad.y >= 300;
        quad = isEast ? (isSouth ? "SE" : "NE") : (isSouth ? "SW" : "NW");
      }

      const locName = cad.deskId
        ? `Desk ${cad.deskId} (${quad} Zone Floor 07)`
        : `${quad} Quadrant Floor 07`;

      return {
        locationCategory: "inside-building",
        isInsideBuilding: true,
        isAtAssemblyPoint: false,
        assemblyPoint: null,
        detectedQuadrant: quad,
        resolvedLocationString: locName,
        distanceToBuildingCenterMeters: 0,
        distanceToNearestAssemblyMeters: 90,
        nearestAssemblyPoint: constraints.assemblyPoints[0],
        confidence: source === "kiosk_beacon" ? "HARDWARE_BEACON" : "HIGH",
        auditDetails: `Physical CAD boundary verified on Floor 07 [X:${cad.x}, Y:${cad.y}] -> ${quad} Zone`,
        rawMetadata: safeMeta,
      };
    }
  }

  // 2. If GPS Coordinates are supplied (Browser Geolocation / Device GPS)
  if (coords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
    const distToBuildingCenter = calculateHaversineDistanceMeters(
      coords.latitude,
      coords.longitude,
      constraints.buildingCenter.lat,
      constraints.buildingCenter.lng
    );

    const isInBuildingBox =
      coords.latitude >= constraints.buildingBoundingBox.minLat &&
      coords.latitude <= constraints.buildingBoundingBox.maxLat &&
      coords.longitude >= constraints.buildingBoundingBox.minLng &&
      coords.longitude <= constraints.buildingBoundingBox.maxLng;

    // Check all exterior assembly points
    let matchedAssembly: AssemblyPointDefinition | null = null;
    let closestAssembly: AssemblyPointDefinition = constraints.assemblyPoints[0];
    let minAssemblyDist = Infinity;

    for (const ap of constraints.assemblyPoints) {
      const dist = calculateHaversineDistanceMeters(
        coords.latitude,
        coords.longitude,
        ap.center.lat,
        ap.center.lng
      );
      if (dist < minAssemblyDist) {
        minAssemblyDist = dist;
        closestAssembly = ap;
      }
      if (dist <= ap.radiusMeters) {
        matchedAssembly = ap;
      }
    }

    const accuracy = coords.accuracy || 15;
    const confidence = accuracy <= 10 ? "HIGH" : accuracy <= 35 ? "MEDIUM" : "LOW";

    // 2A. Matched an Exterior Assembly Point
    if (matchedAssembly) {
      return {
        locationCategory: "outside-assembly",
        isInsideBuilding: false,
        isAtAssemblyPoint: true,
        assemblyPoint: matchedAssembly.name,
        detectedQuadrant: null,
        resolvedLocationString: matchedAssembly.name,
        distanceToBuildingCenterMeters: Math.round(distToBuildingCenter),
        distanceToNearestAssemblyMeters: Math.round(minAssemblyDist),
        nearestAssemblyPoint: matchedAssembly,
        confidence,
        auditDetails: `Geo-fence match: ${matchedAssembly.name} (${Math.round(minAssemblyDist)}m from muster beacon, accuracy ±${Math.round(accuracy)}m)`,
        rawMetadata: safeMeta,
      };
    }

    // 2B. Inside Building Perimeter & Floor Bounding Box
    if (isInBuildingBox || distToBuildingCenter <= constraints.buildingRadiusMeters) {
      // Determine approximate quadrant based on offset from building center
      const latDiff = coords.latitude - constraints.buildingCenter.lat;
      const lngDiff = coords.longitude - constraints.buildingCenter.lng;
      const isNorth = latDiff >= 0;
      const isEast = lngDiff >= 0;
      const quad: QuadrantId = isNorth ? (isEast ? "NE" : "NW") : isEast ? "SE" : "SW";

      return {
        locationCategory: "inside-building",
        isInsideBuilding: true,
        isAtAssemblyPoint: false,
        assemblyPoint: null,
        detectedQuadrant: quad,
        resolvedLocationString: `${quad} Floor 07 (Physical Perimeter Verified)`,
        distanceToBuildingCenterMeters: Math.round(distToBuildingCenter),
        distanceToNearestAssemblyMeters: Math.round(minAssemblyDist),
        nearestAssemblyPoint: closestAssembly,
        confidence,
        auditDetails: `Building interior geo-fence satisfied: ${Math.round(distToBuildingCenter)}m from core [Lat ${coords.latitude.toFixed(5)}, Lng ${coords.longitude.toFixed(5)}]`,
        rawMetadata: safeMeta,
      };
    }

    // 2C. Outside Both Building & Assembly Points (> 180m away)
    return {
      locationCategory: "offsite",
      isInsideBuilding: false,
      isAtAssemblyPoint: false,
      assemblyPoint: null,
      detectedQuadrant: null,
      resolvedLocationString: `Off-Site / Remote (${Math.round(distToBuildingCenter)}m from facility)`,
      distanceToBuildingCenterMeters: Math.round(distToBuildingCenter),
      distanceToNearestAssemblyMeters: Math.round(minAssemblyDist),
      nearestAssemblyPoint: closestAssembly,
      confidence,
      auditDetails: `Off-site detection: ${Math.round(distToBuildingCenter)}m from Con Ed facility (outside building & assembly zones)`,
      rawMetadata: safeMeta,
    };
  }

  // 3. Fallback / Context-based validation if no raw GPS available
  const claimed = (safeMeta.claimedZone || "").toLowerCase();
  if (claimed.includes("assembly") || claimed.includes("plaza") || claimed.includes("outside") || claimed.includes("park")) {
    const defaultAP = constraints.assemblyPoints[0];
    return {
      locationCategory: "outside-assembly",
      isInsideBuilding: false,
      isAtAssemblyPoint: true,
      assemblyPoint: defaultAP.name,
      detectedQuadrant: null,
      resolvedLocationString: defaultAP.name,
      distanceToBuildingCenterMeters: 85,
      distanceToNearestAssemblyMeters: 10,
      nearestAssemblyPoint: defaultAP,
      confidence: "MEDIUM",
      auditDetails: `Assembly point confirmed via zone claim: ${defaultAP.name}`,
      rawMetadata: safeMeta,
    };
  }

  if (claimed.includes("offsite") || claimed.includes("remote") || claimed.includes("home") || claimed.includes("leave")) {
    return {
      locationCategory: "offsite",
      isInsideBuilding: false,
      isAtAssemblyPoint: false,
      assemblyPoint: null,
      detectedQuadrant: null,
      resolvedLocationString: "Off-Site / Exited Facility",
      distanceToBuildingCenterMeters: 500,
      distanceToNearestAssemblyMeters: 450,
      nearestAssemblyPoint: constraints.assemblyPoints[0],
      confidence: "MEDIUM",
      auditDetails: "Off-site exit verified via departure claim",
      rawMetadata: safeMeta,
    };
  }

  // Default to Floor 07 Inside Building
  return {
    locationCategory: "inside-building",
    isInsideBuilding: true,
    isAtAssemblyPoint: false,
    assemblyPoint: null,
    detectedQuadrant: "NW",
    resolvedLocationString: "NW Floor 07",
    distanceToBuildingCenterMeters: 15,
    distanceToNearestAssemblyMeters: 90,
    nearestAssemblyPoint: constraints.assemblyPoints[0],
    confidence: "MEDIUM",
    auditDetails: "Default Floor 07 station constraints applied",
    rawMetadata: safeMeta,
  };
}

/**
 * Helper to prompt browser for current high-accuracy device geolocation
 */
export async function getDeviceGeolocation(): Promise<GeoCoordinates | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
      },
      (err) => {
        console.warn("Geolocation prompt skipped or unavailable:", err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 10000,
      }
    );
  });
}
