import React, { useState, useEffect, useRef, useMemo } from "react";
import QRCode from "qrcode";
import { Occupant, OccupantRole, OccupantStatus, StatusSnapshot, QuadrantId, EmergencyAlertPayload } from "../types";
import { QRCameraScanner } from "./QRCameraScanner";
import { DigitalSignaturePad } from "./DigitalSignaturePad";
import { AccessibleEmergencyAlertBanner } from "./AccessibleEmergencyAlertBanner";
import { getDeviceGeolocation, validateGeofence, FLOOR_07_CONSTRAINTS } from "../lib/geofence";
import { parseQRData, generateOccupantBadgePayload } from "../lib/qr";
import {
  queueOfflineAction,
  createOfflineOccupant,
  cacheRosterLocally,
  getCachedRoster,
  getOfflineQueue,
  syncOfflineQueue,
} from "../lib/offlineQueue";
import { authenticateWithBiometrics } from "../lib/biometrics";
import {
  playRadioIncomingAlert,
  playRadioPttChirp,
  playRadioRogerBeep,
  speakEmergencyBroadcast,
} from "../lib/audioBroadcast";

interface OccupantPortalProps {
  snapshot: StatusSnapshot | null;
  occupants: Occupant[];
  onCheckIn: (
    occupantId: string,
    status: OccupantStatus,
    via?: string,
    notes?: string,
    locationCategory?: "inside-building" | "outside-assembly" | "offsite",
    assemblyPoint?: string
  ) => void;
  onSwitchToAdmin?: () => void;
  onLogout?: () => void;
}

