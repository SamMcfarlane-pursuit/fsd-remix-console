import { useCallback, useEffect, useState } from "react";
import { UserFlowStepper } from "./components/UserFlowStepper";
import { Step1Scan } from "./components/steps/Step1Scan";
import { Step2SignedIn } from "./components/steps/Step2SignedIn";
import { Step3Alarm } from "./components/steps/Step3Alarm";
import { Step4Broadcast } from "./components/steps/Step4Broadcast";
import { Step5AllSafe } from "./components/steps/Step5AllSafe";
import OccupantPortal from "./components/OccupantPortal";
import LoginScreen from "./components/LoginScreen";
import { SignInQRPosterModal } from "./components/SignInQRPosterModal";
import { SelfSignInModal } from "./components/SelfSignInModal";
import BuildingStatusReportModal from "./components/BuildingStatusReportModal";
import DeclareIncidentModal from "./components/DeclareIncidentModal";
import EmergencyAlertModal from "./components/EmergencyAlertModal";
import { NavigationGuideModal } from "./components/NavigationGuideModal";
import { PinModal } from "./components/PinModal";
import { ExecutiveOnePagerModal } from "./components/ExecutiveOnePagerModal";
import { setAudioMuted, getAudioMuted } from "./lib/audioBroadcast";
import { UserRole } from "./lib/authGuard";
import { AuthUser, EmergencyAlertPayload, LocationCategory, OccupantStatus, StatusSnapshot } from "./types";
import { validateGeofence, LocationMetadata, FLOOR_07_CONSTRAINTS } from "./lib/geofence";
import { appendLedgerEntry } from "./lib/ledger";
import {
  cacheRosterLocally,
  getCachedRoster,
  syncOfflineQueue,
  getOfflineQueue,
  queueOfflineAction,
} from "./lib/offlineQueue";
import { setLiveTunnelUrl } from "./lib/qr";

