import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Occupant, OccupantStatus, StatusSnapshot, QuadrantId } from "../types";
import { QRCameraScanner } from "./QRCameraScanner";
import { DigitalSignaturePad } from "./DigitalSignaturePad";
import { getDeviceGeolocation, validateGeofence, FLOOR_07_CONSTRAINTS } from "../lib/geofence";

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
      return localStorage.getItem("muster_registered_occupant_id");
    } catch {
      return null;
    }
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
        }
      }
      const stored = localStorage.getItem("muster_registered_occupant_id");
      if (stored && occupants.some((o) => o.id === stored)) return stored;
    } catch {}
    return savedOccupantId || occupants.find((o) => o.role === "Visitor")?.id || occupants[0]?.id || "OCC-101";
  });

  const currentUser = occupants.find((o) => o.id === selectedUserId) || occupants[0];

  // Screen state:
  // If returning user (savedOccupantId or recognized URL param exists in roster), show 'confirmed' pass screen.
  // If newcomer / unregistered, show 'newcomer-signin' form.
  const [viewState, setViewState] = useState<"newcomer-signin" | "confirmed">(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("id") || params.get("badge") || params.get("user") || params.get("occupantId");
        if (urlId && occupants.some((o) => o.id.toLowerCase() === urlId.toLowerCase())) {
          return "confirmed";
        }
        if (params.get("new") === "1" || params.get("register") === "1") {
          return "newcomer-signin";
        }
      }
      const stored = localStorage.getItem("muster_registered_occupant_id");
      if (stored && occupants.some((o) => o.id === stored)) {
        return "confirmed";
      }
    } catch {}
    return "newcomer-signin";
  });

  // User type: Employee vs Visitor
  const [userType, setUserType] = useState<"employee" | "visitor">("employee");

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

  // Direct Sign-In for recognized user in database
  const handleDirectSignInExisting = async (existingUser: Occupant) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/occupant/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupantId: existingUser.id,
          action: signAction === "leave" ? "leave" : "enter",
        }),
      });
      if (res.ok) {
        setSelectedUserId(existingUser.id);
        setSavedOccupantId(existingUser.id);
        try {
          localStorage.setItem("muster_registered_occupant_id", existingUser.id);
          localStorage.setItem("muster_registered_name", existingUser.name);
          if (existingUser.phone) localStorage.setItem("muster_registered_phone", existingUser.phone);
        } catch (e) {}
        setViewState("confirmed");
        setActionSubmittedMsg(
          `⚡ Direct Sign-In Verified! Welcome back ${existingUser.name} (${existingUser.id}). You are recorded as PRESENT & ACCOUNTED on Floor 07.`
        );
        setTimeout(() => setActionSubmittedMsg(null), 8000);
      } else {
        setErrorMessage("Could not complete direct sign in.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error performing direct sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check URL query param for QR token, badge ID, or name on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const urlId = params.get("id") || params.get("badge") || params.get("user") || params.get("occupantId");
      const urlPhone = params.get("phone");
      const urlName = params.get("name");

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
    } catch {}
  }, [occupants]);

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

  // Sample Autofill helpers
  const handleAutofillEmployee = () => {
    setUserType("employee");
    setSignName("Sarah Jenkins");
    setSignPhone("(212) 555-0144");
    setSignCompany("Con Edison");
    setSignRole("Employee");
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

  // Generate QR code for current user
  useEffect(() => {
    if (currentUser) {
      const payload = `CONED-BADGE-${currentUser.id}-${currentUser.quadrant}`;
      QRCode.toDataURL(payload, {
        width: 280,
        margin: 1.5,
        color: { dark: "#003B70", light: "#FFFFFF" },
      })
        .then(setOccupantQrUrl)
        .catch(console.error);
    }
  }, [currentUser]);

  // AUTOMATIC ACCOUNTING ON QR CODE SCAN / LOAD FOR RETURNING OCCUPANTS
  useEffect(() => {
    if (savedOccupantId && currentUser && viewState === "confirmed") {
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
  }, [savedOccupantId, currentUser?.id]);

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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.occupant) {
        setSelectedUserId(data.occupant.id);
        setSavedOccupantId(data.occupant.id);
        try {
          localStorage.setItem("muster_registered_occupant_id", data.occupant.id);
          localStorage.setItem("muster_registered_phone", signPhone.trim());
          localStorage.setItem("muster_registered_name", signName.trim());
        } catch (e) {
          console.warn("Storage write error", e);
        }

        setViewState("confirmed");
        setActionSubmittedMsg(
          `🎉 Registered & Accounted! Assigned ${data.occupant.id} for ${data.occupant.name}. Digital signature recorded and Floor 07 roster updated!`
        );
        setTimeout(() => setActionSubmittedMsg(null), 7000);
      } else {
        setErrorMessage(data.error || "Could not complete sign in. Please try again.");
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
      const res = await fetch("/api/occupant/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupantId: currentUser.id, action }),
      });
      if (res.ok) {
        setActionSubmittedMsg(
          action === "leave"
            ? `🚪 Badged Out: ${currentUser.name} marked as LEFT BUILDING (Off-Site). Roster updated.`
            : `🏢 Badged In: ${currentUser.name} verified as IN BUILDING (Floor 07). Roster updated.`
        );
        setTimeout(() => setActionSubmittedMsg(null), 5000);
      }
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

    let station = "Assembly Point A (Park Plaza)";
    let loc: "inside-building" | "outside-assembly" = "outside-assembly";

    if (decoded.includes("AssemblyPointB") || decoded.includes("assembly-b") || decoded.toLowerCase().includes("courtyard")) {
      station = "Assembly Point B (Courtyard)";
    } else if (decoded.includes("Floor07Kiosk") || decoded.includes("kiosk") || decoded.toLowerCase().includes("inside")) {
      loc = "inside-building";
      station = "Floor 07 Main Entrance";
    }

    onCheckIn(
      currentUser.id,
      "safe",
      "qr-station-scan",
      `Scanned station QR code: ${station}`,
      loc,
      loc === "outside-assembly" ? station : undefined
    );

    setActionSubmittedMsg(`✅ Scanned QR Code! Verified at ${station}.`);
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
        `🛰️ Geo-Fence Verified: ${
          geoResult.locationCategory === "outside-assembly"
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

  const handleRequestEvacChair = () => {
    if (!currentUser) return;
    onCheckIn(
      currentUser.id,
      "awaiting-evac-chair",
      "mobile-occupant-app",
      helpNote || "Evacuation chair required at stairwell landing",
      "inside-building"
    );
    setActionSubmittedMsg(`🛞 Assistance Request Sent! Wardens notified to dispatch ARA Evacuation Chair.`);
    setTimeout(() => setActionSubmittedMsg(null), 5000);
  };

  const handleRequestHelp = () => {
    if (!currentUser) return;
    onCheckIn(
      currentUser.id,
      "need-help",
      "mobile-occupant-app",
      helpNote || "Immediate assistance requested",
      "inside-building"
    );
    setActionSubmittedMsg(`🚨 Emergency Help Flagged! FSD Command Center alerted.`);
    setTimeout(() => setActionSubmittedMsg(null), 5000);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5 text-[#0F2537] animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-[#EBF5FB] border border-[#B8D8F8] p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">📱</span>
          <div>
            <span className="font-black text-[#005DAA] text-sm">Floor 07 Digital QR Attendance</span>
            <p className="text-[11px] text-[#475569] font-medium">
              Con Edison · 4 Irving Place · QR Presence & Muster
            </p>
          </div>
        </div>

        {(onSwitchToAdmin || onLogout) && (
          <button
            type="button"
            onClick={onSwitchToAdmin || onLogout}
            className="bg-[#003B70] hover:bg-[#005DAA] text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
          >
            <span>🛡️</span>
            <span>Commander Deck</span>
          </button>
        )}
      </div>

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
        <div className="space-y-4 animate-fadeIn">
          {/* Prominent Welcome Back & Sign-In Confirmation Card */}
          <div className={`bg-white border-2 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 ${
            currentUser.role === "Visitor" ? "border-amber-500" : "border-[#005DAA]"
          }`}>
            <div className="flex items-start justify-between gap-3 border-b border-[#B8D8F8] pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-400 text-emerald-900 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>SIGNED IN & ACCOUNTED FOR</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    currentUser.role === "Visitor"
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

              <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0 ${
                currentUser.role === "Visitor"
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
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase border ${
                  currentUser.badgedOut
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
                  className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    !currentUser.badgedOut
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
                  className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    currentUser.badgedOut
                      ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-500"
                      : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  <span>🚪</span>
                  <span>Left Building</span>
                </button>
              </div>
            </div>

            {/* Scannable Personal QR Code Badge */}
            <div className={`p-4 rounded-2xl border text-center space-y-3 ${
              currentUser.role === "Visitor"
                ? "bg-amber-50/70 border-amber-300"
                : "bg-[#F8FAFC] border-[#B8D8F8]"
            }`}>
              <div className="text-[10px] font-black uppercase text-[#005DAA] tracking-wider">
                {currentUser.role === "Visitor" ? "🎟️ Official Guest / Visitor Turnstile Pass" : "🏢 Official Employee Turnstile Pass"}
              </div>

              <div className={`w-44 h-44 mx-auto bg-white border-2 p-2.5 rounded-2xl flex items-center justify-center shadow-inner ${
                currentUser.role === "Visitor" ? "border-amber-500" : "border-[#005DAA]"
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
                  onClick={() => setViewState("newcomer-signin")}
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

            {/* Emergency Muster Reporting Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-1.5">
                  <span>📍</span> Emergency Safety &amp; Evacuation Transmit
                </h4>
                <button
                  type="button"
                  onClick={handleGeoFenceAutoDetect}
                  disabled={isDetectingGeo}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
                >
                  <span>🛰️</span>
                  <span>{isDetectingGeo ? "Scanning..." : "GPS Geo-Fence Check"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Safe Outside */}
                <div className="p-3 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] space-y-2">
                  <div className="text-xs font-bold text-[#0F2537]">1. Outside at Assembly Point</div>
                  <select
                    value={selectedAssembly}
                    onChange={(e) => setSelectedAssembly(e.target.value)}
                    className="w-full bg-white border border-[#B8D8F8] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0F2537] focus:outline-none"
                  >
                    <option value="Assembly Point A (Park Plaza)">Assembly Point A (Park Plaza - East 14th St)</option>
                    <option value="Assembly Point B (Courtyard)">Assembly Point B (East Courtyard - Irving Pl)</option>
                  </select>
                  <button
                    onClick={handleMarkSafeOutside}
                    className="w-full py-2 bg-emerald-700 text-white font-bold text-xs rounded-lg hover:bg-emerald-800 transition cursor-pointer shadow-xs"
                  >
                    ✓ Safe Outside
                  </button>
                </div>

                {/* Safe Inside */}
                <div className="p-3 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] space-y-2">
                  <div className="text-xs font-bold text-[#0F2537]">2. Still Inside Floor 07</div>
                  <select
                    value={selectedQuadrant}
                    onChange={(e) => setSelectedQuadrant(e.target.value)}
                    className="w-full bg-white border border-[#B8D8F8] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0F2537] focus:outline-none"
                  >
                    <option value="NW">NW (800 Strategic Planning)</option>
                    <option value="NE">NE (500 Corp Security / Gas Ops)</option>
                    <option value="SW">SW (700 AMI / Steam West)</option>
                    <option value="SE">SE (M Operations / Turnstiles)</option>
                    <option value="Stairwell A">Stairwell A (West Landing)</option>
                    <option value="Stairwell B">Stairwell B (East Landing)</option>
                  </select>
                  <button
                    onClick={handleMarkSafeInside}
                    className="w-full py-2 bg-[#005DAA] text-white font-bold text-xs rounded-lg hover:bg-[#004A88] transition cursor-pointer shadow-xs"
                  >
                    ✓ Safe Inside
                  </button>
                </div>
              </div>

              {/* Assistance Request */}
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2">
                <div className="text-xs font-bold text-red-900">3. Assistance Required</div>
                <input
                  type="text"
                  value={helpNote}
                  onChange={(e) => setHelpNote(e.target.value)}
                  placeholder="Optional note: e.g. Mobility limited, stuck at Stairwell A..."
                  className="w-full bg-white border border-red-200 rounded-lg p-2 text-xs text-[#0F2537] placeholder-[#64748B] focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleRequestEvacChair}
                    className="flex-1 py-2 bg-amber-600 text-white font-bold text-xs rounded-lg hover:bg-amber-700 transition cursor-pointer"
                  >
                    🛞 Request Evac Chair
                  </button>
                  <button
                    onClick={handleRequestHelp}
                    className="flex-1 py-2 bg-red-700 text-white font-bold text-xs rounded-lg hover:bg-red-800 transition cursor-pointer"
                  >
                    🚨 Need Help
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FLOW 2: SIGN-IN FORMAT (EMPLOYEE OR VISITOR)              */}
      {/* ========================================================= */}
      {viewState === "newcomer-signin" && (
        <div className="bg-white border-2 border-[#005DAA] rounded-2xl p-5 sm:p-7 shadow-md space-y-5 animate-fadeIn">
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
              Choose your profile type below, provide your digital signature to confirm legal floor presence, and be automatically accounted for.
            </p>
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
            <span className="font-bold text-[#005DAA]">⚡ Quick Fill Demo:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutofillEmployee}
                className="px-2.5 py-1 bg-white hover:bg-[#EBF5FB] border border-[#B8D8F8] text-[#005DAA] rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                🏢 Fill Employee (Sarah Jenkins)
              </button>
              <button
                type="button"
                onClick={handleAutofillVisitor}
                className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                🎟️ Fill Visitor (Alex Rivera)
              </button>
            </div>
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
                  className={`p-3 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${
                    signAction === "enter"
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
                  className={`p-3 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${
                    signAction === "leave"
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
                  className={`p-3 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${
                    signAction === "muster"
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
                  <option value="NW">NW · 800 Strategic Planning</option>
                  <option value="NE">NE · 500 Corp Security / Gas Ops</option>
                  <option value="SW">SW · 700 AMI / Steam West</option>
                  <option value="SE">SE · M Operations / Steam Ops (07-550)</option>
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
                } catch {}
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