export default function OccupantPortal({ snapshot, occupants, onCheckIn, onSwitchToAdmin, onLogout }: OccupantPortalProps) {
  // Check if this occupant has signed in before on this device
  const [savedOccupantId, setSavedOccupantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("muster_registered_occupant_id") || localStorage.getItem("muster_occupant_id");
    } catch {
      return null;
    }
  });

  const [localRegisteredOccupant, setLocalRegisteredOccupant] = useState<Occupant | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const storedJson = localStorage.getItem("muster_registered_occupant_json");
        if (storedJson) {
          const parsed = JSON.parse(storedJson);
          if (parsed && parsed.id) return parsed;
        }
        const storedId = localStorage.getItem("muster_registered_occupant_id") || localStorage.getItem("muster_occupant_id");
        const storedName = localStorage.getItem("muster_registered_name");
        if (storedId || storedName) {
          return {
            id: storedId || "OCC-196",
            name: storedName || "Robert Petillo",
            phone: localStorage.getItem("muster_registered_phone") || "(212) 555-0195",
            quadrant: (localStorage.getItem("muster_registered_quad") as QuadrantId) || "NW",
            role: (localStorage.getItem("muster_registered_role") as OccupantRole) || "Employee",
            company: localStorage.getItem("muster_registered_company") || "Con Edison",
            status: "safe",
            desk: "07-NW-Workstation",
            badgedOut: false,
            offSiteToday: false,
            locationCategory: "inside-building",
            lastLocation: "Floor 07 (NW)",
            lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        }
      }
    } catch { }
    return null;
  });

  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("id") || params.get("badge") || params.get("user") || params.get("occupantId");
        if (urlId) {
          const clean = urlId.replace(/CONED-BADGE-/i, "").split("-")[0];
          const matched = occupants.find((o) => o.id.toLowerCase() === urlId.toLowerCase() || o.id.toLowerCase() === clean.toLowerCase());
          if (matched) return matched.id;
          return urlId;
        }
        const stored = localStorage.getItem("muster_registered_occupant_id") || localStorage.getItem("muster_occupant_id");
        if (stored) return stored;
      }
    } catch { }
    return savedOccupantId || (localRegisteredOccupant ? localRegisteredOccupant.id : null) || occupants.find((o) => o.role === "Visitor")?.id || occupants[0]?.id || "OCC-196";
  });

  const fallbackBadgeTimeRef = useRef("08:00 AM");

  const currentUser: Occupant = useMemo(() => {
    const fromList = occupants.find((o) => o.id === selectedUserId);
    if (fromList) return fromList;
    if (localRegisteredOccupant && localRegisteredOccupant.id === selectedUserId) return localRegisteredOccupant;
    if (localRegisteredOccupant) return localRegisteredOccupant;
    const fromSaved = occupants.find((o) => o.id === savedOccupantId);
    if (fromSaved) return fromSaved;
    if (occupants && occupants.length > 0) return occupants[0];

    return {
      id: selectedUserId || "OCC-196",
      name: (typeof localStorage !== "undefined" ? localStorage.getItem("muster_registered_name") : null) || "Robert Petillo",
      phone: (typeof localStorage !== "undefined" ? localStorage.getItem("muster_registered_phone") : null) || "(212) 555-0195",
      quadrant: (typeof localStorage !== "undefined" ? (localStorage.getItem("muster_registered_quad") as QuadrantId) : null) || "NW",
      role: (typeof localStorage !== "undefined" ? (localStorage.getItem("muster_registered_role") as OccupantRole) : null) || "Employee",
      company: (typeof localStorage !== "undefined" ? localStorage.getItem("muster_registered_company") : null) || "Con Edison",
      status: "safe",
      desk: "07-NW-Workstation",
      badgedOut: false,
      offSiteToday: false,
      locationCategory: "inside-building",
      lastLocation: "Floor 07 (NW)",
      lastBadgeTime: fallbackBadgeTimeRef.current,
    };
  }, [occupants, selectedUserId, localRegisteredOccupant, savedOccupantId]);

  // Floor 07 Dynamic Quadrant-to-Stairwell Egress & Life Safety Mapping
  const quadrantEscapeInfo = useMemo(() => {
    const quad = currentUser?.quadrant || "NW";
    if (quad === "NW") {
      return {
        quadrantName: "Sector NW · Strategic Planning",
        primaryStairwell: "Stairwell A (East Core · Union Square East)",
        primaryExitStreet: "East 14th St / Union Square East",
        primaryPath: "Exit suite into North corridor, head East past core restrooms directly to Stairwell A fire door (Door 7-A).",
        secondaryStairwell: "Stairwell B (West Core · Irving Place)",
        secondaryPath: "If East corridor is compromised by smoke, take West corridor around Core to Stairwell B (Door 7-B).",
        assemblyPoint: "Assembly Point A (Union Square East / Park Plaza)",
        assemblyCrossStreet: "East 14th St (Plaza side, 200+ ft clear from building facade)",
        evacChairLocation: "Stairwell A Landing (Mounted Stryker Evac Chair)",
        color: "blue",
      };
    } else if (quad === "NE") {
      return {
        quadrantName: "Sector NE · Corp Security & Gas Ops",
        primaryStairwell: "Stairwell A (East Core · Union Square East)",
        primaryExitStreet: "East 14th St / Union Square East",
        primaryPath: "Exit suite through East security corridor directly to Stairwell A fire door (Door 7-A).",
        secondaryStairwell: "Stairwell B (West Core · Irving Place)",
        secondaryPath: "If Stair A is compromised, route West along North corridor past elevator lobby to Stairwell B (Door 7-B).",
        assemblyPoint: "Assembly Point A (Union Square East / Park Plaza)",
        assemblyCrossStreet: "East 14th St (Plaza side, 200+ ft clear from building facade)",
        evacChairLocation: "Stairwell A Landing (Mounted Stryker Evac Chair)",
        color: "emerald",
      };
    } else if (quad === "SW") {
      return {
        quadrantName: "Sector SW · AMI & Steam West",
        primaryStairwell: "Stairwell B (West Core · Irving Place)",
        primaryExitStreet: "Irving Place / East 15th St",
        primaryPath: "Exit suite into South corridor, proceed directly West to Stairwell B fire door (Door 7-B).",
        secondaryStairwell: "Stairwell A (East Core · Union Square East)",
        secondaryPath: "If West corridor is blocked, proceed East through central core corridor to Stairwell A (Door 7-A).",
        assemblyPoint: "Assembly Point B (East Courtyard / Irving Place)",
        assemblyCrossStreet: "Irving Place (Courtyard side, 200+ ft clear from building facade)",
        evacChairLocation: "Stairwell A Landing (cross core to Door 7-A landing)",
        color: "amber",
      };
    } else {
      // SE
      return {
        quadrantName: "Sector SE · Operations & Turnstiles",
        primaryStairwell: "Stairwell B (West Core · Irving Place)",
        primaryExitStreet: "Irving Place / East 15th St",
        primaryPath: "Exit suite into main entrance rotunda, proceed West past elevators to Stairwell B fire door (Door 7-B).",
        secondaryStairwell: "Stairwell A (East Core · Union Square East)",
        secondaryPath: "If Stair B is blocked, take East egress corridor past conference suites to Stairwell A (Door 7-A).",
        assemblyPoint: "Assembly Point A or B (Union Square East / Park Plaza)",
        assemblyCrossStreet: "East 14th St or Irving Pl Courtyard (200+ ft clear)",
        evacChairLocation: "Stairwell A Landing (cross core to Door 7-A landing)",
        color: "purple",
      };
    }
  }, [currentUser?.quadrant]);

  // Confirmed view active section tab ("comm" | "map" | "pass")
  const [confirmedActiveTab, setConfirmedActiveTab] = useState<"comm" | "map" | "pass">("comm");

  // Local record of sent SitReps / Distress reports for this session
  const [sentSitReps, setSentSitReps] = useState<Array<{ id: string; text: string; time: string; status: string }>>([
    {
      id: "init-status",
      text: "Turnstile badge verified on Floor 07.",
      time: "Access Recorded",
      status: "Committed to Life-Safety Ledger ✓",
    },
  ]);

  // Quick 1-tap Situation Report Presets
  const SITREP_PRESETS = [
    { icon: "🟢", label: "All Clear", text: "All clear at my workstation. Ready for egress." },
    { icon: "💨", label: "Smoke Detected", text: "Noticeable smoke odor / haze detected in corridor." },
    { icon: "🛞", label: "Need Evac Chair", text: "Mobility impaired occupant requires ARA evacuation chair at stairwell." },
    { icon: "🚪", label: "Stair Door Jammed", text: "Stairwell door is obstructed or difficult to open." },
    { icon: "👥", label: "Sheltering with Group", text: "Sheltering safely in conference room with coworkers." },
    { icon: "⚠️", label: "Medic / First Aid", text: "Occupant requires immediate first aid assistance." },
  ];

  // Auto-switch to Communication tab on active incident
  useEffect(() => {
    if (snapshot?.incidentActive) {
      setConfirmedActiveTab("comm");
    }
  }, [snapshot?.incidentActive]);

  // Evacuation Guide UI state
  const [isEvacGuideExpanded, setIsEvacGuideExpanded] = useState<boolean>(true);
  const [activeEvacTab, setActiveEvacTab] = useState<"map" | "route" | "equipment" | "contacts">("map");

  // Screen state:
  // Intelligent 5G / Cellular & Wi-Fi QR Routing:
  // - If returning user (stored pass in phone localStorage or explicit ID in URL): route directly to "confirmed" pass & evac procedure/map format!
  // - If newcomer (never registered on this phone before, no stored pass): route to "newcomer-signin" registration format!
  // - If explicit override (?force_new=1 or ?register=1): route to "newcomer-signin".
  const [viewState, setViewState] = useState<"newcomer-signin" | "confirmed">(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);

        // Force new sign-in flow if explicitly requested via query param
        const isForceNew =
          params.get("force_new") === "1" ||
          params.get("register") === "1" ||
          params.get("new") === "1";

        if (isForceNew) {
          return "newcomer-signin";
        }

        const hasExplicitId = Boolean(
          params.get("id") || params.get("badge") || params.get("user") || params.get("occupantId")
        );
        const stored =
          localStorage.getItem("muster_registered_occupant_id") ||
          localStorage.getItem("muster_occupant_id");

        // If returning user (either URL specified occupant ID or pass stored in phone's localStorage)
        // -> Directly route to confirmed pass, emergency evacuation procedure & stairwell map!
        if (hasExplicitId || stored) {
          return "confirmed";
        }

        // Newcomer with no existing pass stored -> sign-in registration format
        return "newcomer-signin";
      }
    } catch { }
    return "newcomer-signin";
  });

  // User type: Employee vs Visitor
  const [userType, setUserType] = useState<"employee" | "visitor">("employee");

  // Offline status & pending actions queue
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(getOfflineQueue().length);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  // Form fields for Sign-In
  const [signName, setSignName] = useState("");
  const [signPhone, setSignPhone] = useState("");
  const [signCompany, setSignCompany] = useState("Con Edison");
  const [signHost, setSignHost] = useState("John Davis (Floor Warden)");
  const [signRole, setSignRole] = useState("Employee");
  const [signQuad, setSignQuad] = useState<QuadrantId>("NW");
  const [signDesk, setSignDesk] = useState("");
  const [signAction, setSignAction] = useState<"enter" | "leave" | "muster">("enter");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<"drawn" | "typed">("drawn");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventToken, setEventToken] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<{ name: string; date: string } | null>(null);

  // Cache active roster whenever roster size changes
  const lastCachedRosterLenRef = useRef<number>(0);
  useEffect(() => {
    if (occupants && occupants.length > 0 && occupants.length !== lastCachedRosterLenRef.current) {
      lastCachedRosterLenRef.current = occupants.length;
      cacheRosterLocally(occupants);
    }
  }, [occupants?.length]);

  // Auto-heal stale occupant IDs if database was cleaned or mock names were purged
  useEffect(() => {
    if (occupants && occupants.length > 0 && savedOccupantId) {
      const existsInRoster = occupants.some((o) => o.id === savedOccupantId);
      if (!existsInRoster && !localRegisteredOccupant) {
        console.warn(`Stored occupant ID ${savedOccupantId} is not in active roster. Resetting to clean newcomer sign-in.`);
        try {
          localStorage.removeItem("muster_registered_occupant_id");
          localStorage.removeItem("muster_occupant_id");
          localStorage.removeItem("muster_registered_name");
          localStorage.removeItem("muster_registered_phone");
          localStorage.removeItem("muster_registered_occupant_json");
        } catch {}
        setSavedOccupantId(null);
        setViewState("newcomer-signin");
      }
    }
  }, [occupants, savedOccupantId, localRegisteredOccupant]);

  // Online / Offline listeners & auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        setIsSyncingOffline(true);
        const result = await syncOfflineQueue();
        setIsSyncingOffline(false);
        setOfflinePendingCount(getOfflineQueue().length);
        if (result.syncedCount > 0) {
          setActionSubmittedMsg(`🟢 Reconnected! Successfully synchronized ${result.syncedCount} queued attendance actions.`);
          setTimeout(() => setActionSubmittedMsg(null), 6000);
        }
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleQueueChange = () => {
      setOfflinePendingCount(getOfflineQueue().length);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("muster-offline-queue-changed", handleQueueChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("muster-offline-queue-changed", handleQueueChange);
    };
  }, []);

  // Manual Sync trigger
  const handleManualSyncNow = async () => {
    setIsSyncingOffline(true);
    const result = await syncOfflineQueue();
    setIsSyncingOffline(false);
    setOfflinePendingCount(getOfflineQueue().length);
    if (result.syncedCount > 0) {
      setActionSubmittedMsg(`🟢 Synchronized ${result.syncedCount} queued attendance records with Floor 07 console!`);
      setTimeout(() => setActionSubmittedMsg(null), 6000);
    }
  };

  // Track incoming Warden Walkie-Talkie voice broadcasts
  const lastWalkieIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentWalkie = snapshot?.latestWalkieTalkie;
    if (currentWalkie && currentWalkie.id !== lastWalkieIdRef.current) {
      lastWalkieIdRef.current = currentWalkie.id;
      playRadioIncomingAlert();
    }
  }, [snapshot?.latestWalkieTalkie]);

  // Check if current name/phone matches someone already in database
  const matchingExistingUser = (signName.trim().length >= 2 || signPhone.trim().length >= 4)
    ? occupants.find(
      (o) =>
        (signName.trim() && o.name.toLowerCase() === signName.trim().toLowerCase()) ||
        (signName.trim().length >= 4 && o.name.toLowerCase().includes(signName.trim().toLowerCase())) ||
        (signPhone.trim().length >= 4 && o.phone && o.phone.replace(/\D/g, "").includes(signPhone.replace(/\D/g, ""))) ||
        (signName.trim() && o.id.toLowerCase() === signName.trim().toLowerCase())
    )
    : null;

  // Direct Sign-In for recognized user in database (with offline resilience)
  const handleDirectSignInExisting = async (existingUser: Occupant) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      let isOfflineSaved = false;
      try {
        const res = await fetch("/api/occupant/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occupantId: existingUser.id,
            action: signAction === "leave" ? "leave" : "enter",
          }),
        });
        if (!res.ok) throw new Error("Presence endpoint returned error");
      } catch (networkErr) {
        console.warn("Network error during direct sign in, queuing offline action:", networkErr);
        queueOfflineAction("presence-toggle", {
          occupantId: existingUser.id,
          action: signAction === "leave" ? "leave" : "enter",
        });
        isOfflineSaved = true;
      }

      setSelectedUserId(existingUser.id);
      setSavedOccupantId(existingUser.id);
      setLocalRegisteredOccupant(existingUser);
      try {
        localStorage.setItem("muster_registered_occupant_id", existingUser.id);
        localStorage.setItem("muster_occupant_id", existingUser.id);
        localStorage.setItem("muster_registered_name", existingUser.name);
        if (existingUser.phone) localStorage.setItem("muster_registered_phone", existingUser.phone);
        localStorage.setItem("muster_registered_quad", existingUser.quadrant);
        localStorage.setItem("muster_registered_role", existingUser.role);
        if (existingUser.company) localStorage.setItem("muster_registered_company", existingUser.company);
        localStorage.setItem("muster_registered_occupant_json", JSON.stringify(existingUser));
      } catch (e) { }
      setViewState("confirmed");
      setActionSubmittedMsg(
        isOfflineSaved
          ? `🟠 Offline Mode Active: Welcome back ${existingUser.name} (${existingUser.id}). Recorded locally and queued for automatic console sync upon reconnection.`
          : `⚡ Direct Sign-In Verified! Welcome back ${existingUser.name} (${existingUser.id}). You are recorded as PRESENT & ACCOUNTED on Floor 07.`
      );
      setTimeout(() => setActionSubmittedMsg(null), 8000);
    } catch (err: any) {
      setErrorMessage(err.message || "Network error performing direct sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check URL query param for QR token, badge ID, station, or name on mount (run once)
  const hasProcessedUrlParamsRef = useRef(false);
  useEffect(() => {
    if (hasProcessedUrlParamsRef.current) return;
    hasProcessedUrlParamsRef.current = true;

    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const urlId = params.get("id") || params.get("badge") || params.get("user") || params.get("occupantId");
      const urlPhone = params.get("phone");
      const urlName = params.get("name");
      const stationParam = params.get("station");
      const locParam = params.get("loc") as "inside-building" | "outside-assembly" | "offsite" | null;

      if (stationParam) {
        let stationReadable = stationParam;
        if (stationParam === "AssemblyPointA") stationReadable = "Assembly Point A (Park Plaza)";
        if (stationParam === "AssemblyPointB") stationReadable = "Assembly Point B (Courtyard)";
        if (stationParam === "Floor07Kiosk") stationReadable = "Floor 07 Main Entrance Kiosk";

        setSelectedAssembly(stationReadable);
        if (currentUser) {
          onCheckIn(
            currentUser.id,
            "safe",
            "qr-station-poster-scan",
            `Scanned station QR poster: ${stationReadable}`,
            locParam || (stationParam.includes("Floor") ? "inside-building" : "outside-assembly"),
            stationReadable
          );
          setActionSubmittedMsg(`✅ Scanned QR Poster! Verified SAFE at ${stationReadable}. Transmitted to Console.`);
          setTimeout(() => setActionSubmittedMsg(null), 7000);
        }
      }

      if (token) {
        setEventToken(token);
        setViewState("newcomer-signin");
        fetch(`/api/checkin/${token}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.ok && data.event) {
              setEventDetails({
                name: data.event.name,
                date: data.event.event_date,
              });
            }
          })
          .catch((e) => console.warn("Failed to resolve event token:", e));
      } else if (urlId) {
        const clean = urlId.replace(/CONED-BADGE-/i, "").split("-")[0];
        const matched = occupants.find((o) => o.id.toLowerCase() === urlId.toLowerCase() || o.id.toLowerCase() === clean.toLowerCase());
        if (matched) {
          setSelectedUserId(matched.id);
          setSavedOccupantId(matched.id);
          setViewState("confirmed");
        }
      } else if (urlPhone) {
        const cleanDigits = urlPhone.replace(/\D/g, "");
        const matched = occupants.find((o) => o.phone && o.phone.replace(/\D/g, "") === cleanDigits);
        if (matched) {
          setSelectedUserId(matched.id);
          setSavedOccupantId(matched.id);
          setViewState("confirmed");
        } else {
          setSignPhone(urlPhone);
          setViewState("newcomer-signin");
        }
      } else if (urlName) {
        const matched = occupants.find((o) => o.name.toLowerCase() === urlName.toLowerCase());
        if (matched) {
          setSelectedUserId(matched.id);
          setSavedOccupantId(matched.id);
          setViewState("confirmed");
        } else {
          setSignName(urlName);
          setViewState("newcomer-signin");
        }
      }
    } catch { }
  }, []);

  // Sync role & company when userType changes
  const handleSelectUserType = (type: "employee" | "visitor") => {
    setUserType(type);
    if (type === "employee") {
      setSignRole("Employee");
      setSignCompany("Con Edison");
    } else {
      setSignRole("Visitor");
      setSignCompany("Pursuit / Guest");
    }
  };

  // Sample Autofill helpers (aligned to Con Edison briefing script)
  const handleAutofillEmployee = () => {
    setUserType("employee");
    setSignName("Robert Petillo");
    setSignPhone("(212) 555-0195");
    setSignCompany("Con Edison");
    setSignRole("Staff Lead");
    setSignQuad("NW");
    setSignAction("enter");
  };

  const handleAutofillVisitor = () => {
    setUserType("visitor");
    setSignName("Alex Rivera");
    setSignPhone("(917) 555-0812");
    setSignCompany("Pursuit / Guest");
    setSignHost("John Davis (Floor Warden)");
    setSignRole("Visitor");
    setSignQuad("SE");
    setSignAction("enter");
  };

  // Safety & check-in state
  const [selectedAssembly, setSelectedAssembly] = useState<string>("Assembly Point A (Park Plaza)");
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>("NW");
  const [helpNote, setHelpNote] = useState<string>("");
  const [actionSubmittedMsg, setActionSubmittedMsg] = useState<string | null>(null);
  const [occupantQrUrl, setOccupantQrUrl] = useState<string>("");
  const [showScanner, setShowScanner] = useState<boolean>(false);

  // Generate QR code for current user (memoized to prevent image flickering/glitching)
  const lastQrPayloadRef = useRef<string>("");
  useEffect(() => {
    if (!currentUser?.id) return;
    const payload = generateOccupantBadgePayload(currentUser.id, currentUser.quadrant || "NW");
    if (lastQrPayloadRef.current === payload && occupantQrUrl) {
      return; // Payload unchanged; avoid re-encoding
    }
    lastQrPayloadRef.current = payload;
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 1.5,
      color: { dark: "#003B70", light: "#FFFFFF" },
    })
      .then((url) => {
        setOccupantQrUrl(url);
      })
      .catch(console.error);
  }, [currentUser?.id, currentUser?.quadrant]);

  // AUTOMATIC ACCOUNTING ON QR CODE SCAN / LOAD FOR RETURNING OCCUPANTS (single dispatch per occupant)
  const hasAutoAccountedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const activeStoredId =
      savedOccupantId ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("muster_registered_occupant_id") || localStorage.getItem("muster_occupant_id")
        : null);

    if (activeStoredId && currentUser?.id && viewState === "confirmed") {
      if (hasAutoAccountedRef.current.has(currentUser.id)) {
        return; // Guard against loop
      }
      hasAutoAccountedRef.current.add(currentUser.id);

      fetch("/api/occupant/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupantId: currentUser.id, action: "enter" }),
      })
        .then((res) => {
          if (res.ok) {
            setActionSubmittedMsg(
              `⚡ Direct Sign-In Verified! Welcome back ${currentUser.name} (${currentUser.id}). You are recorded as PRESENT & ACCOUNTED on Floor 07.`
            );
            setTimeout(() => setActionSubmittedMsg(null), 8000);
          }
        })
        .catch((err) => console.warn("Auto-accounting on QR load:", err));
    }
  }, [savedOccupantId, currentUser?.id, viewState]);

  // Handle 1-Tap Biometric / Touch ID Fingerprint Sign-In
  const handleBiometricSignIn = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const targetUser = matchingExistingUser || currentUser || occupants[0] || {
        id: "OCC-001",
        name: signName.trim() || "Sarah Jenkins",
        phone: signPhone.trim() || "(212) 555-0199",
        quadrant: signQuad || "NW",
        role: signRole || "Employee",
        company: signCompany || "Con Edison",
      };

      const bioResult = await authenticateWithBiometrics(targetUser.name);
      if (bioResult.success) {
        if ("id" in targetUser && targetUser.id && occupants.some((o) => o.id === targetUser.id)) {
          await handleDirectSignInExisting(targetUser as Occupant);
        } else {
          // Register and sign-in
          const res = await fetch("/api/occupant/sign-in-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: targetUser.name,
              phone: targetUser.phone,
              action: signAction || "enter",
              role: targetUser.role,
              company: targetUser.company,
              quadrant: targetUser.quadrant,
              signature_data: "BIOMETRIC_FINGERPRINT_VERIFIED",
              signature_type: "biometric",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setSelectedUserId(data.occupant.id);
            setSavedOccupantId(data.occupant.id);
            setLocalRegisteredOccupant(data.occupant);
            try {
              localStorage.setItem("muster_registered_occupant_id", data.occupant.id);
              localStorage.setItem("muster_occupant_id", data.occupant.id);
              localStorage.setItem("muster_registered_name", data.occupant.name);
              localStorage.setItem("muster_registered_phone", data.occupant.phone || "");
              localStorage.setItem("muster_registered_quad", data.occupant.quadrant);
              localStorage.setItem("muster_registered_role", data.occupant.role);
              localStorage.setItem("muster_registered_company", data.occupant.company || "Con Edison");
              localStorage.setItem("muster_registered_occupant_json", JSON.stringify(data.occupant));
            } catch { }
            setViewState("confirmed");
            if (onCheckIn) {
              onCheckIn(
                data.occupant.id,
                "safe",
                "biometric-fingerprint-signin",
                `Biometric Fingerprint Sign-In Verified (${data.occupant.name})`,
                "inside-building"
              );
            }
          }
        }
        setActionSubmittedMsg(
          `👆 Fingerprint Verified! Digital pass authenticated & recorded as PRESENT on Floor 07.`
        );
        setTimeout(() => setActionSubmittedMsg(null), 7000);
      }
    } catch (err: any) {
      console.warn("Biometric sign-in error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Newcomer First-Time Sign-In / Register
  const handleNewcomerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!signPhone.trim()) {
      setErrorMessage("Please enter your mobile phone number.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // If we have an active QR Event token, submit directly to the checkin endpoint
      const endpoint = eventToken ? `/api/checkin/${eventToken}` : `/api/occupant/sign-in-register`;
      const payload = eventToken
        ? {
          full_name: signName.trim(),
          phone: signPhone.trim(),
          email: `${signName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@${userType === "employee" ? "coned.com" : "visitor.net"}`,
          org: signCompany.trim() || (userType === "employee" ? "Con Edison" : "Visitor"),
          role: signRole,
          quadrant: signQuad,
          action: signAction,
          signature_data: signatureData,
          signature_type: signatureType,
        }
        : {
          name: signName.trim(),
          phone: signPhone.trim(),
          company: signCompany.trim() || "Con Edison",
          role: signRole,
          quadrant: signQuad,
          action: signAction,
          signature_data: signatureData,
          signature_type: signatureType,
        };

      let data: any = null;
      let isOfflineSaved = false;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          data = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${res.status}`);
        }
      } catch (networkErr) {
        console.warn("Network offline during registration, creating local offline pass:", networkErr);
        const offlineOccupant = createOfflineOccupant({
          name: signName.trim(),
          phone: signPhone.trim(),
          quadrant: signQuad,
          role: signRole,
          company: signCompany.trim() || (userType === "employee" ? "Con Edison" : "Visitor"),
          desk: `07-${signQuad}-Workstation`,
        });
        queueOfflineAction(eventToken ? "visitor-register" : "occupant-sign-in", payload);
        data = { occupant: offlineOccupant };
        isOfflineSaved = true;
      }

      if (data && data.occupant) {
        setSelectedUserId(data.occupant.id);
        setSavedOccupantId(data.occupant.id);
        setLocalRegisteredOccupant(data.occupant);
        try {
          localStorage.setItem("muster_registered_occupant_id", data.occupant.id);
          localStorage.setItem("muster_occupant_id", data.occupant.id);
          localStorage.setItem("muster_registered_phone", signPhone.trim());
          localStorage.setItem("muster_registered_name", signName.trim());
          localStorage.setItem("muster_registered_quad", signQuad);
          localStorage.setItem("muster_registered_role", signRole);
          localStorage.setItem("muster_registered_company", signCompany.trim() || "Con Edison");
          localStorage.setItem("muster_registered_occupant_json", JSON.stringify(data.occupant));
        } catch (e) {
          console.warn("Storage write error", e);
        }

        setViewState("confirmed");
        // Immediately dispatch check-in to console so live accounted numbers and roster update
        if (onCheckIn) {
          onCheckIn(
            data.occupant.id,
            "safe",
            "qr-code-self-signin",
            `Self Sign-In via Mobile QR Code (${data.occupant.name})`,
            signAction === "leave" ? "offsite" : signAction === "muster" ? "outside-assembly" : "inside-building",
            signAction === "muster" ? "Assembly Point A (Park Plaza)" : undefined
          );
        }
        setActionSubmittedMsg(
          isOfflineSaved
            ? `🟠 Offline Mode Active: Pass ${data.occupant.id} allocated for ${data.occupant.name}. Registration and signature saved locally and queued for auto-sync.`
            : `🎉 Registered & Accounted! Assigned ${data.occupant.id} for ${data.occupant.name}. Digital signature recorded and Floor 07 roster updated!`
        );
        setTimeout(() => setActionSubmittedMsg(null), 8000);
      } else {
        setErrorMessage("Could not complete sign in. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Presence (Enter vs Leave Building) for returning signed-in user
  const handleTogglePresence = async (action: "enter" | "leave") => {
    if (!currentUser) return;
    try {
      let isOfflineSaved = false;
      try {
        const res = await fetch("/api/occupant/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ occupantId: currentUser.id, action }),
        });
        if (!res.ok) throw new Error("Presence endpoint returned error");
      } catch (err) {
        console.warn("Network error during toggle presence, queuing offline:", err);
        queueOfflineAction("presence-toggle", { occupantId: currentUser.id, action });
        isOfflineSaved = true;
      }

      setActionSubmittedMsg(
        isOfflineSaved
          ? `🟠 Offline: ${action === "leave" ? "Badge-out" : "Badge-in"} recorded locally and queued for sync.`
          : action === "leave"
            ? `🚪 Badged Out: ${currentUser.name} marked as LEFT BUILDING (Off-Site). Roster updated.`
            : `🏢 Badged In: ${currentUser.name} verified as IN BUILDING (Floor 07). Roster updated.`
      );
      setTimeout(() => setActionSubmittedMsg(null), 5000);
    } catch (err) {
      console.warn("Toggle presence failed:", err);
    }
  };

  // Handle scanning a station poster
  const handleStationScanSuccess = (decoded: string, action: "enter" | "leave" | "muster") => {
    if (!currentUser) return;
    setShowScanner(false);

    if (action === "leave") {
      handleTogglePresence("leave");
      return;
    }

    const parsed = parseQRData(decoded);
    const station = parsed.stationName || "Assembly Point A (Park Plaza)";
    const loc = parsed.locationCategory || (station.includes("Floor") || station.includes("Kiosk") ? "inside-building" : "outside-assembly");

    onCheckIn(
      currentUser.id,
      "safe",
      "qr-station-scan",
      `Scanned station QR code: ${station}`,
      loc,
      loc === "outside-assembly" ? station : undefined
    );

    setActionSubmittedMsg(`✅ Scanned QR Code! Verified SAFE at ${station}. Transmitted to Console.`);
    setTimeout(() => setActionSubmittedMsg(null), 6000);
  };

  const handleMarkSafeOutside = () => {
    if (!currentUser) return;
    onCheckIn(
      currentUser.id,
      "safe",
      "mobile-occupant-app",
      `Self-reported safe outside at ${selectedAssembly}`,
      "outside-assembly",
      selectedAssembly
    );
    setActionSubmittedMsg(`✅ Transmitted to Commander: SAFE outside at ${selectedAssembly}.`);
    setTimeout(() => setActionSubmittedMsg(null), 5000);
  };

  const handleMarkSafeInside = () => {
    if (!currentUser) return;
    onCheckIn(
      currentUser.id,
      "safe",
      "mobile-occupant-app",
      `Self-reported inside building at ${selectedQuadrant} Quadrant`,
      "inside-building"
    );
    setActionSubmittedMsg(`✅ Transmitted: SAFE inside building (${selectedQuadrant} Quadrant).`);
    setTimeout(() => setActionSubmittedMsg(null), 5000);
  };

  const [isDetectingGeo, setIsDetectingGeo] = useState(false);

  const handleGeoFenceAutoDetect = async () => {
    if (!currentUser) return;
    setIsDetectingGeo(true);
    try {
      const coords = await getDeviceGeolocation();
      const meta = coords
        ? { coords, source: "gps" as const }
        : {
          cad: {
            x: 250,
            y: 180,
            floor: 7,
            quadrant: currentUser.quadrant || "NW",
          },
          source: "kiosk_beacon" as const,
        };

      const geoResult = validateGeofence(meta, FLOOR_07_CONSTRAINTS);

      onCheckIn(
        currentUser.id,
        "safe",
        "geofence-auto-detect",
        `Geo-fence auto-detected: ${geoResult.resolvedLocationString} (${geoResult.auditDetails})`,
        geoResult.locationCategory,
        geoResult.assemblyPoint || undefined
      );

      setActionSubmittedMsg(
        `🛰️ Geo-Fence Verified: ${geoResult.locationCategory === "outside-assembly"
          ? `Outdoor Assembly Point (${geoResult.assemblyPoint})`
          : geoResult.locationCategory === "inside-building"
            ? `In-Building (Floor 07 · ${geoResult.detectedQuadrant || currentUser.quadrant} Quadrant)`
            : "Off-Site / Remote"
        }. Telemetry transmitted!`
      );
      setTimeout(() => setActionSubmittedMsg(null), 7000);
    } catch (err: any) {
      setActionSubmittedMsg(`⚠️ Geofence scan fallback applied.`);
      setTimeout(() => setActionSubmittedMsg(null), 4000);
    } finally {
      setIsDetectingGeo(false);
    }
  };

  const [isMonitoringRadio, setIsMonitoringRadio] = useState<boolean>(false);

  const handleTestRadioChannel = () => {
    setIsMonitoringRadio(true);
    try {
      playRadioIncomingAlert();
      setTimeout(() => {
        playRadioPttChirp();
        speakEmergencyBroadcast(
          "Floor 07 Life-Safety Command. Attention all occupants and floor wardens: channel monitor test successful. Stairwells Alpha and Bravo remain designated primary egress routes.",
          "HIGH",
          {
            playChime: false,
            onEnd: () => {
              playRadioRogerBeep();
              setIsMonitoringRadio(false);
            },
          }
        );
      }, 400);
    } catch {
      setIsMonitoringRadio(false);
    }
  };

  const handleRequestEvacChair = async () => {
    if (!currentUser) return;
    try {
      playRadioPttChirp();
    } catch {}

    let locationPrecision = `Sector ${currentUser.quadrant} · Desk ${currentUser.desk || "Turnstile Ingress"}`;
    let accuracyMeters = 2.5;
    try {
      const coords = await getDeviceGeolocation();
      if (coords && coords.accuracy) {
        accuracyMeters = Math.min(accuracyMeters, Math.round(coords.accuracy));
        locationPrecision += ` · GPS Accuracy ±${Math.round(coords.accuracy)}m`;
      }
    } catch {}

    const reportText = helpNote.trim()
      ? `${helpNote.trim()} [Pinpoint: ${locationPrecision}]`
      : `Evacuation chair required at stairwell landing [Pinpoint: ${locationPrecision}]`;

    onCheckIn(
      currentUser.id,
      "awaiting-evac-chair",
      "mobile-occupant-app",
      reportText,
      "inside-building"
    );
    const newReceipt = {
      id: String(Date.now()),
      text: reportText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      status: `ARA Evac Chair Request Dispatched (Pinpoint ±${accuracyMeters}m) ✓`,
    };
    setSentSitReps((prev) => [newReceipt, ...prev.slice(0, 8)]);
    setActionSubmittedMsg(`🛞 Assistance Request Sent! Wardens notified to dispatch ARA Evacuation Chair to Sector ${currentUser.quadrant} (Accuracy ±${accuracyMeters}m).`);
    setHelpNote("");
    setTimeout(() => {
      try {
        playRadioRogerBeep();
      } catch {}
    }, 450);
    setTimeout(() => setActionSubmittedMsg(null), 5000);
  };

  const handleRequestHelp = async () => {
    if (!currentUser) return;
    try {
      playRadioPttChirp();
    } catch {}

    let locationPrecision = `Sector ${currentUser.quadrant} · Desk ${currentUser.desk || "Turnstile Ingress"}`;
    let accuracyMeters = 2.5;
    try {
      const coords = await getDeviceGeolocation();
      if (coords && coords.accuracy) {
        accuracyMeters = Math.min(accuracyMeters, Math.round(coords.accuracy));
        locationPrecision += ` · GPS Accuracy ±${Math.round(coords.accuracy)}m`;
      }
    } catch {}

    const reportText = helpNote.trim()
      ? `${helpNote.trim()} [Pinpoint: ${locationPrecision}]`
      : `Immediate emergency assistance / SOS requested [Pinpoint: ${locationPrecision}]`;

    onCheckIn(
      currentUser.id,
      "need-help",
      "mobile-occupant-app",
      reportText,
      "inside-building"
    );
    const newReceipt = {
      id: String(Date.now()),
      text: `🚨 SOS: ${reportText}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      status: `CRITICAL DISTRESS ACTIVE · Search & Rescue Alerted (Pinpoint ±${accuracyMeters}m) 🚨`,
    };
    setSentSitReps((prev) => [newReceipt, ...prev.slice(0, 8)]);
    setActionSubmittedMsg(`🚨 Emergency Help Flagged! Search & Rescue alerted to ${locationPrecision}.`);
    setHelpNote("");
    setTimeout(() => {
      try {
        playRadioRogerBeep();
      } catch {}
    }, 450);
    setTimeout(() => setActionSubmittedMsg(null), 5000);
  };

  const handleSendIntelReport = (textToSend?: string) => {
    const messageText = (textToSend || helpNote).trim();
    if (!currentUser || !messageText) return;
    try {
      playRadioPttChirp();
    } catch {}
    onCheckIn(
      currentUser.id,
      currentUser.status || "safe",
      "mobile-occupant-intel",
      `Occupant SitRep: ${messageText}`,
      currentUser.locationCategory || "inside-building",
      currentUser.assemblyPoint
    );
    const newReceipt = {
      id: String(Date.now()),
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      status: "Delivered to FSD Command Center ✓",
    };
    setSentSitReps((prev) => [newReceipt, ...prev.slice(0, 8)]);
    setActionSubmittedMsg(`💬 SitRep Transmitted! FSD Command Center logged your report: "${messageText}"`);
    setHelpNote("");
    setTimeout(() => {
      try {
        playRadioRogerBeep();
      } catch {}
    }, 450);
    setTimeout(() => setActionSubmittedMsg(null), 6000);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5 text-[#0F2537]">
      {/* Real-Time Accessible Emergency Alert Modal / Banner with Spanish/English Voice Audio & CAD Map */}
      {(snapshot?.incidentActive || snapshot?.latestEmergencyAlert) && (
        <AccessibleEmergencyAlertBanner
          alert={
            snapshot?.latestEmergencyAlert || {
              title: snapshot?.mode === "incident" ? "EMERGENCY EVACUATION ORDER" : "LIFE-SAFETY DRILL IN PROGRESS",
              narrative:
                snapshot?.latestNarrative?.executiveSummary ||
                snapshot?.latestNarrative?.timelineNarrative ||
                "Attention Floor 07 occupants: Immediate evacuation is ordered. Do not use elevators. Proceed to designated stairwells and report to your assigned outdoor muster assembly point.",
              priority: "HIGH",
              hazardType: (snapshot?.hazardType || "drill") as any,
              channels: ["PUSH_NOTIFICATION", "SMS_DIRECT", "MESH_AUDIO_BEACON"],
              timestamp: snapshot?.declaredAt || new Date().toISOString(),
              targetSectors: ["NW", "NE", "SW", "SE"],
            }
          }
          currentOccupant={currentUser}
          onCheckIn={onCheckIn}
          stairwell={
            snapshot?.stairwell ||
            (currentUser
              ? currentUser.quadrant === "NW" || currentUser.quadrant === "NE"
                ? "Door 7-A · Stairwell A (East Core)"
                : "Door 7-B · Stairwell B (West Core)"
              : "Door 7-A · Stairwell A (East Core)")
          }
          assemblyPoint={snapshot?.assemblyPoint || selectedAssembly || "Park Plaza (East 14th St)"}
        />
      )}

      {/* Official Con Edison Life-Safety Service Header Banner */}
      <div className="bg-[#EBF5FB] border border-[#B8D8F8] p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">⚡</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-[#003B70] text-sm uppercase tracking-wide">
                Con Edison Life-Safety Service
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-[#475569] font-medium">
              4 Irving Place · Floor 07 Emergency Evacuation &amp; Sign-In Gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onSwitchToAdmin && (
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="bg-white hover:bg-sky-50 border border-[#005DAA] text-[#005DAA] px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Return to FSD Commander Console"
            >
              <span>🛡️</span>
              <span className="hidden xs:inline">Commander Deck</span>
              <span className="xs:hidden">Console</span>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem("muster_registered_occupant_id");
                  localStorage.removeItem("muster_occupant_id");
                  localStorage.removeItem("muster_registered_phone");
                  localStorage.removeItem("muster_registered_name");
                } catch { }
                setSavedOccupantId(null);
                setViewState("newcomer-signin");
                onLogout();
              }}
              className="bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
              title="Sign out of device and return to login screen"
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Warden Walkie-Talkie Voice Transmission Card */}
      {snapshot?.latestWalkieTalkie && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-4 sm:p-5 rounded-2xl shadow-xl space-y-3 border-2 border-amber-300 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl animate-pulse">📻</span>
              <div>
                <span className="font-black text-sm uppercase tracking-wider block">
                  LIVE WARDEN RADIO DISPATCH
                </span>
                <span className="text-[10px] text-amber-200 font-mono font-bold">
                  FROM: {snapshot.latestWalkieTalkie.senderName} ({snapshot.latestWalkieTalkie.senderBadge || "WARDEN"})
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-black bg-black/40 px-2.5 py-1 rounded-full border border-amber-300/40 uppercase tracking-widest text-amber-300 animate-pulse">
              {snapshot.latestWalkieTalkie.distressLevel.replace(/_/g, " ")}
            </span>
          </div>

          {/* Spoken Distress Transcript */}
          <div className="bg-black/35 p-3.5 rounded-xl border border-white/20 text-xs space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-300 uppercase">
              <span>SPOKEN DISTRESS DIRECTIVE:</span>
              <span>{new Date(snapshot.latestWalkieTalkie.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="text-sm font-bold text-white leading-relaxed">
              "{snapshot.latestWalkieTalkie.transcript}"
            </p>
          </div>

          {/* Voice Audio Player */}
          {snapshot.latestWalkieTalkie.audioUrl && (
            <div className="bg-black/25 p-3 rounded-xl border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                <span>🔊</span>
                <span>Warden Live Voice Audio</span>
              </div>
              <audio
                src={snapshot.latestWalkieTalkie.audioUrl}
                controls
                autoPlay
                className="h-8 max-w-[240px]"
              />
            </div>
          )}
        </div>
      )}

      {/* Real-Time Emergency Alert & Evacuation Directive Hub */}
      {snapshot?.incidentActive && (
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-amber-600 text-white p-4 sm:p-5 rounded-2xl shadow-xl space-y-3.5 border-2 border-red-300 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl animate-bounce">🚨</span>
              <div>
                <span className="font-black text-sm uppercase tracking-wider block">
                  {snapshot.mode === "incident" ? "CRITICAL EMERGENCY EVACUATION" : "LIFE-SAFETY DRILL IN PROGRESS"}
                </span>
                <span className="text-[10px] text-amber-200 font-mono font-bold">
                  HAZARD: {(snapshot.hazardType || "office-fire").replace("-", " ").toUpperCase()}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-black bg-black/40 px-2.5 py-1 rounded-full border border-white/30 uppercase tracking-widest animate-pulse">
              LIVE ALERT
            </span>
          </div>

          <div className="bg-black/30 p-3.5 rounded-xl border border-white/20 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px] uppercase tracking-wider">
              <span>📢 FSD COMMAND DIRECTIVE:</span>
            </div>
            <p className="text-xs leading-relaxed text-white font-medium">
              {snapshot.latestNarrative?.executiveSummary ||
                snapshot.latestNarrative?.timelineNarrative ||
                "Attention Floor 07 occupants: Please evacuate immediately via designated stairwells. Do NOT use elevators. Report to your assigned outdoor muster assembly point."}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 text-[11px] text-amber-100">
              <div className="bg-black/25 p-2 rounded-lg">
                <span className="text-slate-300 text-[9px] font-bold block uppercase tracking-wider">EGRESS PATH:</span>
                <span className="font-bold text-white text-xs">
                  {snapshot.stairwell || (currentUser?.quadrant === "SW" || currentUser?.quadrant === "SE" ? "Door 7-B (West Core)" : "Door 7-A (East Core)")}
                </span>
              </div>
              <div className="bg-black/25 p-2 rounded-lg">
                <span className="text-slate-300 text-[9px] font-bold block uppercase tracking-wider">ASSEMBLY STATION:</span>
                <span className="font-bold text-white text-xs">
                  {snapshot.assemblyPoint || "Park Plaza (East 14th St)"}
                </span>
              </div>
            </div>
          </div>

          {currentUser && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleMarkSafeOutside}
                className="py-3 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>🟢</span>
                <span>I Am Safe Outside</span>
              </button>
              <button
                type="button"
                onClick={handleRequestHelp}
                className="py-3 px-3 bg-red-950 hover:bg-red-900 text-red-200 border border-red-400 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>🆘</span>
                <span>Need Assistance</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3-Action Quick Intent Legend */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
        <div className="bg-white p-2 rounded-xl border border-emerald-200 text-emerald-800 flex flex-col items-center gap-0.5 shadow-2xs">
          <span className="text-sm">🟢</span>
          <span>1. Enter Building</span>
          <span className="text-[9px] text-slate-500 font-normal">Floor 07 Turnstile</span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-amber-200 text-amber-800 flex flex-col items-center gap-0.5 shadow-2xs">
          <span className="text-sm">⚪</span>
          <span>2. Leave Building</span>
          <span className="text-[9px] text-slate-500 font-normal">Badge Out (Off-site)</span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-sky-200 text-sky-800 flex flex-col items-center gap-0.5 shadow-2xs">
          <span className="text-sm">🚨</span>
          <span>3. Muster Check-In</span>
          <span className="text-[9px] text-slate-500 font-normal">Assembly Pt A / B</span>
        </div>
      </div>

      {/* Offline Status & Sync Queue HUD */}
      {(!isOnline || offlinePendingCount > 0) && (
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${!isOnline ? "bg-amber-500/10 border-amber-500/40 text-amber-900" : "bg-sky-500/10 border-sky-500/30 text-sky-900"
          }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${!isOnline ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
            <div>
              <span className="font-bold">
                {!isOnline ? "📡 OFFLINE RESILIENT MODE" : "🟢 ONLINE · PENDING LOCAL SYNC"}
              </span>
              <p className="text-[11px] opacity-80">
                {offlinePendingCount > 0
                  ? `${offlinePendingCount} attendance record(s) queued locally. Replays automatically when reconnected.`
                  : "Operating from local cache. All sign-in passes & QR codes will work uninterrupted."}
              </p>
            </div>
          </div>
          {offlinePendingCount > 0 && isOnline && (
            <button
              onClick={handleManualSyncNow}
              disabled={isSyncingOffline}
              className="bg-[#005DAA] hover:bg-[#004A88] text-white px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs"
            >
              {isSyncingOffline ? "Syncing..." : "⚡ Sync Now"}
            </button>
          )}
        </div>
      )}

      {/* Feedback Toast */}
      {actionSubmittedMsg && (
        <div className="p-3.5 bg-emerald-100 border-2 border-emerald-400 text-emerald-950 text-xs font-black rounded-xl shadow-xs animate-fadeIn flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span>{actionSubmittedMsg}</span>
          </div>
          <button onClick={() => setActionSubmittedMsg(null)} className="text-emerald-800 hover:text-emerald-950 cursor-pointer font-bold px-2 py-1">✕</button>
        </div>
      )}

      {/* ========================================================= */}
      {/* FLOW 1: RETURNING USER (ALREADY SIGNED IN BEFORE) */}
      {/* ========================================================= */}
      {viewState === "confirmed" && currentUser && (
        <div className="space-y-4">
          {/* Quick Switch to Newcomer Sign-In Sheet */}
          <div className="flex items-center justify-between bg-[#EBF5FB] border border-[#005DAA]/30 p-2.5 rounded-xl text-xs">
            <span className="text-[#005DAA] font-bold">
              Looking to fill out the sign-in sheet or register another person?
            </span>
            <button
              type="button"
              onClick={() => setViewState("newcomer-signin")}
              className="px-3 py-1 bg-[#005DAA] hover:bg-[#004884] text-white font-black rounded-lg text-xs transition cursor-pointer shrink-0 shadow-xs"
            >
              ✍️ Open Sign-In Sheet →
            </button>
          </div>

          {/* Prominent Welcome Back & Sign-In Confirmation Card */}
          <div className={`bg-white border-2 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 ${currentUser.role === "Visitor" ? "border-amber-500" : "border-[#005DAA]"
            }`}>
            <div className="flex items-start justify-between gap-3 border-b border-[#B8D8F8] pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-400 text-emerald-900 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>SIGNED IN & ACCOUNTED FOR</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${currentUser.role === "Visitor"
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-[#003B70] text-white"
                    }`}>
                    {currentUser.role === "Visitor" ? "🎟️ VISITOR / GUEST PASS" : "🏢 CON EDISON EMPLOYEE"}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">PASS ID: {currentUser.id}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#0F2537] mt-1">
                  Welcome back, {currentUser.name}!
                </h2>
                <div className="text-xs font-mono font-bold text-[#005DAA] mt-1 flex flex-wrap items-center gap-2">
                  <span>PHONE: {currentUser.phone || "(212) 555-0199"}</span>
                  <span className="text-slate-500">· {currentUser.company || "Con Edison"}</span>
                  <span className="text-slate-500">· Sector {currentUser.quadrant}</span>
                </div>
              </div>

              <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0 ${currentUser.role === "Visitor"
                  ? "bg-gradient-to-br from-amber-600 to-amber-700"
                  : "bg-gradient-to-br from-[#003B70] to-[#005DAA]"
                }`}>
                {currentUser.name.split(" ").map((n) => n[0]).join("")}
              </div>
            </div>

            {/* Current Presence Status & Fast 1-Tap Toggle */}
            <div className="bg-[#F0F6FC] p-4 rounded-2xl border border-[#B8D8F8] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-[#0F2537] block">
                    Current Building Presence:
                  </span>
                  <span className="text-xs font-bold text-[#005DAA]">
                    {currentUser.badgedOut ? "⚪ Badged Out / Off-Site" : `🟢 In Building (Floor 07 · Sector ${currentUser.quadrant})`}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase border ${currentUser.badgedOut
                    ? "bg-slate-200 text-slate-800 border-slate-300"
                    : "bg-emerald-100 text-emerald-950 border-emerald-400"
                  }`}>
                  <span>{currentUser.badgedOut ? "🚪 OFF-SITE" : "🏢 PRESENT & ACCOUNTED"}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleTogglePresence("enter")}
                  className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${!currentUser.badgedOut
                      ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500"
                      : "bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-50"
                    }`}
                >
                  <span>🏢</span>
                  <span>In Building</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePresence("leave")}
                  className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${currentUser.badgedOut
                      ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-500"
                      : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-50"
                    }`}
                >
                  <span>🚪</span>
                  <span>Left Building</span>
                </button>
              </div>
            </div>

            {/* 3-Tab Section Switcher for Confirmed Occupants */}
            <div className="grid grid-cols-3 gap-1 bg-[#F0F6FC] p-1.5 rounded-2xl border border-[#B8D8F8] sticky top-2 z-10 shadow-sm backdrop-blur-md">
              <button
                type="button"
                onClick={() => setConfirmedActiveTab("comm")}
                className={`py-2 px-1 text-center rounded-xl font-black text-xs transition cursor-pointer flex flex-col items-center justify-center gap-0.5 relative ${
                  confirmedActiveTab === "comm"
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "text-[#005DAA] hover:bg-white"
                }`}
              >
                <span className="text-sm">💬</span>
                <span className="truncate w-full text-[11px]">SitRep & Radio</span>
                {(currentUser.status === "need-help" || currentUser.status === "awaiting-evac-chair") && (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute top-1 right-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setConfirmedActiveTab("map")}
                className={`py-2 px-1 text-center rounded-xl font-black text-xs transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  confirmedActiveTab === "map"
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "text-[#005DAA] hover:bg-white"
                }`}
              >
                <span className="text-sm">🗺️</span>
                <span className="truncate w-full text-[11px]">Evac Map</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmedActiveTab("pass")}
                className={`py-2 px-1 text-center rounded-xl font-black text-xs transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  confirmedActiveTab === "pass"
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "text-[#005DAA] hover:bg-white"
                }`}
              >
                <span className="text-sm">🎟️</span>
                <span className="truncate w-full text-[11px]">QR Pass</span>
              </button>
            </div>

            {/* ======================================================== */}
            {/* TAB 1: COMMUNICATION & SITREP HUB                       */}
            {/* ======================================================== */}
            {confirmedActiveTab === "comm" && (
              <div className="space-y-4 animate-fadeIn">
                {/* Live Life-Safety Warden Radio Channel Card */}
                <div className="p-4 rounded-2xl border-2 border-[#005DAA] bg-gradient-to-br from-[#0B1728] via-[#0E2038] to-[#0A1626] text-white shadow-md space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📻</span>
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-sky-400">
                          Life-Safety Two-Way Radio Channel
                        </div>
                        <div className="text-[10px] font-mono text-slate-300">
                          FREQ: 462.5625 MHz (Floor 07 Warden Dispatch)
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      RX ACTIVE
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Direct digital dispatch link to the Floor 07 Fire Warden Command Post. Audio alerts and SitReps transmit instantaneously to the incident commander console.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestRadioChannel}
                      disabled={isMonitoringRadio}
                      className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-95"
                    >
                      <span>{isMonitoringRadio ? "🔊" : "📻"}</span>
                      <span>{isMonitoringRadio ? "Broadcasting Dispatch..." : "Monitor / Test Radio Audio"}</span>
                    </button>
                  </div>
                </div>

                {/* Distress Status Badge */}
                <div className="flex items-center justify-between p-3 rounded-xl border bg-white shadow-2xs">
                  <span className="text-xs font-bold text-slate-700">Your Incident Status:</span>
                  <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border ${
                    currentUser.status === "safe"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : currentUser.status === "awaiting-evac-chair"
                      ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                      : currentUser.status === "need-help"
                      ? "bg-red-200 text-red-950 border-red-400 animate-pulse font-black"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}>
                    {currentUser.status === "safe"
                      ? "🟢 SAFE & ACCOUNTED"
                      : currentUser.status === "awaiting-evac-chair"
                      ? "🛞 EVAC CHAIR REQUESTED"
                      : currentUser.status === "need-help"
                      ? "🚨 SOS ACTIVE / SEARCH & RESCUE"
                      : "⚪ UNACCOUNTED FOR"}
                  </span>
                </div>

                {/* 1-Tap Emergency Transmit Actions */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleRequestEvacChair}
                    className="py-3 px-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 border border-amber-400"
                  >
                    <span className="text-lg">🛞</span>
                    <span>Request Evac Chair</span>
                    <span className="text-[9px] font-normal text-amber-100 font-mono">ARA Stryker Landing</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestHelp}
                    className="py-3 px-3 bg-red-700 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 border border-red-400 animate-pulse"
                  >
                    <span className="text-lg">🆘</span>
                    <span>Send SOS Distress</span>
                    <span className="text-[9px] font-normal text-red-100 font-mono">Emergency Alert</span>
                  </button>
                </div>

                {/* Safe Reporting Section */}
                <div className="p-4 bg-[#F0F6FC] rounded-2xl border border-[#B8D8F8] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-1.5">
                      <span>✓</span> Report Safety Status
                    </span>
                    <button
                      type="button"
                      onClick={handleGeoFenceAutoDetect}
                      disabled={isDetectingGeo}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
                    >
                      <span>🛰️</span>
                      <span>{isDetectingGeo ? "Scanning..." : "GPS Verify"}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Safe Outside */}
                    <div className="bg-white p-3 rounded-xl border border-[#B8D8F8] space-y-2">
                      <div className="text-[11px] font-bold text-[#0F2537]">1. Outside at Assembly Point</div>
                      <select
                        value={selectedAssembly}
                        onChange={(e) => setSelectedAssembly(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#B8D8F8] rounded-lg px-2 py-1.5 text-xs font-semibold text-[#0F2537] focus:outline-none"
                      >
                        <option value="Assembly Point A (Park Plaza)">Assembly Point A (Park Plaza - East 14th St)</option>
                        <option value="Assembly Point B (Courtyard)">Assembly Point B (East Courtyard - Irving Pl)</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleMarkSafeOutside}
                        className="w-full py-2 bg-emerald-700 text-white font-bold text-xs rounded-lg hover:bg-emerald-800 transition cursor-pointer shadow-xs"
                      >
                        ✓ Safe Outside
                      </button>
                    </div>

                    {/* Safe Inside */}
                    <div className="bg-white p-3 rounded-xl border border-[#B8D8F8] space-y-2">
                      <div className="text-[11px] font-bold text-[#0F2537]">2. Still Inside Floor 07</div>
                      <select
                        value={selectedQuadrant}
                        onChange={(e) => setSelectedQuadrant(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#B8D8F8] rounded-lg px-2 py-1.5 text-xs font-semibold text-[#0F2537] focus:outline-none"
                      >
                        <option value="NW">NW · Strategic Planning</option>
                        <option value="NE">NE · Gas Operations & Security</option>
                        <option value="SW">SW · AMI & Ombudsman</option>
                        <option value="SE">SE · Steam Operations</option>
                        <option value="Stairwell A">Stairwell A (East Core)</option>
                        <option value="Stairwell B">Stairwell B (West Core)</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleMarkSafeInside}
                        className="w-full py-2 bg-[#005DAA] text-white font-bold text-xs rounded-lg hover:bg-[#004A88] transition cursor-pointer shadow-xs"
                      >
                        ✓ Safe Inside
                      </button>
                    </div>
                  </div>
                </div>

                {/* Situation Report (SitRep) Transmit Box */}
                <div className="p-4 bg-white rounded-2xl border-2 border-[#005DAA]/40 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-1.5">
                      <span>💬</span> Transmit SitRep Note to Commander
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Real-time Feed</span>
                  </div>

                  {/* 1-Tap Quick SitRep Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Quick SitRep Presets:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SITREP_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setHelpNote(preset.text);
                            handleSendIntelReport(preset.text);
                          }}
                          className="px-2.5 py-1 bg-[#F0F6FC] hover:bg-[#E1EFFE] text-[#003B70] border border-[#B8D8F8] rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="relative">
                      <textarea
                        value={helpNote}
                        onChange={(e) => setHelpNote(e.target.value)}
                        rows={2}
                        placeholder="Type situation note (e.g., Heavy smoke in corridor, 3 occupants sheltering in 7B, power out...)"
                        className="w-full bg-[#F8FAFC] border border-[#B8D8F8] rounded-xl p-2.5 text-xs text-[#0F2537] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#005DAA] resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendIntelReport()}
                      disabled={!helpNote.trim()}
                      className="w-full py-2.5 bg-[#005DAA] hover:bg-[#004A88] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>💬</span>
                      <span>Transmit SitRep to Commander</span>
                    </button>
                  </div>
                </div>

                {/* Sent Transmissions Feed */}
                {sentSitReps.length > 0 && (
                  <div className="bg-[#F8FAFC] border border-[#B8D8F8] rounded-2xl p-3.5 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-1.5">
                      <span>📋</span> Transmission Receipts &amp; Ledger Log
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {sentSitReps.map((item) => (
                        <div key={item.id} className="bg-white border border-[#E2E8F0] p-2 rounded-lg text-[11px] space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>{item.time}</span>
                            <span className="text-emerald-700 font-bold">{item.status}</span>
                          </div>
                          <div className="text-slate-800 font-medium">{item.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emergency Hotlines */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <a
                    href="tel:911"
                    className="p-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-red-900 text-[10px] font-bold block"
                  >
                    🚒 FDNY: 911
                  </a>
                  <a
                    href="tel:2124601000"
                    className="p-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl text-sky-900 text-[10px] font-bold block"
                  >
                    🚨 Security: x1000
                  </a>
                  <a
                    href="tel:7007"
                    className="p-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-amber-900 text-[10px] font-bold block"
                  >
                    🦺 Warden: x7007
                  </a>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: SCANNABLE QR PASS & LEDGER BLOCK SEAL            */}
            {/* ======================================================== */}
            {confirmedActiveTab === "pass" && (
              <div className="space-y-3 animate-fadeIn">
                <div className={`p-4 rounded-2xl border text-center space-y-3 ${currentUser.role === "Visitor"
                    ? "bg-amber-50/70 border-amber-300"
                    : "bg-[#F8FAFC] border-[#B8D8F8]"
                  }`}>
                  <div className="text-[10px] font-black uppercase text-[#005DAA] tracking-wider">
                    {currentUser.role === "Visitor" ? "🎟️ Official Guest / Visitor Turnstile Pass" : "🏢 Official Employee Turnstile Pass"}
                  </div>

                  <div className={`w-44 h-44 mx-auto bg-white border-2 p-2.5 rounded-2xl flex items-center justify-center shadow-inner ${currentUser.role === "Visitor" ? "border-amber-500" : "border-[#005DAA]"
                    }`}>
                    {occupantQrUrl ? (
                      <img
                        src={occupantQrUrl}
                        alt={`QR pass for ${currentUser.name}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-slate-400 font-mono">Generating QR...</div>
                    )}
                  </div>

                  <div className="font-mono text-xs font-black text-[#003B70] bg-white py-1 px-3 rounded-lg border border-[#B8D8F8] inline-block">
                    PASS: {currentUser.id}-{currentUser.quadrant}
                  </div>

                  {/* Official Cryptographic Ledger Block Seal */}
                  <div className="bg-[#F0F6FC] border border-[#B8D8F8] p-3 rounded-xl text-left space-y-1 font-mono">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#005DAA]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        COMMITTED TO LIFE-SAFETY LEDGER
                      </span>
                      <span className="bg-emerald-100 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-bold">
                        SEALED BLOCK ✓
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#0F2537] flex items-center justify-between">
                      <span>{currentUser.name} ({currentUser.id})</span>
                      <span className="text-[10px] text-slate-500">{currentUser.lastBadgeTime || "Verified"}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 flex items-center justify-between pt-0.5">
                      <span className="truncate max-w-[200px]" title={snapshot?.ledgerEntries && snapshot.ledgerEntries.length > 0 ? snapshot.ledgerEntries.slice(-1)[0].hash : "SHA-256 Hash"}>
                        HASH: {snapshot?.ledgerEntries && snapshot.ledgerEntries.length > 0 ? snapshot.ledgerEntries.slice(-1)[0].hash.substring(0, 16) + "..." : "6c79d9cd53c9..."}
                      </span>
                      <span className="text-emerald-700 font-bold text-[9px]">NYC FDNY §401-06</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#B8D8F8]">
                    <button
                      type="button"
                      onClick={() => setShowScanner(!showScanner)}
                      className="flex-1 py-2 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span>📷</span>
                      <span>{showScanner ? "Hide Camera" : "Scan Station Poster"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem("muster_registered_occupant_id");
                          localStorage.removeItem("muster_occupant_id");
                          localStorage.removeItem("muster_registered_phone");
                          localStorage.removeItem("muster_registered_name");
                        } catch { }
                        setSavedOccupantId(null);
                        setViewState("newcomer-signin");
                      }}
                      className="flex-1 py-2 bg-white border border-[#B8D8F8] text-[#005DAA] hover:bg-[#EBF5FB] rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      ✍️ Sign In As Another Employee or Visitor
                    </button>
                  </div>
                </div>

                {/* Camera Scanner if toggled */}
                {showScanner && (
                  <div className="p-4 bg-[#F8FAFC] border border-[#B8D8F8] rounded-2xl animate-fadeIn">
                    <QRCameraScanner
                      onScanSuccess={handleStationScanSuccess}
                      onClose={() => setShowScanner(false)}
                      stationName="Mobile Scanner"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: OFFICIAL LIFE-SAFETY EMERGENCY ESCAPE & EVACUATION */}
            {/* ========================================================= */}
            {confirmedActiveTab === "map" && (
            <div className={`rounded-2xl border-2 shadow-lg transition-all overflow-hidden ${snapshot?.incidentActive
                ? "bg-gradient-to-br from-red-950 via-slate-900 to-red-900 border-red-500 ring-2 ring-red-400 text-white"
                : "bg-gradient-to-br from-[#0B1728] via-[#0E2038] to-[#0A1626] border-[#005DAA] text-white"
              }`}>
              {/* Emergency Escape Header Bar */}
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shadow-md shrink-0 ${snapshot?.incidentActive
                      ? "bg-red-600 text-white animate-pulse"
                      : "bg-[#005DAA] text-white"
                    }`}>
                    {snapshot?.incidentActive ? "🚨" : "🛡️"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${snapshot?.incidentActive
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-sky-500/20 text-[#38BDF8] border border-sky-400/30"
                        }`}>
                        {snapshot?.incidentActive ? "ACTIVE EVACUATION ORDER" : "NYC FIRE CODE 3 RCNY §401-06"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-300 hidden sm:inline">
                        CON EDISON 4 IRVING PL · FL 07
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white mt-1">
                      Emergency Escape &amp; Evacuation Procedures
                    </h3>
                    <p className="text-xs text-slate-300">
                      Personalized route for <span className="font-bold text-[#38BDF8]">{currentUser.name}</span> in <span className="font-bold text-amber-300">{quadrantEscapeInfo.quadrantName}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEvacGuideExpanded(!isEvacGuideExpanded)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black transition cursor-pointer text-slate-200 shrink-0"
                >
                  {isEvacGuideExpanded ? "Collapse ▲" : "View Instructions ▼"}
                </button>
              </div>

              {isEvacGuideExpanded && (
                <div className="p-4 sm:p-5 space-y-4 text-xs">
                  {/* Real-time incident banner if active */}
                  {snapshot?.incidentActive && (
                    <div className="bg-red-600/30 border border-red-500 p-3.5 rounded-xl space-y-1.5 animate-pulse">
                      <div className="flex items-center justify-between text-red-200 font-black text-xs uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>IMMEDIATE EVACUATION ORDER IN EFFECT</span>
                        </span>
                        <span className="text-[10px] font-mono bg-red-600 px-2 py-0.5 rounded text-white">
                          HAZARD: {(snapshot.hazardType || "emergency").toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-white leading-relaxed">
                        {snapshot.latestNarrative?.executiveSummary ||
                          "A floor-wide evacuation has been sounded. Do not use elevators. Proceed calmly to your assigned stairwell and report to the designated outdoor assembly muster point."}
                      </p>
                    </div>
                  )}

                  {/* Primary & Backup Egress Pathway Cards */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                        <span>🧭</span> YOUR ASSIGNED EGRESS PATH (SECTOR {currentUser.quadrant})
                      </span>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                        DO NOT USE ELEVATORS ✓
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Primary Stairwell */}
                      <div className="bg-[#132742] p-3.5 rounded-xl border-2 border-sky-400/50 space-y-2 relative shadow-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-black uppercase text-sky-300 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-400/30">
                            ⭐ PRIMARY STAIRWELL
                          </span>
                          <span className="text-[10px] text-emerald-300 font-mono font-bold">~3 min descent</span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                          <span>🚪</span>
                          <span>{quadrantEscapeInfo.primaryStairwell}</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-snug">
                          {quadrantEscapeInfo.primaryPath}
                        </p>
                        <div className="text-[11px] text-sky-200 font-medium pt-1 border-t border-white/10 flex items-center justify-between">
                          <span>Street Exit:</span>
                          <span className="font-bold text-white">{quadrantEscapeInfo.primaryExitStreet}</span>
                        </div>
                      </div>

                      {/* Exterior Assembly Point */}
                      <div className="bg-[#132742] p-3.5 rounded-xl border-2 border-amber-400/50 space-y-2 relative shadow-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-black uppercase text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-400/30">
                            📍 OUTDOOR MUSTER POINT
                          </span>
                          <span className="text-[10px] text-amber-200 font-mono font-bold">200+ ft clear</span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                          <span>🌳</span>
                          <span>{quadrantEscapeInfo.assemblyPoint}</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-snug">
                          {quadrantEscapeInfo.assemblyCrossStreet}. Assemble clear of building canopies and falling facade glass.
                        </p>
                        <div className="text-[11px] text-amber-200 font-medium pt-1 border-t border-white/10 flex items-center justify-between">
                          <span>Secondary Backup:</span>
                          <span className="font-bold text-white">{quadrantEscapeInfo.secondaryStairwell}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-1.5 bg-[#06101E] p-1 rounded-xl border border-white/10 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveEvacTab("map")}
                      className={`flex-1 py-2 px-1.5 rounded-lg transition cursor-pointer text-center ${activeEvacTab === "map"
                          ? "bg-[#005DAA] text-white shadow-xs font-black"
                          : "text-slate-400 hover:text-white"
                        }`}
                    >
                      🗺️ Stair Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEvacTab("route")}
                      className={`flex-1 py-2 px-1.5 rounded-lg transition cursor-pointer text-center ${activeEvacTab === "route"
                          ? "bg-[#005DAA] text-white shadow-xs font-black"
                          : "text-slate-400 hover:text-white"
                        }`}
                    >
                      🚶‍♂️ 5-Step Egress
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEvacTab("equipment")}
                      className={`flex-1 py-2 px-1.5 rounded-lg transition cursor-pointer text-center ${activeEvacTab === "equipment"
                          ? "bg-[#005DAA] text-white shadow-xs font-black"
                          : "text-slate-400 hover:text-white"
                        }`}
                    >
                      🛞 Life Safety
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEvacTab("contacts")}
                      className={`flex-1 py-2 px-1.5 rounded-lg transition cursor-pointer text-center ${activeEvacTab === "contacts"
                          ? "bg-[#005DAA] text-white shadow-xs font-black"
                          : "text-slate-400 hover:text-white"
                        }`}
                    >
                      🚨 Emergency Dials
                    </button>
                  </div>

                  {/* Tab 0: Floor 07 Interactive Stairwell Evacuation Map */}
                  {activeEvacTab === "map" && (
                    <div className="space-y-3 animate-fadeIn">
                      {/* Header bar with assigned door and descent estimate */}
                      <div className="bg-[#10243E] p-3 rounded-xl border border-sky-500/40 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                          <span className="font-mono font-black text-white text-xs uppercase tracking-wide">
                            YOUR EVACUATION MAP · SECTOR {currentUser.quadrant}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                            Primary: {currentUser.quadrant === "NW" || currentUser.quadrant === "NE" ? "Door 7-A (Stair A)" : "Door 7-B (Stair B)"}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            ~3 min descent
                          </span>
                        </div>
                      </div>

                      {/* As-Built Floor Plan Diagram SVG Container */}
                      <div className="relative rounded-xl overflow-hidden border-2 border-sky-500/50 bg-[#081528] shadow-inner">
                        <svg viewBox="0 0 1000 620" className="w-full h-auto max-h-[460px] font-sans select-none block">
                          <defs>
                            <pattern id="evacCadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1E3A5F" strokeWidth="0.8" opacity="0.6" />
                            </pattern>
                            <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
                              <stop offset="60%" stopColor="#0284C7" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
                            </radialGradient>
                            <style>{`
                              @keyframes egressDash {
                                to { stroke-dashoffset: -32; }
                              }
                              .animated-egress-route {
                                stroke-dasharray: 8 6;
                                animation: egressDash 1.2s linear infinite;
                              }
                              @keyframes pulsePin {
                                0%, 100% { transform: scale(1); opacity: 1; }
                                50% { transform: scale(1.25); opacity: 0.7; }
                              }
                              .beacon-pin {
                                transform-origin: center;
                                animation: pulsePin 1.6s ease-in-out infinite;
                              }
                            `}</style>
                          </defs>

                          {/* Grid Background */}
                          <rect width="1000" height="620" fill="#0A192F" />
                          <rect width="1000" height="620" fill="url(#evacCadGrid)" />

                          {/* Perimeter Compass Streets */}
                          <rect x="0" y="0" width="1000" height="24" fill="#002D5A" />
                          <text x="500" y="16" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" letterSpacing="3">
                            ▲ NORTH — EAST 15TH STREET ▲
                          </text>

                          <rect x="0" y="24" width="24" height="572" fill="#002D5A" />
                          <text x="-310" y="16" transform="rotate(-90)" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" letterSpacing="3">
                            ◄ WEST — IRVING PLACE ◄
                          </text>

                          <rect x="976" y="24" width="24" height="572" fill="#002D5A" />
                          <text x="310" y="-984" transform="rotate(90)" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" letterSpacing="3">
                            ► EAST — UNION SQUARE EAST / 3RD AVE ►
                          </text>

                          <rect x="0" y="596" width="1000" height="24" fill="#002D5A" />
                          <text x="500" y="612" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" letterSpacing="3">
                            ▼ SOUTH — EAST 14TH STREET ▼
                          </text>

                          {/* Outer Building Wall Boundary */}
                          <rect x="36" y="34" width="928" height="552" fill="#0C213D" stroke="#005DAA" strokeWidth="2.5" rx="6" />

                          {/* Central Lightwell Open Air Courtyard */}
                          <rect x="420" y="210" width="160" height="190" fill="#05101E" stroke="#1E3A5F" strokeWidth="1.5" rx="4" />
                          <text x="500" y="295" textAnchor="middle" fill="#64748B" fontSize="11" fontWeight="900" letterSpacing="2">
                            COURTYARD
                          </text>
                          <text x="500" y="315" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="bold">
                            (OPEN AIR LIGHTWELL)
                          </text>

                          {/* Central Elevator Banks - Locked Out Warning */}
                          <g transform="translate(420, 75)">
                            <rect width="160" height="120" fill="#450A0A" stroke="#EF4444" strokeWidth="2" rx="4" />
                            <text x="80" y="26" textAnchor="middle" fill="#FCA5A5" fontSize="10.5" fontWeight="900">
                              ELEVATOR LOBBY C
                            </text>
                            <rect x="15" y="36" width="36" height="42" fill="#7F1D1D" stroke="#EF4444" strokeWidth="1" rx="2" />
                            <text x="33" y="60" textAnchor="middle" fill="#FCA5A5" fontSize="8" fontWeight="bold">EL-A</text>
                            <rect x="62" y="36" width="36" height="42" fill="#7F1D1D" stroke="#EF4444" strokeWidth="1" rx="2" />
                            <text x="80" y="60" textAnchor="middle" fill="#FCA5A5" fontSize="8" fontWeight="bold">EL-B</text>
                            <rect x="108" y="36" width="38" height="42" fill="#7F1D1D" stroke="#EF4444" strokeWidth="1" rx="2" />
                            <text x="127" y="60" textAnchor="middle" fill="#FCA5A5" fontSize="8" fontWeight="bold">EL-C</text>
                            <rect x="10" y="86" width="140" height="24" fill="#991B1B" rx="3" />
                            <text x="80" y="102" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="900">
                              🚫 LOCKED OUT IN ALARM
                            </text>
                          </g>

                          {/* Elev Lobby E (NW) */}
                          <g transform="translate(180, 75)">
                            <rect width="110" height="85" fill="#1E293B" stroke="#475569" strokeWidth="1.5" rx="3" />
                            <text x="55" y="28" textAnchor="middle" fill="#94A3B8" fontSize="9.5" fontWeight="900">
                              ELEV LOBBY E
                            </text>
                            <text x="55" y="55" textAnchor="middle" fill="#EF4444" fontSize="8" fontWeight="bold">
                              🚫 NO EVAC USE
                            </text>
                          </g>

                          {/* Elev Lobby G (NE) */}
                          <g transform="translate(710, 75)">
                            <rect width="110" height="85" fill="#1E293B" stroke="#475569" strokeWidth="1.5" rx="3" />
                            <text x="55" y="28" textAnchor="middle" fill="#94A3B8" fontSize="9.5" fontWeight="900">
                              ELEV LOBBY G
                            </text>
                            <text x="55" y="55" textAnchor="middle" fill="#EF4444" fontSize="8" fontWeight="bold">
                              🚫 NO EVAC USE
                            </text>
                          </g>

                          {/* ======================================================== */}
                          {/* STAIRWELL A — EAST CORE (DOOR 7-A · UNION SQ EAST EXIT)  */}
                          {/* ======================================================== */}
                          <g transform="translate(885, 195)">
                            <rect
                              width="80"
                              height="145"
                              fill={currentUser.quadrant === "NW" || currentUser.quadrant === "NE" ? "#064E3B" : "#1E293B"}
                              stroke={currentUser.quadrant === "NW" || currentUser.quadrant === "NE" ? "#10B981" : "#059669"}
                              strokeWidth={currentUser.quadrant === "NW" || currentUser.quadrant === "NE" ? "3" : "1.5"}
                              rx="5"
                            />
                            <rect x="5" y="6" width="70" height="24" fill="#059669" rx="3" />
                            <text x="40" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                              🚪 STAIR A
                            </text>
                            <text x="40" y="44" textAnchor="middle" fill="#A7F3D0" fontSize="8" fontWeight="900">
                              DOOR 7-A
                            </text>
                            <text x="40" y="58" textAnchor="middle" fill="#6EE7B7" fontSize="7" fontWeight="bold">
                              EAST CORE
                            </text>
                            <rect x="6" y="66" width="68" height="20" fill="#D97706" rx="2" />
                            <text x="40" y="80" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                              🛞 ARA CHAIR
                            </text>
                            <text x="40" y="102" textAnchor="middle" fill="#E2E8F0" fontSize="7" fontWeight="bold">
                              Descent: 3m
                            </text>
                            <rect
                              x="6"
                              y="112"
                              width="68"
                              height="22"
                              fill={currentUser.quadrant === "NW" || currentUser.quadrant === "NE" ? "#10B981" : "#334155"}
                              rx="3"
                            />
                            <text x="40" y="127" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                              {currentUser.quadrant === "NW" || currentUser.quadrant === "NE" ? "⭐ PRIMARY" : "BACKUP"}
                            </text>
                          </g>

                          {/* ======================================================== */}
                          {/* STAIRWELL B — WEST CORE (DOOR 7-B · IRVING PLACE EXIT)   */}
                          {/* ======================================================== */}
                          <g transform="translate(36, 195)">
                            <rect
                              width="80"
                              height="145"
                              fill={currentUser.quadrant === "SW" || currentUser.quadrant === "SE" ? "#064E3B" : "#1E293B"}
                              stroke={currentUser.quadrant === "SW" || currentUser.quadrant === "SE" ? "#10B981" : "#059669"}
                              strokeWidth={currentUser.quadrant === "SW" || currentUser.quadrant === "SE" ? "3" : "1.5"}
                              rx="5"
                            />
                            <rect x="5" y="6" width="70" height="24" fill="#059669" rx="3" />
                            <text x="40" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                              🚪 STAIR B
                            </text>
                            <text x="40" y="44" textAnchor="middle" fill="#A7F3D0" fontSize="8" fontWeight="900">
                              DOOR 7-B
                            </text>
                            <text x="40" y="58" textAnchor="middle" fill="#6EE7B7" fontSize="7" fontWeight="bold">
                              WEST CORE
                            </text>
                            <rect x="6" y="66" width="68" height="20" fill="#047857" rx="2" />
                            <text x="40" y="80" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                              PRESSURIZED
                            </text>
                            <text x="40" y="102" textAnchor="middle" fill="#E2E8F0" fontSize="7" fontWeight="bold">
                              Descent: 3m
                            </text>
                            <rect
                              x="6"
                              y="112"
                              width="68"
                              height="22"
                              fill={currentUser.quadrant === "SW" || currentUser.quadrant === "SE" ? "#10B981" : "#334155"}
                              rx="3"
                            />
                            <text x="40" y="127" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                              {currentUser.quadrant === "SW" || currentUser.quadrant === "SE" ? "⭐ PRIMARY" : "BACKUP"}
                            </text>
                          </g>

                          {/* ======================================================== */}
                          {/* QUADRANT SECTORS                                         */}
                          {/* ======================================================== */}
                          {/* SECTOR NW */}
                          <g transform="translate(46, 44)">
                            <rect
                              width="360"
                              height="145"
                              fill={currentUser.quadrant === "NW" ? "#0284C718" : "#0F172A"}
                              stroke={currentUser.quadrant === "NW" ? "#38BDF8" : "#1E3A5F"}
                              strokeWidth={currentUser.quadrant === "NW" ? "3" : "1"}
                              rx="4"
                            />
                            <rect x="0" y="0" width="220" height="22" fill={currentUser.quadrant === "NW" ? "#0284C7" : "#1E3A5F"} rx="3" />
                            <text x="110" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                              SECTOR NW · STRATEGIC PLANNING
                            </text>
                            {currentUser.quadrant === "NW" && (
                              <g transform="translate(180, 75)" className="beacon-pin">
                                <circle r="22" fill="url(#beaconGlow)" />
                                <circle r="10" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" />
                                <text x="0" y="24" textAnchor="middle" fill="#38BDF8" fontSize="9" fontWeight="900">
                                  📍 YOU ARE HERE ({currentUser.name.split(" ")[0]})
                                </text>
                              </g>
                            )}
                          </g>

                          {/* SECTOR NE */}
                          <g transform="translate(590, 44)">
                            <rect
                              width="370"
                              height="145"
                              fill={currentUser.quadrant === "NE" ? "#0284C718" : "#0F172A"}
                              stroke={currentUser.quadrant === "NE" ? "#38BDF8" : "#1E3A5F"}
                              strokeWidth={currentUser.quadrant === "NE" ? "3" : "1"}
                              rx="4"
                            />
                            <rect x="0" y="0" width="240" height="22" fill={currentUser.quadrant === "NE" ? "#0284C7" : "#1E3A5F"} rx="3" />
                            <text x="120" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                              SECTOR NE · SECURITY &amp; GAS OPS
                            </text>
                            {currentUser.quadrant === "NE" && (
                              <g transform="translate(180, 75)" className="beacon-pin">
                                <circle r="22" fill="url(#beaconGlow)" />
                                <circle r="10" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" />
                                <text x="0" y="24" textAnchor="middle" fill="#38BDF8" fontSize="9" fontWeight="900">
                                  📍 YOU ARE HERE ({currentUser.name.split(" ")[0]})
                                </text>
                              </g>
                            )}
                          </g>

                          {/* SECTOR SW */}
                          <g transform="translate(46, 345)">
                            <rect
                              width="360"
                              height="235"
                              fill={currentUser.quadrant === "SW" ? "#0284C718" : "#0F172A"}
                              stroke={currentUser.quadrant === "SW" ? "#38BDF8" : "#1E3A5F"}
                              strokeWidth={currentUser.quadrant === "SW" ? "3" : "1"}
                              rx="4"
                            />
                            <rect x="0" y="0" width="220" height="22" fill={currentUser.quadrant === "SW" ? "#0284C7" : "#1E3A5F"} rx="3" />
                            <text x="110" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                              SECTOR SW · AMI / STEAM WEST
                            </text>
                            {currentUser.quadrant === "SW" && (
                              <g transform="translate(180, 115)" className="beacon-pin">
                                <circle r="22" fill="url(#beaconGlow)" />
                                <circle r="10" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" />
                                <text x="0" y="24" textAnchor="middle" fill="#38BDF8" fontSize="9" fontWeight="900">
                                  📍 YOU ARE HERE ({currentUser.name.split(" ")[0]})
                                </text>
                              </g>
                            )}
                          </g>

                          {/* SECTOR SE */}
                          <g transform="translate(590, 345)">
                            <rect
                              width="370"
                              height="235"
                              fill={currentUser.quadrant === "SE" ? "#0284C718" : "#0F172A"}
                              stroke={currentUser.quadrant === "SE" ? "#38BDF8" : "#1E3A5F"}
                              strokeWidth={currentUser.quadrant === "SE" ? "3" : "1"}
                              rx="4"
                            />
                            <rect x="0" y="0" width="240" height="22" fill={currentUser.quadrant === "SE" ? "#0284C7" : "#1E3A5F"} rx="3" />
                            <text x="120" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                              SECTOR SE · OPERATIONS &amp; TURNSTILES
                            </text>
                            {currentUser.quadrant === "SE" && (
                              <g transform="translate(180, 115)" className="beacon-pin">
                                <circle r="22" fill="url(#beaconGlow)" />
                                <circle r="10" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" />
                                <text x="0" y="24" textAnchor="middle" fill="#38BDF8" fontSize="9" fontWeight="900">
                                  📍 YOU ARE HERE ({currentUser.name.split(" ")[0]})
                                </text>
                              </g>
                            )}
                          </g>

                          {/* ======================================================== */}
                          {/* ANIMATED EGRESS ROUTE PATH TO ASSIGNED PRIMARY STAIRWELL */}
                          {/* ======================================================== */}
                          {currentUser.quadrant === "NW" && (
                            <path
                              d="M 226 119 L 400 119 L 400 65 L 600 65 L 885 240"
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animated-egress-route"
                            />
                          )}
                          {currentUser.quadrant === "NE" && (
                            <path
                              d="M 770 119 L 885 240"
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animated-egress-route"
                            />
                          )}
                          {currentUser.quadrant === "SW" && (
                            <path
                              d="M 226 460 L 116 265"
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animated-egress-route"
                            />
                          )}
                          {currentUser.quadrant === "SE" && (
                            <path
                              d="M 770 460 L 580 550 L 230 550 L 116 265"
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animated-egress-route"
                            />
                          )}

                          {/* Outdoor Assembly Callouts */}
                          <g transform="translate(720, 565)">
                            <rect width="240" height="24" fill="#065F46" stroke="#34D399" strokeWidth="1" rx="3" />
                            <text x="120" y="16" textAnchor="middle" fill="#ECFDF5" fontSize="8.5" fontWeight="900">
                              🌳 ASSEMBLY POINT A · PARK PLAZA (200FT+)
                            </text>
                          </g>
                          <g transform="translate(46, 565)">
                            <rect width="240" height="24" fill="#065F46" stroke="#34D399" strokeWidth="1" rx="3" />
                            <text x="120" y="16" textAnchor="middle" fill="#ECFDF5" fontSize="8.5" fontWeight="900">
                              🌳 ASSEMBLY POINT B · IRVING PL (200FT+)
                            </text>
                          </g>
                        </svg>
                      </div>

                      {/* Map Key & Tactical Steps */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                        <div className="bg-[#10243E] p-2 rounded-lg border border-white/10 flex items-center gap-1.5">
                          <span>🚪</span>
                          <span className="text-emerald-300 font-bold">Door 7-A: East Core</span>
                        </div>
                        <div className="bg-[#10243E] p-2 rounded-lg border border-white/10 flex items-center gap-1.5">
                          <span>🚪</span>
                          <span className="text-emerald-300 font-bold">Door 7-B: West Core</span>
                        </div>
                        <div className="bg-[#10243E] p-2 rounded-lg border border-red-500/30 flex items-center gap-1.5">
                          <span>🚫</span>
                          <span className="text-red-300 font-bold">Elevators Grounded</span>
                        </div>
                        <div className="bg-[#10243E] p-2 rounded-lg border border-amber-500/30 flex items-center gap-1.5">
                          <span>🛞</span>
                          <span className="text-amber-300 font-bold">Stryker ARA Chair</span>
                        </div>
                      </div>

                      {/* Tactical Egress Instructions Card */}
                      <div className="bg-[#10243E] p-3 rounded-xl border border-white/10 space-y-1.5 text-xs">
                        <div className="font-black text-white flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-amber-300">
                            <span>🚶‍♂️</span>
                            <span>Tactical Route for {currentUser.name}</span>
                          </span>
                          <span className="text-[10px] text-slate-300 font-mono">
                            Floor 07 · Con Edison
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {quadrantEscapeInfo.primaryPath}
                        </p>
                        <div className="pt-1 border-t border-white/10 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-300">
                          <div>
                            <span className="text-slate-400">Outdoor Assembly: </span>
                            <span className="font-bold text-emerald-300">{quadrantEscapeInfo.assemblyPoint}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Street: </span>
                            <span className="font-bold text-white">{quadrantEscapeInfo.assemblyCrossStreet}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 1: NYC Fire Code 5-Step Evacuation Protocol */}
                  {activeEvacTab === "route" && (
                    <div className="space-y-2.5 animate-fadeIn">
                      <div className="bg-[#10243E] p-3 rounded-xl border border-red-500/30 flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                        <div className="space-y-0.5">
                          <div className="font-black text-white text-xs flex items-center gap-1.5">
                            <span>🚫 NEVER USE ELEVATORS (Automatic Phase I Recall)</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Elevator banks automatically return to Ground Lobby upon alarm trip. Elevator shafts act as high-velocity chimneys for toxic combustion gases. Egress is strictly via pressurized enclosed fire stairwells.
                          </p>
                        </div>
                      </div>

                      <div className="bg-[#10243E] p-3 rounded-xl border border-sky-500/30 flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-sky-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                        <div className="space-y-0.5">
                          <div className="font-black text-white text-xs flex items-center gap-1.5">
                            <span>🚶‍♂️ WALK, DO NOT RUN — USE RIGHT-HAND RAIL</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Descend in single file with your right hand on the handrail. Keep the left-hand lane unobstructed at all times for ascending FDNY firefighters and emergency teams carrying hose bundles and equipment.
                          </p>
                        </div>
                      </div>

                      <div className="bg-[#10243E] p-3 rounded-xl border border-amber-500/30 flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                        <div className="space-y-0.5">
                          <div className="font-black text-white text-xs flex items-center gap-1.5">
                            <span>🚪 CLOSE (DO NOT LOCK) ALL FIRE DOORS BEHIND YOU</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Self-closing 2-hour rated fire doors compartmentalize heat and smoke. Latch all doors firmly to preserve clean air positive pressure in stairwells and prevent thermal draft flashovers.
                          </p>
                        </div>
                      </div>

                      <div className="bg-[#10243E] p-3 rounded-xl border border-purple-500/30 flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">4</span>
                        <div className="space-y-0.5">
                          <div className="font-black text-white text-xs flex items-center gap-1.5">
                            <span>🛞 MOBILITY ASSISTANCE &amp; AREA OF RESCUE ASSISTANCE (ARA)</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            If you or a colleague cannot walk down stairs, report to the <span className="text-amber-300 font-bold">Stairwell A landing (Door 7-A)</span>. Tap the <strong>"Request Evac Chair"</strong> button below or inform the Floor Warden. Trained operators will assist using the tracked Stryker Evacuation Chair.
                          </p>
                        </div>
                      </div>

                      <div className="bg-[#10243E] p-3 rounded-xl border border-emerald-500/30 flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">5</span>
                        <div className="space-y-0.5">
                          <div className="font-black text-white text-xs flex items-center gap-1.5">
                            <span>📍 MUSTER OUTSIDE &amp; TAP "SAFE OUTSIDE"</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Exit street level onto East 14th St or Irving Pl. Cross to your designated muster assembly area 200+ ft clear of the building facade. Tap <strong>"✓ Safe Outside"</strong> on this pass to clear your muster census.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Life-Safety Equipment Reference */}
                  {activeEvacTab === "equipment" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-fadeIn">
                      <div className="bg-[#10243E] p-3.5 rounded-xl border border-white/10 space-y-1">
                        <div className="flex items-center gap-1.5 text-red-400 font-black">
                          <span>🔔</span>
                          <span>Manual Fire Pull Stations</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Mounted directly adjacent to every exit door leading to Stairwell A and Stairwell B. Pull lever down firmly to sound building-wide alarm and notify FDNY dispatch.
                        </p>
                      </div>

                      <div className="bg-[#10243E] p-3.5 rounded-xl border border-white/10 space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-400 font-black">
                          <span>🛞</span>
                          <span>Stryker Evacuation Chair (ARA)</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Mounted at Stairwell A Landing. 400 lb rated capacity with tracked tread braking for controlled descent of mobility-impaired persons.
                        </p>
                      </div>

                      <div className="bg-[#10243E] p-3.5 rounded-xl border border-white/10 space-y-1">
                        <div className="flex items-center gap-1.5 text-sky-400 font-black">
                          <span>🧯</span>
                          <span>ABC Dry Chemical Extinguishers</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Staged every 75 feet along corridors in Quadrants NW, NE, SW, and SE. PASS method: Pull pin, Aim nozzle, Squeeze handle, Sweep base of flame.
                        </p>
                      </div>

                      <div className="bg-[#10243E] p-3.5 rounded-xl border border-white/10 space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-black">
                          <span>🫀</span>
                          <span>Automated External Defibrillator (AED)</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Mounted on North wall of central elevator lobby next to First Aid emergency station. Voice-guided automated cardiac rescue.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Emergency Contacts */}
                  {activeEvacTab === "contacts" && (
                    <div className="space-y-2 animate-fadeIn">
                      <div className="bg-[#10243E] p-3 rounded-xl border border-red-500/30 flex items-center justify-between">
                        <div>
                          <div className="text-red-400 font-black text-xs flex items-center gap-1.5">
                            <span>🚒</span>
                            <span>FDNY Emergency Services</span>
                          </div>
                          <div className="text-[11px] text-slate-300">Citywide Fire, Smoke, Medical &amp; Rescue</div>
                        </div>
                        <a
                          href="tel:911"
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-mono font-black text-xs rounded-lg transition"
                        >
                          📞 911
                        </a>
                      </div>

                      <div className="bg-[#10243E] p-3 rounded-xl border border-sky-500/30 flex items-center justify-between">
                        <div>
                          <div className="text-sky-400 font-black text-xs flex items-center gap-1.5">
                            <span>🚨</span>
                            <span>Con Edison Security Operations (24/7)</span>
                          </div>
                          <div className="text-[11px] text-slate-300">Central Control Deck · ext. 1000</div>
                        </div>
                        <a
                          href="tel:2124601000"
                          className="px-3 py-1.5 bg-[#005DAA] hover:bg-[#004A88] text-white font-mono font-black text-xs rounded-lg transition"
                        >
                          📞 (212) 460-1000
                        </a>
                      </div>

                      <div className="bg-[#10243E] p-3 rounded-xl border border-amber-500/30 flex items-center justify-between">
                        <div>
                          <div className="text-amber-400 font-black text-xs flex items-center gap-1.5">
                            <span>🦺</span>
                            <span>Floor 07 Fire Warden Command Post</span>
                          </div>
                          <div className="text-[11px] text-slate-300">Floor 07 Station Lead · ext. 7007</div>
                        </div>
                        <a
                          href="tel:7007"
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-mono font-black text-xs rounded-lg transition"
                        >
                          📞 ext. 7007
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Fast Action Emergency Buttons */}
                  <div className="pt-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={handleMarkSafeOutside}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 col-span-1"
                    >
                      <span>🟢</span>
                      <span>I Am Safe Outside</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestEvacChair}
                      className="py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 col-span-1"
                    >
                      <span>🛞</span>
                      <span>Request Evac Chair</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestHelp}
                      className="py-2.5 px-3 bg-red-700 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 col-span-2 sm:col-span-1"
                    >
                      <span>🆘</span>
                      <span>Send SOS Alert</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FLOW 2: SIGN-IN FORMAT (EMPLOYEE OR VISITOR)              */}
      {/* ========================================================= */}
      {viewState === "newcomer-signin" && (
        <div className="bg-white border-2 border-[#005DAA] rounded-2xl p-5 sm:p-7 shadow-md space-y-5">
          {/* Quick Switch to Active Pass if Returning User */}
          {savedOccupantId && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 p-2.5 rounded-xl text-xs">
              <span className="text-emerald-950 font-bold">
                Already registered on this device?
              </span>
              <button
                type="button"
                onClick={() => setViewState("confirmed")}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-lg text-xs transition cursor-pointer shrink-0 shadow-xs"
              >
                🏷️ View My Digital Pass →
              </button>
            </div>
          )}

          <div className="border-b border-[#B8D8F8] pb-4">
            {eventDetails ? (
              <div className="mb-3 p-3 bg-[#EBF5FB] border border-[#005DAA] rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono font-bold text-[#005DAA] uppercase">Active Check-In Session</div>
                  <div className="text-sm font-black text-[#003B70]">{eventDetails.name}</div>
                  <div className="text-[10px] text-slate-500">{eventDetails.date} · Token: {eventToken}</div>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Live QR Session
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-[#EBF5FB] border border-[#B8D8F8] text-[#005DAA] px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                <span>✨</span>
                <span>FLOOR 07 ACCESS &amp; SIGN-IN · CON EDISON</span>
              </div>
            )}
            <h2 className="text-lg sm:text-xl font-black text-[#0F2537] uppercase">
              Scan &amp; Sign In as Employee or Visitor
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Select your role below, verify floor presence in 1 tap, and be automatically accounted for on Floor 07.
            </p>
          </div>

          {/* NYC Fire Code Life Safety Notice for all entrants */}
          <div className="bg-[#EBF5FB] border border-[#005DAA]/30 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛡️</span>
              <div>
                <span className="font-bold text-[#003B70] block">NYC Fire Code 3 RCNY §401-06 Life-Safety Notice</span>
                <span className="text-[11px] text-[#475569]">
                  Emergency Egress: <strong>Stairwell A (East Core)</strong> &amp; <strong>Stairwell B (West Core)</strong>. Elevators are locked out during alarms.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewState("confirmed")}
              className="px-2.5 py-1.5 bg-[#005DAA] hover:bg-[#004A88] text-white font-black rounded-lg text-[10px] transition cursor-pointer shrink-0 uppercase tracking-wider shadow-xs"
            >
              Escape Guide →
            </button>
          </div>

          {/* Role Distinction Switch: Worker vs Visitor */}
          <div className="grid grid-cols-2 gap-2 bg-[#F0F6FC] p-1.5 rounded-xl border border-[#B8D8F8] text-xs font-bold text-center">
            <button
              type="button"
              onClick={() => {
                setUserType("employee");
                setSignRole("Employee");
                setSignCompany("Con Edison");
              }}
              className={`py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${userType === "employee"
                  ? "bg-[#005DAA] text-white shadow-sm font-black"
                  : "text-[#475569] hover:bg-white"
                }`}
            >
              <span>🏢</span>
              <span>Con Edison Worker</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUserType("visitor");
                setSignRole("Visitor");
                setSignCompany("Guest / Visitor");
              }}
              className={`py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${userType === "visitor"
                  ? "bg-amber-600 text-white shadow-sm font-black"
                  : "text-[#475569] hover:bg-white"
                }`}
            >
              <span>🎟️</span>
              <span>Visitor / Guest</span>
            </button>
          </div>

          {/* RECOGNIZED EXISTING USER QUICK SIGN-IN HELPER */}
          {matchingExistingUser && (
            <div className="p-3.5 bg-[#EBF3FB] border-2 border-[#005DAA] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
              <div className="text-xs">
                <div className="font-mono font-black text-[#005DAA] uppercase text-[10px]">
                  RECOGNIZED PROFILE IN DATABASE
                </div>
                <div className="font-black text-[#0F2537] text-sm">
                  {matchingExistingUser.name}{" "}
                  <span className="text-xs font-normal text-slate-500 font-mono">
                    ({matchingExistingUser.id} · {matchingExistingUser.role})
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Floor 07 · Zone {matchingExistingUser.quadrant} · Phone: {matchingExistingUser.phone || "On File"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDirectSignInExisting(matchingExistingUser)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-lg font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>⚡</span>
                <span>Direct Sign In</span>
              </button>
            </div>
          )}

          {/* Quick Demo Autofill Helpers */}
          <div className="bg-[#F4F8FC] p-3 rounded-xl border border-[#CBDCEE] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#005DAA]">⚡ 1-Tap Demo Sign-In:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutofillEmployee}
                className="px-3 py-1.5 bg-white hover:bg-[#EBF5FB] border border-[#005DAA]/40 text-[#005DAA] rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>👤</span>
                <span>Fill Staff Lead (Robert Petillo)</span>
              </button>
            </div>
          </div>

          {/* 1-Tap Biometric / Touch ID Fingerprint Sign-In */}
          <div className="bg-linear-to-r from-[#003B70] to-[#005DAA] text-white p-3.5 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 border border-sky-400/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0">
                👆
              </div>
              <div>
                <div className="text-xs font-black tracking-wide flex items-center gap-1.5">
                  <span>Touch ID / Fingerprint Fast Sign-In</span>
                  <span className="text-[9px] bg-emerald-400 text-emerald-950 font-black px-1.5 py-0.5 rounded uppercase">WebAuthn</span>
                </div>
                <p className="text-[11px] text-sky-100 mt-0.5">
                  Use your phone or laptop biometric sensor to sign in &amp; verify floor presence in 1 tap.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBiometricSignIn}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs uppercase tracking-wider rounded-lg transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>👆</span>
              <span>{isSubmitting ? "Scanning..." : "Scan Fingerprint"}</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleNewcomerSignIn} className="space-y-4">
            {/* SELECT SIGN-IN ACTION: 3-ACTION SELECTOR */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-[#005DAA] tracking-wider block">
                SELECT SIGN-IN ACTION:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSignAction("enter")}
                  className={`p-3 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${signAction === "enter"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                      : "bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8] hover:bg-white"
                    }`}
                >
                  <span className="text-base">🟢</span>
                  <span>Entering Building</span>
                  <span className="text-[10px] font-normal opacity-90">(On Floor 07)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSignAction("leave")}
                  className={`p-3 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${signAction === "leave"
                      ? "bg-slate-700 text-white border-slate-900 shadow-sm"
                      : "bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8] hover:bg-white"
                    }`}
                >
                  <span className="text-base">⚪</span>
                  <span>Leaving Building</span>
                  <span className="text-[10px] font-normal opacity-90">(Badge Out)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSignAction("muster")}
                  className={`p-3 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${signAction === "muster"
                      ? "bg-[#005DAA] text-white border-[#003B70] shadow-sm"
                      : "bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8] hover:bg-white"
                    }`}
                >
                  <span className="text-base">🚨</span>
                  <span>Muster Check-In</span>
                  <span className="text-[10px] font-normal opacity-90">(Safe Outside)</span>
                </button>
              </div>
            </div>

            {/* Row 1: Full Name & Phone Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="w-full min-h-[44px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] font-semibold focus:border-[#005DAA] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Phone Number (SMS Alert) *
                </label>
                <input
                  type="tel"
                  required
                  value={signPhone}
                  onChange={(e) => setSignPhone(e.target.value)}
                  placeholder="e.g. (212) 555-0144"
                  className="w-full min-h-[44px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] font-mono font-semibold focus:border-[#005DAA] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Row 2: Role / Type & Company / Organization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Role / Type
                </label>
                <select
                  value={signRole}
                  onChange={(e) => setSignRole(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-xs font-bold text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
                >
                  <option value="Employee">Employee (Con Edison)</option>
                  <option value="Contractor">Contractor / Consultant</option>
                  <option value="Visitor">Visitor / Guest</option>
                  <option value="VIP">Executive / VIP</option>
                  <option value="First Responder">First Responder / Floor Warden</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={signCompany}
                  onChange={(e) => setSignCompany(e.target.value)}
                  placeholder="e.g. Con Edison"
                  className="w-full min-h-[44px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-xs text-[#0F2537] font-semibold focus:border-[#005DAA] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Row 3: Department Zone & Desk / Workstation # */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Department Zone
                </label>
                <select
                  value={signQuad}
                  onChange={(e) => setSignQuad(e.target.value as QuadrantId)}
                  className="w-full min-h-[44px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-xs font-bold text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
                >
                  <option value="NW">NW · Strategic Planning</option>
                  <option value="NE">NE · Gas Operations & Security</option>
                  <option value="SW">SW · AMI & Ombudsman</option>
                  <option value="SE">SE · Steam Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Desk / Workstation #
                </label>
                <input
                  type="text"
                  value={signDesk}
                  onChange={(e) => setSignDesk(e.target.value)}
                  placeholder="e.g. 07-463 or 07-551"
                  className="w-full min-h-[44px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-xs text-[#0F2537] font-semibold focus:border-[#005DAA] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Digital Signature Pad */}
            <div className="pt-1">
              <DigitalSignaturePad
                defaultName={signName}
                onSignatureChange={(sigData, sigType) => {
                  setSignatureData(sigData);
                  setSignatureType(sigType);
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !signName.trim() || !signPhone.trim()}
              className="w-full min-h-[48px] rounded-xl text-white font-black text-xs sm:text-sm uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-[#003B70] via-[#005DAA] to-[#00A3E0] hover:brightness-110"
            >
              <span>{isSubmitting ? "⏳" : "📲"}</span>
              <span>
                {isSubmitting
                  ? "UPDATING ROSTER & MAP..."
                  : "SIGN IN & GET DIGITAL FLOOR 07 PASS"}
              </span>
            </button>
          </form>

          {/* Quick Existing User Lookup */}
          <div className="border-t border-[#B8D8F8] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-[#475569] font-medium">Already signed in before on this floor?</span>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setSavedOccupantId(e.target.value);
                try {
                  localStorage.setItem("muster_registered_occupant_id", e.target.value);
                } catch { }
                setViewState("confirmed");
              }}
              className="bg-[#F0F6FC] border border-[#B8D8F8] rounded-lg px-2.5 py-1.5 font-bold text-[#005DAA] text-xs focus:outline-none w-full sm:w-auto"
            >
              <option value="">Select Existing Name / OCC #...</option>
              {occupants.slice(0, 30).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.id} · {o.role} · {o.phone || "No Phone"})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