export default function App() {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(() => getOfflineQueue().length);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const stored = sessionStorage.getItem("muster_auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [viewMode, setViewMode] = useState<"admin" | "occupant">(() => {
    try {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        if (
          urlParams.get("mode") === "signin" ||
          urlParams.get("mode") === "occupant" ||
          urlParams.get("scan") === "1" ||
          urlParams.get("scan") === "signin" ||
          urlParams.get("qr") === "1" ||
          urlParams.get("station") ||
          urlParams.get("id") ||
          urlParams.get("badge") ||
          urlParams.get("token")
        ) {
          return "occupant";
        }
      }
    } catch {}
    return "admin";
  });

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isStatusReportModalOpen, setIsStatusReportModalOpen] = useState(false);
  const [isDeclareIncidentModalOpen, setIsDeclareIncidentModalOpen] = useState(false);
  const [isSignInPosterOpen, setIsSignInPosterOpen] = useState(false);
  const [isSelfSignInOpen, setIsSelfSignInOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => getAudioMuted());
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [targetPinRole, setTargetPinRole] = useState<UserRole>("commander");
  const [isOnePagerOpen, setIsOnePagerOpen] = useState<boolean>(false);

  // Check URL query parameters on initial load (e.g. ?mode=signin or mobile scan)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("mode") === "one-pager" || urlParams.get("onepager") === "1" || urlParams.get("pager") === "1") {
        setIsOnePagerOpen(true);
      }
      if (
        urlParams.get("mode") === "signin" ||
        urlParams.get("mode") === "occupant" ||
        urlParams.get("scan") === "1" ||
        urlParams.get("scan") === "signin" ||
        urlParams.get("token") ||
        urlParams.get("qr") === "1" ||
        urlParams.get("station") ||
        urlParams.get("id") ||
        urlParams.get("badge")
      ) {
        setViewMode("occupant");
        const storedAuth = sessionStorage.getItem("muster_auth_user");
        if (!storedAuth) {
          const guestUser: AuthUser = {
            id: "guest-occupant",
            userId: "guest.occupant",
            name: "Guest / Occupant Device",
            role: "occupant",
            roleLabel: "Occupant (Device Token)",
            caps: 0,
            capsList: [],
            isGuest: true,
          };
          setAuthUser(guestUser);
          try {
            sessionStorage.setItem("muster_auth_user", JSON.stringify(guestUser));
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Could not check URL parameters", e);
    }
  }, []);

  // Handle successful login
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    try {
      sessionStorage.setItem("muster_auth_user", JSON.stringify(user));
    } catch (e) {
      console.warn("Could not cache session", e);
    }
    if (user.role === "occupant") {
      setViewMode("occupant");
    } else {
      setViewMode("admin");
    }
    refreshState();
  };

  // Direct access to occupant app without credentials
  const handleEnterOccupantApp = () => {
    const guestUser: AuthUser = {
      id: "guest-occupant",
      userId: "guest.occupant",
      name: "Guest / Occupant Device",
      role: "occupant",
      roleLabel: "Occupant (Device Token)",
      caps: 0,
      capsList: [],
      isGuest: true,
    };
    setAuthUser(guestUser);
    try {
      sessionStorage.setItem("muster_auth_user", JSON.stringify(guestUser));
    } catch (e) {
      console.warn("Could not cache session", e);
    }
    setViewMode("occupant");
  };

  // Handle Sign Out - 100% resets session and returns to clean LoginScreen
  const handleLogout = async () => {
    if (authUser && !authUser.isGuest) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: authUser.userId }),
        });
      } catch (e) {
        console.warn("Logout sync deferred", e);
      }
    }

    // 1. Immediately reset state so LoginScreen mounts
    setAuthUser(null);
    setViewMode("admin");

    // 2. Strip URL query params so initial load checks don't re-login
    try {
      if (typeof window !== "undefined" && window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {}

    // 3. Clear all cached occupant and auth tokens
    try {
      sessionStorage.removeItem("muster_auth_user");
      localStorage.removeItem("muster_registered_occupant_id");
      localStorage.removeItem("muster_occupant_id");
      localStorage.removeItem("muster_registered_phone");
      localStorage.removeItem("muster_registered_name");
    } catch (e) {
      console.warn("Could not remove session/storage", e);
    }
  };

  // Fetch live state from backend with offline caching fallback
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
        if (data.publicTunnelUrl) {
          setLiveTunnelUrl(data.publicTunnelUrl);
        }
        if (data.occupants && data.occupants.length > 0) {
          cacheRosterLocally(data.occupants);
        }
      }
    } catch (err) {
      console.warn("State update check (offline fallback):", err);
      // OFFLINE FALLBACK: Load cached roster from local device storage
      const cached = getCachedRoster();
      if (cached && cached.length > 0) {
        setSnapshot((prev) => {
          if (prev && prev.occupants && prev.occupants.length > 0) return prev;
          const inside = cached.filter((o: any) => !o.badgedOut).length;
          const safeCount = cached.filter((o: any) => o.status === "safe" || o.checkedIn).length;
          return {
            incidentDeclared: false,
            drillMode: false,
            alarmStatus: "inactive",
            broadcastActive: false,
            phase: "scan",
            occupants: cached,
            facilityId: "4-IRVING-PL-FL07",
            accounted: safeCount,
            expectedOnFloor: 195,
            buildingStats: {
              totalStaff: cached.length,
              insideBuilding: inside,
              offsite: cached.length - inside,
              accountedFor: safeCount,
              unaccountedFor: inside - safeCount,
              pendingCount: 0,
              attendanceRate: Math.round((inside / (cached.length || 1)) * 100),
            },
            lastUpdated: new Date().toISOString(),
          } as any;
        });
      }
    }
  }, []);

  // Offline event listeners & automatic replay sync when connection restores
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      console.log("🌐 Connection restored! Syncing offline queue...");
      setIsSyncingOffline(true);
      try {
        const result = await syncOfflineQueue();
        if (result.syncedCount > 0) {
          console.log(`✅ Synced ${result.syncedCount} offline actions to server.`);
          await refreshState();
        }
      } catch (err) {
        console.warn("Offline sync error:", err);
      } finally {
        setIsSyncingOffline(false);
        setOfflineQueueCount(getOfflineQueue().length);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.warn("⚠️ Network connection lost. Offline resilient mode active.");
    };

    const handleQueueChanged = (e: any) => {
      setOfflineQueueCount(e?.detail?.queue?.length ?? getOfflineQueue().length);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("muster-offline-queue-changed", handleQueueChanged);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("muster-offline-queue-changed", handleQueueChanged);
    };
  }, [refreshState]);

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 3500);
    return () => clearInterval(interval);
  }, [refreshState]);

  // Handle occupant check-in with Geo-Fence validation check
  const handleCheckIn = async (
    occupantId: string,
    status: OccupantStatus,
    via: string = "kiosk",
    notes?: string,
    locationCategory?: "inside-building" | "outside-assembly" | "offsite",
    assemblyPoint?: string,
    locationMetadata?: LocationMetadata
  ) => {
    const existingOccupant = snapshot?.occupants?.find((o) => o.id === occupantId);

    const metaToValidate: LocationMetadata = locationMetadata || {
      source: via.includes("kiosk")
        ? "kiosk_beacon"
        : via.includes("qr")
        ? "qr_scanner"
        : "manual",
      claimedZone: assemblyPoint || locationCategory,
      cad:
        existingOccupant?.xCoord && existingOccupant?.yCoord
          ? {
              x: existingOccupant.xCoord,
              y: existingOccupant.yCoord,
              floor: 7,
              quadrant: existingOccupant.quadrant,
              deskId: existingOccupant.desk,
            }
          : undefined,
    };

    const geoResult = validateGeofence(metaToValidate, FLOOR_07_CONSTRAINTS);

    const resolvedCategory: LocationCategory = locationCategory || geoResult.locationCategory;
    const resolvedAssemblyPoint: string | undefined =
      assemblyPoint ||
      (resolvedCategory === "outside-assembly"
        ? geoResult.assemblyPoint || "Assembly Point A (Park Plaza / Union Sq East)"
        : undefined);

    const resolvedLastLocation: string =
      resolvedCategory === "outside-assembly"
        ? resolvedAssemblyPoint || "Assembly Point A (Park Plaza)"
        : resolvedCategory === "inside-building"
        ? `${existingOccupant?.quadrant || geoResult.detectedQuadrant || "NW"} Floor 07`
        : "Off-Site / Remote";

    try {
      await appendLedgerEntry({
        facilityId: FLOOR_07_CONSTRAINTS.facilityId,
        type: "muster_checkin",
        actorUid: occupantId,
        displayName: existingOccupant?.name || occupantId,
        payload: {
          status,
          via,
          notes,
          locationCategory: resolvedCategory,
          assemblyPoint: resolvedAssemblyPoint,
          lastLocation: resolvedLastLocation,
          geofenceVerification: {
            isInsideBuilding: geoResult.isInsideBuilding,
            isAtAssemblyPoint: geoResult.isAtAssemblyPoint,
            confidence: geoResult.confidence,
            distanceMeters: geoResult.distanceToBuildingCenterMeters,
            auditDetails: geoResult.auditDetails,
          },
        },
      });
    } catch (e) {
      console.warn("Local ledger append warning:", e);
    }

    setSnapshot((prev) => {
      if (!prev) return prev;
      const updatedOccupants = (prev.occupants || []).map((o) =>
        o.id === occupantId
          ? {
              ...o,
              status,
              notes: notes || o.notes,
              locationCategory: resolvedCategory,
              assemblyPoint: resolvedAssemblyPoint,
              lastLocation: resolvedLastLocation,
              geofenceValidation: {
                isInsideBuilding: geoResult.isInsideBuilding,
                isAtAssemblyPoint: geoResult.isAtAssemblyPoint,
                locationCategory: resolvedCategory,
                assemblyPoint: resolvedAssemblyPoint || null,
                confidence: geoResult.confidence,
                distanceMeters: geoResult.distanceToBuildingCenterMeters,
                verifiedAt: new Date().toISOString(),
                auditDetails: geoResult.auditDetails,
              },
            }
          : o
      );
      const accounted = updatedOccupants.filter((o) => o.status === "safe").length;
      const needHelp = updatedOccupants.filter((o) => o.status === "need-help").length;
      const mia = updatedOccupants.filter((o) => o.status === "mia").length;
      const awaitingEvacChair = updatedOccupants.filter((o) => o.status === "awaiting-evac-chair").length;
      return {
        ...prev,
        occupants: updatedOccupants,
        accounted,
        needHelp,
        mia,
        awaitingEvacChair,
      };
    });

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupantId,
          status,
          via,
          notes,
          locationCategory: resolvedCategory,
          assemblyPoint: resolvedAssemblyPoint,
          locationMetadata: metaToValidate,
          geoValidation: {
            isInsideBuilding: geoResult.isInsideBuilding,
            isAtAssemblyPoint: geoResult.isAtAssemblyPoint,
            confidence: geoResult.confidence,
            auditDetails: geoResult.auditDetails,
          },
        }),
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.warn("Check-in processed locally (queued for offline sync):", err);
      queueOfflineAction("check-in", {
        occupantId,
        status,
        via,
        notes,
        locationCategory: resolvedCategory,
        assemblyPoint: resolvedAssemblyPoint,
        locationMetadata: metaToValidate,
      });
    }
  };

  // Handle bulk check-in
  const handleBulkCheckIn = async (
    occupantIds: string[],
    status: OccupantStatus,
    via: string = "batch-action",
    notes?: string
  ) => {
    if (!occupantIds || occupantIds.length === 0) return;
    const idSet = new Set(occupantIds);

    setSnapshot((prev) => {
      if (!prev) return prev;
      const updatedOccupants = (prev.occupants || []).map((o) =>
        idSet.has(o.id) ? { ...o, status, notes: notes || o.notes } : o
      );
      const accounted = updatedOccupants.filter((o) => o.status === "safe").length;
      const needHelp = updatedOccupants.filter((o) => o.status === "need-help").length;
      const mia = updatedOccupants.filter((o) => o.status === "mia").length;
      const awaitingEvacChair = updatedOccupants.filter((o) => o.status === "awaiting-evac-chair").length;
      return {
        ...prev,
        occupants: updatedOccupants,
        accounted,
        needHelp,
        mia,
        awaitingEvacChair,
      };
    });

    try {
      const res = await fetch("/api/check-in/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupantIds, status, via, notes }),
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.warn("Bulk check-in local sync fallback (queued):", err);
      queueOfflineAction("bulk-check-in", { occupantIds, status, via, notes });
    }
  };

  // Handle Declare Incident
  const handleDeclareIncident = async (mode: "drill" | "incident", type: string) => {
    setSnapshot((prev) =>
      prev ? { ...prev, incidentActive: true, mode, hazardType: type } : prev
    );
    try {
      const res = await fetch("/api/incident/declare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, type }),
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.warn("Declare incident sync deferred:", err);
    }
  };

  // Handle Clear Incident
  const handleClearIncident = async () => {
    setSnapshot((prev) =>
      prev ? { ...prev, incidentActive: false } : prev
    );
    try {
      const res = await fetch("/api/incident/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.warn("Clear incident sync deferred:", err);
    }
  };

  // Handle Send Emergency Alert
  const handleSendEmergencyAlert = async (alertData: {
    title: string;
    narrative: string;
    priority: "CRITICAL" | "HIGH" | "WARNING";
    targetQuadrants: ("ALL" | any)[];
    channels: string[];
  }): Promise<EmergencyAlertPayload | void> => {
    try {
      const res = await fetch("/api/emergency-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertData),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshState();
        return data.alertPayload;
      }
    } catch (err) {
      console.warn("Emergency alert sync deferred:", err);
    }
  };

  if (!authUser) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onEnterOccupantApp={handleEnterOccupantApp}
          onOpenQRPoster={() => setIsSignInPosterOpen(true)}
          onOpenOnePager={() => setIsOnePagerOpen(true)}
        />
        <ExecutiveOnePagerModal
          isOpen={isOnePagerOpen}
          onClose={() => setIsOnePagerOpen(false)}
          snapshot={snapshot}
        />
      </>
    );
  }

  const occupantsList = snapshot?.occupants || [];

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#F0F6FC] text-[#0F2537] font-sans flex flex-col justify-between select-none">
      {/* Offline Resilient Status Banner */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className="bg-linear-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-1.5 text-xs font-black flex items-center justify-between shadow-md z-50">
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-sm">🟠</span>
            <span>
              {!isOnline
                ? "OFFLINE EMERGENCY MODE ACTIVE · All sign-ins, badge scans & attendance actions are securely stored locally on device."
                : "RECONNECTED · Synchronizing local offline attendance records with command server..."}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold">
            <span className="bg-slate-950/20 px-2 py-0.5 rounded">
              {offlineQueueCount} action{offlineQueueCount !== 1 ? "s" : ""} pending sync
            </span>
            {isSyncingOffline && <span className="animate-spin">⏳</span>}
          </div>
        </div>
      )}

      {/* Top Life-Safety Operational Header */}
      <header
        className={`px-4 sm:px-6 py-3 flex items-center justify-between border-b transition-colors shadow-md z-40 sticky top-0 ${
          snapshot?.incidentActive
            ? snapshot?.mode === "incident"
              ? "bg-[#990000] border-[#FF4D4D] text-white"
              : "bg-[#003B70] border-[#005DAA] text-white"
            : "bg-[#003B70] border-[#005DAA] text-white"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex items-center justify-center w-3 h-3 shrink-0 rounded-full animate-pulse shadow-sm ${
              snapshot?.incidentActive ? "bg-[#FF6B00]" : "bg-emerald-400"
            }`}
          />
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm sm:text-base font-black tracking-tight leading-none flex items-center gap-2 truncate">
              <span className="truncate">
                {snapshot?.incidentActive
                  ? `🔴 LIVE ${snapshot.mode?.toUpperCase()} ACTIVE · FLOOR 07`
                  : "🟢 MUSTERCOMMAND · 4 IRVING PL FLOOR 07"}
              </span>
              <span className="hidden sm:inline-block text-[9px] font-mono font-bold uppercase tracking-widest bg-[#0A1424]/80 text-[#38BDF8] px-2 py-0.5 rounded border border-[#00A3E0]/40 shrink-0">
                5-STEP LIFE-SAFETY ENGINE
              </span>
              <span className="hidden lg:inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Firestore Cloud Sync</span>
              </span>
            </h1>
            <p className="text-[10px] sm:text-[11px] font-bold text-[#829AB8] uppercase tracking-widest mt-0.5 truncate">
              STATUS: {snapshot?.incidentActive ? "ACTIVE EVACUATION" : "NORMAL READINESS"} · HAZARD: {snapshot?.hazardType?.toUpperCase() || "OFFICE FIRE"}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Navigation & Directory Guide Button */}
          <button
            onClick={() => setIsGuideModalOpen(true)}
            className="rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 px-3 py-2 min-h-[38px] text-xs font-black text-sky-200 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Open Platform Navigation Guide & Step Legend"
          >
            <span>🧭</span>
            <span className="hidden md:inline">Directory &amp; Guide</span>
          </button>

          {/* Audio Siren & Voice Broadcast Mute Toggle */}
          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              setAudioMuted(next);
            }}
            className={`rounded-xl border px-2.5 sm:px-3 py-2 min-h-[38px] text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
              isMuted
                ? "bg-amber-500/20 border-amber-400/50 text-amber-200"
                : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
            }`}
            title={isMuted ? "Siren & Voice Directives Muted (Click to Enable)" : "Audio Siren & Voice Active (Click to Mute)"}
          >
            <span>{isMuted ? "🔇" : "🔊"}</span>
            <span className="hidden md:inline">{isMuted ? "Muted" : "Audio On"}</span>
          </button>

          {/* Status Report Quick Modal */}
          <button
            onClick={() => setIsStatusReportModalOpen(true)}
            className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 min-h-[38px] text-xs font-bold text-white transition cursor-pointer flex items-center gap-1.5"
            title="View Building Status & Stairwell Report"
          >
            <span>📋</span>
            <span className="hidden lg:inline">Report</span>
          </button>

          {/* Executive One-Pager Quick Modal */}
          <button
            onClick={() => setIsOnePagerOpen(true)}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-[#005DAA] hover:from-sky-500 hover:to-[#004A88] border border-sky-400/40 px-3 py-2 min-h-[38px] text-xs font-black text-white transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Open Shareable Executive One-Pager & Architecture Detail"
          >
            <span>📑</span>
            <span className="hidden lg:inline">One-Pager</span>
          </button>

          {/* Role & Mode Switcher Pill */}
          <div className="flex items-center bg-[#07192C] p-1 rounded-xl border border-[#1E3A60]">
            <button
              onClick={() => {
                if (viewMode === "occupant") {
                  setTargetPinRole("commander");
                  setIsPinModalOpen(true);
                } else {
                  setViewMode("admin");
                }
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === "admin"
                  ? "bg-[#005DAA] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Switch to 5-Step FSD Commander Deck (Protected by 4-digit PIN)"
            >
              <span>🛡️</span>
              <span className="hidden sm:inline">Commander Deck</span>
            </button>
            <button
              onClick={() => setViewMode("occupant")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === "occupant"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Switch to Mobile Occupant Portal (Turnstile Pass & Muster)"
            >
              <span>📱</span>
              <span className="hidden sm:inline">Occupant Portal</span>
            </button>
          </div>

          <div className="h-6 w-[1px] bg-white/20 hidden sm:block" />

          {/* Accounted Counter */}
          <div className="text-right hidden sm:block">
            <div className="text-[9px] uppercase text-[#829AB8] font-bold tracking-widest">Accounted</div>
            <div className="text-sm sm:text-base font-mono font-bold leading-none text-[#38BDF8]">
              {snapshot?.accounted || 0}
              <span className="text-[10px] text-[#829AB8]">/{snapshot?.expectedOnFloor || 195}</span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-white/20" />

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-2.5 py-2 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main View: Either 5-Step Commander Console OR Occupant Mobile Portal */}
      {viewMode === "occupant" ? (
        <div className="flex-1">
          <OccupantPortal
            snapshot={snapshot}
            occupants={occupantsList}
            onCheckIn={handleCheckIn}
            onSwitchToAdmin={() => setViewMode("admin")}
            onLogout={handleLogout}
            onOpenOnePager={() => setIsOnePagerOpen(true)}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* THE 5-STEP PROCESS BAR (Matches image exactly) */}
          <UserFlowStepper
            snapshot={snapshot}
            currentStep={currentStep}
            onSelectStep={(step) => setCurrentStep(step)}
            onOpenScan={() => setCurrentStep(1)}
            onOpenRoster={() => setCurrentStep(2)}
            onOpenAlarm={() => setCurrentStep(3)}
            onOpenBroadcast={() => setCurrentStep(4)}
            onOpenAllSafe={() => setCurrentStep(5)}
          />

          {/* FOCUSED STEP WORKSPACE */}
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {currentStep === 1 && (
              <Step1Scan
                snapshot={snapshot}
                occupants={occupantsList}
                onCheckIn={handleCheckIn}
                onProceedNext={() => setCurrentStep(2)}
                onOpenSelfSignIn={() => setIsSelfSignInOpen(true)}
                onOpenQRPoster={() => setIsSignInPosterOpen(true)}
              />
            )}

            {currentStep === 2 && (
              <Step2SignedIn
                snapshot={snapshot}
                occupants={occupantsList}
                onCheckIn={handleCheckIn}
                onBulkCheckIn={handleBulkCheckIn}
                onRefreshState={refreshState}
                onProceedNext={() => setCurrentStep(3)}
              />
            )}

            {currentStep === 3 && (
              <Step3Alarm
                snapshot={snapshot}
                onDeclareIncident={handleDeclareIncident}
                onClearIncident={handleClearIncident}
                onProceedNext={() => setCurrentStep(4)}
              />
            )}

            {currentStep === 4 && (
              <Step4Broadcast
                snapshot={snapshot}
                onSendAlert={handleSendEmergencyAlert}
                onProceedNext={() => setCurrentStep(5)}
              />
            )}

            {currentStep === 5 && (
              <Step5AllSafe
                snapshot={snapshot}
                occupants={occupantsList}
                onCheckIn={handleCheckIn}
                onBulkCheckIn={handleBulkCheckIn}
                onRefreshState={refreshState}
                onOpenSelfReportPortal={() => setViewMode("occupant")}
              />
            )}
          </main>
        </div>
      )}

      {/* Sleek Status Footer */}
      <footer className="h-9 bg-[#07111E] border-t border-[#1E3A60] px-4 sm:px-6 flex items-center justify-between text-[11px] text-[#829AB8] font-mono shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold tracking-wider">CON ED MESH READY</span>
          </div>
          <span className="hidden sm:inline text-[#1E3A60]">|</span>
          <span className="hidden sm:inline">4 IRVING PLACE · FLOOR 07</span>
        </div>

        <div className="flex items-center gap-3 font-semibold">
          <span className="text-[#38BDF8]">
            STEP {currentStep} OF 5 ACTIVE ·{" "}
            {currentStep === 1
              ? "SCAN"
              : currentStep === 2
              ? "SIGNED IN"
              : currentStep === 3
              ? "ALARM"
              : currentStep === 4
              ? "BROADCAST"
              : "ALL SAFE"}
          </span>
        </div>
      </footer>

      {/* Auxiliary Modals */}
      <EmergencyAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        expectedOnFloor={snapshot?.expectedOnFloor || 195}
        onSendAlert={handleSendEmergencyAlert}
      />

      <BuildingStatusReportModal
        isOpen={isStatusReportModalOpen}
        onClose={() => setIsStatusReportModalOpen(false)}
        snapshot={snapshot}
        onCheckIn={handleCheckIn}
      />

      <DeclareIncidentModal
        isOpen={isDeclareIncidentModalOpen}
        onClose={() => setIsDeclareIncidentModalOpen(false)}
        snapshot={snapshot}
        onDeclareIncident={handleDeclareIncident}
        onClearIncident={handleClearIncident}
      />

      <SignInQRPosterModal
        isOpen={isSignInPosterOpen}
        onClose={() => setIsSignInPosterOpen(false)}
        onOpenSignInForm={() => setIsSelfSignInOpen(true)}
        occupantsCount={snapshot?.occupants?.length || 176}
        inBuildingCount={snapshot?.occupants?.filter((o) => !o.badgedOut && !o.offSiteToday).length || 176}
      />

      <SelfSignInModal
        isOpen={isSelfSignInOpen}
        occupants={snapshot?.occupants || []}
        onClose={() => setIsSelfSignInOpen(false)}
        onSuccess={() => {
          refreshState();
        }}
        onViewOnMap={() => {
          setViewMode("admin");
          setCurrentStep(2);
          refreshState();
        }}
      />

      <NavigationGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        onSelectViewMode={(mode) => setViewMode(mode)}
        onSelectStep={(step) => {
          setCurrentStep(step);
          setViewMode("admin");
        }}
        currentStep={currentStep}
        currentMode={viewMode}
      />

      <ExecutiveOnePagerModal
        isOpen={isOnePagerOpen}
        onClose={() => setIsOnePagerOpen(false)}
        snapshot={snapshot}
      />

      <PinModal
        isOpen={isPinModalOpen}
        targetRole={targetPinRole}
        onSuccess={() => {
          setIsPinModalOpen(false);
          setViewMode("admin");
        }}
        onCancel={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
