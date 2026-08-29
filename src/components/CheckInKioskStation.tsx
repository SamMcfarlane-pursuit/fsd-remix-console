import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Occupant, QuadrantId } from "../types";
import { QRCameraScanner } from "./QRCameraScanner";
import { QRBadgeGenerator } from "./QRBadgeGenerator";
import { generateOccupantBadgePayload, parseQRData, getMobileNetworkOrigin } from "../lib/qr";

interface CheckInKioskStationProps {
  occupants: Occupant[];
  onCheckInSuccess: () => void;
}

export const CheckInKioskStation: React.FC<CheckInKioskStationProps> = ({
  occupants,
  onCheckInSuccess,
}) => {
  const [kioskTab, setKioskTab] = useState<"self-signin" | "scan" | "generator" | "visitor" | "badges">("self-signin");

  // Scanner state
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [useLiveCamera, setUseLiveCamera] = useState(true);
  const [scanAction, setScanAction] = useState<"enter" | "leave" | "muster">("enter");
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
    occupant?: Occupant;
    presence?: "IN_BUILDING" | "LEFT_BUILDING";
    timestamp: string;
  } | null>(null);

  // Self-Service Sign-In state (Name, Phone # -> Generate Occ # & Detect Presence)
  const [signName, setSignName] = useState("");
  const [signPhone, setSignPhone] = useState("");
  const [signQuad, setSignQuad] = useState<QuadrantId>("NW");
  const [signRole, setSignRole] = useState<string>("Employee");
  const [signCompany, setSignCompany] = useState("");
  const [signAction, setSignAction] = useState<"enter" | "leave">("enter");
  const [isSubmittingSignIn, setIsSubmittingSignIn] = useState(false);
  const [registeredOccupant, setRegisteredOccupant] = useState<Occupant | null>(null);
  const [registeredQrUrl, setRegisteredQrUrl] = useState<string>("");
  const [mobileSignInQrUrl, setMobileSignInQrUrl] = useState<string>("");

  // Generate mobile sign-in QR code on load
  useEffect(() => {
    const origin = getMobileNetworkOrigin();
    const signInUrl = `${origin}/?mode=signin`;
    QRCode.toDataURL(signInUrl, {
      width: 220,
      margin: 1.5,
      color: { dark: "#003B70", light: "#FFFFFF" },
    })
      .then(setMobileSignInQrUrl)
      .catch(console.error);
  }, []);

  // Visitor Registration state
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [visitorHost, setVisitorHost] = useState("");
  const [visitorQuad, setVisitorQuad] = useState<QuadrantId>("SE");
  const [visitorNotes, setVisitorNotes] = useState("");
  const [isRegisteringVisitor, setIsRegisteringVisitor] = useState(false);
  const [createdVisitor, setCreatedVisitor] = useState<Occupant | null>(null);

  // Selected Badge View modal
  const [selectedBadgeOccupant, setSelectedBadgeOccupant] = useState<Occupant | null>(null);
  const [selectedBadgeQrUrl, setSelectedBadgeQrUrl] = useState<string>("");
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState<"ALL" | "IN_BUILDING" | "LEFT_BUILDING" | "VISITOR">("ALL");

  // In Building vs Left Building counts
  const inBuildingCount = occupants.filter((o) => !o.badgedOut && !o.offSiteToday).length;
  const leftBuildingCount = occupants.filter((o) => o.badgedOut || o.offSiteToday).length;

  // Filter badges
  const filteredBadges = occupants.filter((occ) => {
    if (badgeCategoryFilter === "IN_BUILDING") return !occ.badgedOut && !occ.offSiteToday;
    if (badgeCategoryFilter === "LEFT_BUILDING") return occ.badgedOut || occ.offSiteToday;
    if (badgeCategoryFilter === "VISITOR") return occ.role === "Visitor";
    return true;
  });

  // Auto-clear notification after 6 seconds
  useEffect(() => {
    if (lastScanResult) {
      const timer = setTimeout(() => {
        setLastScanResult(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [lastScanResult]);

  // Generate QR code data URL when selected badge changes
  useEffect(() => {
    if (selectedBadgeOccupant) {
      const payload = generateOccupantBadgePayload(selectedBadgeOccupant.id, selectedBadgeOccupant.quadrant);
      QRCode.toDataURL(payload, {
        width: 240,
        margin: 1.5,
        color: { dark: "#003B70", light: "#FFFFFF" },
      })
        .then(setSelectedBadgeQrUrl)
        .catch(console.error);
    }
  }, [selectedBadgeOccupant]);

  // Generate QR code data URL for newly registered occupant
  useEffect(() => {
    if (registeredOccupant) {
      const payload = generateOccupantBadgePayload(registeredOccupant.id, registeredOccupant.quadrant);
      QRCode.toDataURL(payload, {
        width: 260,
        margin: 1.5,
        color: { dark: "#003B70", light: "#FFFFFF" },
      })
        .then(setRegisteredQrUrl)
        .catch(console.error);
    }
  }, [registeredOccupant]);

  // Execute QR / Badge Scan check-in or badge-out
  const handleScanSubmit = async (codeToScan?: string, action: "enter" | "leave" | "muster" = scanAction) => {
    const raw = codeToScan || scanInput;
    if (!raw.trim()) return;

    const parsed = parseQRData(raw);
    const cleanCode = parsed.occupantId || parsed.phone || parsed.name || raw.trim();

    setScanning(true);
    try {
      const res = await fetch("/api/kiosk/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, action, status: "safe" }),
      });

      const data = await res.json();
      if (res.ok && data.occupant) {
        setLastScanResult({
          success: true,
          message: data.message || `Recorded presence for ${data.occupant.name} (${data.occupant.id})`,
          occupant: data.occupant,
          presence: data.presence || (action === "leave" ? "LEFT_BUILDING" : "IN_BUILDING"),
          timestamp: new Date().toLocaleTimeString(),
        });
        setScanInput("");
        onCheckInSuccess();
      } else {
        setLastScanResult({
          success: false,
          message: data.error || `Unrecognized QR Badge or Phone: "${cleanCode}". Please use Self Sign-In tab.`,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      // Offline fallback
      const matched = occupants.find(
        (o) =>
          o.id.toUpperCase() === cleanCode.toUpperCase() ||
          o.name.toLowerCase().includes(cleanCode.toLowerCase())
      );
      if (matched) {
        setLastScanResult({
          success: true,
          message: `Presence updated for ${matched.name} (${matched.id}) [Offline Cache Mode]`,
          occupant: matched,
          presence: action === "leave" ? "LEFT_BUILDING" : "IN_BUILDING",
          timestamp: new Date().toLocaleTimeString(),
        });
        setScanInput("");
        onCheckInSuccess();
      } else {
        setLastScanResult({
          success: false,
          message: `Badge "${cleanCode}" not found on roster.`,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } finally {
      setScanning(false);
    }
  };

  // Toggle Single Occupant Presence (Enter vs Leave)
  const handleTogglePresence = async (occupantId: string, action: "enter" | "leave" | "toggle") => {
    try {
      const res = await fetch("/api/occupant/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupantId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastScanResult({
          success: true,
          message: data.presence === "LEFT_BUILDING"
            ? `Badged Out: ${data.occupant.name} (${data.occupant.id}) marked as LEFT BUILDING.`
            : `Badged In: ${data.occupant.name} (${data.occupant.id}) detected as IN BUILDING.`,
          occupant: data.occupant,
          presence: data.presence,
          timestamp: new Date().toLocaleTimeString(),
        });
        onCheckInSuccess();
      }
    } catch (err) {
      console.warn("Toggle presence deferred:", err);
    }
  };

  // Self-Service Sign-In with Name & Phone -> Generates/Assigns OCC # & Presence Detection
  const handleSelfSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signName.trim()) return;

    setIsSubmittingSignIn(true);
    try {
      const res = await fetch("/api/occupant/sign-in-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signName.trim(),
          phone: signPhone.trim(),
          action: signAction,
          quadrant: signQuad,
          role: signRole,
          company: signCompany.trim() || "Con Edison",
        }),
      });

      const data = await res.json();
      if (res.ok && data.occupant) {
        setRegisteredOccupant(data.occupant);
        setLastScanResult({
          success: true,
          message: data.message,
          occupant: data.occupant,
          presence: data.presence,
          timestamp: new Date().toLocaleTimeString(),
        });
        onCheckInSuccess();
      } else {
        setLastScanResult({
          success: false,
          message: data.error || "Could not complete sign-in.",
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err) {
      console.warn("Self sign-in deferred:", err);
    } finally {
      setIsSubmittingSignIn(false);
    }
  };

  // Register Daily Visitor
  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) return;

    setIsRegisteringVisitor(true);
    try {
      const res = await fetch("/api/visitor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: visitorName.trim(),
          phone: visitorPhone.trim(),
          company: visitorCompany.trim() || "Guest Visitor",
          hostEmployee: visitorHost.trim() || "Floor 7 Reception",
          quadrant: visitorQuad,
          notes: visitorNotes.trim(),
          immediateCheckIn: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.visitor) {
        setCreatedVisitor(data.visitor);
        setLastScanResult({
          success: true,
          message: `Visitor Pass Issued & Detected IN BUILDING: ${data.visitor.name} (${data.visitor.id})`,
          occupant: data.visitor,
          presence: "IN_BUILDING",
          timestamp: new Date().toLocaleTimeString(),
        });
        setVisitorName("");
        setVisitorPhone("");
        setVisitorCompany("");
        setVisitorHost("");
        setVisitorNotes("");
        onCheckInSuccess();
      }
    } catch (err) {
      console.warn("Visitor registration fallback:", err);
    } finally {
      setIsRegisteringVisitor(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Live Building Presence Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border-2 border-emerald-500 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-emerald-800">
                CURRENTLY IN BUILDING
              </div>
              <div className="text-xl font-mono font-black text-emerald-950">
                {inBuildingCount} <span className="text-xs font-normal text-emerald-700">PERSONNEL</span>
              </div>
            </div>
          </div>
          <span className="text-2xl">🏢</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-300 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-slate-600">
                BADGED OUT / LEFT BUILDING
              </div>
              <div className="text-xl font-mono font-black text-slate-800">
                {leftBuildingCount} <span className="text-xs font-normal text-slate-500">OFF-SITE</span>
              </div>
            </div>
          </div>
          <span className="text-2xl">🚪</span>
        </div>

        <div className="bg-[#003B70] text-white p-3.5 rounded-2xl border border-[#005DAA] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-black tracking-wider text-sky-300">
              TOTAL REGISTERED ROSTER
            </div>
            <div className="text-xl font-mono font-black text-white">
              {occupants.length} <span className="text-xs font-normal text-sky-200">TOTAL OCCUPANTS</span>
            </div>
          </div>
          <span className="text-2xl">📋</span>
        </div>
      </div>

      {/* Kiosk Header & Sub-Navigation */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#B8D8F8] shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-[#0F2537] flex items-center gap-2">
            <span>📟</span>
            <span>QR Code Sign-In & Building Presence Station</span>
            <span className="text-[10px] font-mono font-bold bg-[#EBF5FB] text-[#005DAA] px-2 py-0.5 rounded border border-[#B8D8F8]">
              TURNSTILE #07
            </span>
          </h2>
          <p className="text-xs text-[#475569] mt-0.5 font-medium">
            Sign in with your Name and Phone # to receive your unique OCC # pass and record when entering or leaving the building.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F0F6FC] p-1 rounded-xl border border-[#B8D8F8] w-full lg:w-auto">
          <button
            onClick={() => setKioskTab("self-signin")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              kioskTab === "self-signin"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA]"
            }`}
          >
            <span>📝</span>
            <span>Sign In / Issue OCC #</span>
          </button>
          <button
            onClick={() => setKioskTab("scan")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              kioskTab === "scan"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA]"
            }`}
          >
            <span>📷</span>
            <span>QR Scanner</span>
          </button>
          <button
            onClick={() => setKioskTab("generator")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              kioskTab === "generator"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA]"
            }`}
          >
            <span>🔲</span>
            <span>Generate Posters</span>
          </button>
          <button
            onClick={() => setKioskTab("visitor")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              kioskTab === "visitor"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA]"
            }`}
          >
            <span>👤</span>
            <span>Visitor Pass</span>
          </button>
          <button
            onClick={() => setKioskTab("badges")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              kioskTab === "badges"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA]"
            }`}
          >
            <span>🏷️</span>
            <span>Directory ({occupants.length})</span>
          </button>
        </div>
      </div>

      {/* Live Check-in Result Notification Alert */}
      {lastScanResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-lg animate-bounce-once ${
            lastScanResult.success
              ? lastScanResult.presence === "LEFT_BUILDING"
                ? "bg-[#78350F] border-[#F59E0B] text-amber-100"
                : "bg-[#064E3B] border-[#10B981] text-emerald-100"
              : "bg-[#7C1E16] border-[#EF4444] text-red-100"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{lastScanResult.success ? (lastScanResult.presence === "LEFT_BUILDING" ? "🚪" : "🏢") : "⚠️"}</span>
            <div>
              <div className="text-sm font-black uppercase tracking-wider">
                {lastScanResult.success
                  ? lastScanResult.presence === "LEFT_BUILDING"
                    ? "BADGED OUT · LEFT BUILDING CONFIRMED"
                    : "BADGED IN · IN BUILDING CONFIRMED"
                  : "SCAN / SIGN-IN ERROR"}
              </div>
              <div className="text-xs mt-0.5 font-medium">{lastScanResult.message}</div>
              {lastScanResult.occupant && (
                <div className="mt-2 text-[11px] font-mono bg-black/40 px-2.5 py-1 rounded-md inline-block border border-white/20">
                  OCC #: <strong className="text-yellow-300">{lastScanResult.occupant.id}</strong> · NAME: {lastScanResult.occupant.name} · PHONE: {lastScanResult.occupant.phone || "N/A"} · QUADRANT: {lastScanResult.occupant.quadrant}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setLastScanResult(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 px-2 py-1 rounded bg-black/30 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 0: SELF-SERVICE SIGN IN (NAME + PHONE # -> OCC # + PRESENCE) */}
      {kioskTab === "self-signin" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sign-In Input Form */}
          <div className="lg:col-span-6 bg-white rounded-2xl border-2 border-[#005DAA] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="border-b border-[#B8D8F8] pb-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-[#0F2537] flex items-center gap-2">
                <span>📝</span>
                <span>Enter Name & Number for Instant QR Sign-In</span>
              </h3>
              <p className="text-xs text-[#475569] mt-0.5">
                Register or update your attendance. The system assigns your official <strong>OCC #</strong> and logs your presence inside or exiting the building.
              </p>
            </div>

            <form onSubmit={handleSelfSignIn} className="space-y-4">
              {/* Presence Intent Selection */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1.5">
                  Are you Entering or Leaving the building?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignAction("enter")}
                    className={`py-3 px-3 rounded-xl border-2 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                      signAction === "enter"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-lg">🏢</span>
                    <span>ENTER BUILDING (IN FLOOR 07)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignAction("leave")}
                    className={`py-3 px-3 rounded-xl border-2 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                      signAction === "leave"
                        ? "border-amber-600 bg-amber-50 text-amber-950 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-lg">🚪</span>
                    <span>LEAVE BUILDING (BADGED OUT)</span>
                  </button>
                </div>
              </div>

              {/* Full Name & Phone Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder="e.g. Samuel McFarlane"
                    className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] font-semibold focus:border-[#005DAA] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={signPhone}
                    onChange={(e) => setSignPhone(e.target.value)}
                    placeholder="e.g. (212) 555-0199"
                    className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] font-mono font-semibold focus:border-[#005DAA] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Floor Quadrant & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                    Assigned Quadrant
                  </label>
                  <select
                    value={signQuad}
                    onChange={(e) => setSignQuad(e.target.value as QuadrantId)}
                    className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3 py-2 text-xs font-bold text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
                  >
                    <option value="NW">NW · Engineering</option>
                    <option value="NE">NE · Comms/Gov Affairs</option>
                    <option value="SW">SW · Legal</option>
                    <option value="SE">SE · IT / Operations</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                    Role
                  </label>
                  <select
                    value={signRole}
                    onChange={(e) => setSignRole(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3 py-2 text-xs font-bold text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Contractor">Contractor</option>
                    <option value="Visitor">Visitor</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSignIn || !signName.trim() || !signPhone.trim()}
                className={`w-full py-3 rounded-xl text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                  signAction === "leave"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                } disabled:opacity-50`}
              >
                <span>{signAction === "leave" ? "🚪" : "📲"}</span>
                <span>
                  {isSubmittingSignIn
                    ? "PROCESSING SIGN-IN..."
                    : signAction === "leave"
                    ? "SIGN OUT & MARK AS LEFT BUILDING"
                    : "SIGN IN, ISSUE OCC # & DETECT IN BUILDING"}
                </span>
              </button>
            </form>
          </div>

          {/* Issued OCC # & Personal QR Badge Display */}
          <div className="lg:col-span-6 space-y-4">
            {registeredOccupant ? (
              <div className="bg-white p-6 rounded-2xl border-2 border-emerald-600 shadow-md text-center space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                    ✅ SIGN-IN COMPLETE · OFFICIAL PASS ISSUED
                  </span>
                  <span className="text-xs font-mono font-black bg-emerald-700 text-white px-2.5 py-1 rounded-md">
                    {registeredOccupant.id}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xl font-black text-[#0F2537]">{registeredOccupant.name}</div>
                  <div className="text-xs font-mono text-[#005DAA] font-bold">
                    PHONE: {registeredOccupant.phone || "N/A"} · {registeredOccupant.role}
                  </div>
                  <div className="text-xs font-bold text-emerald-700">
                    PRESENCE: {registeredOccupant.badgedOut ? "⚪ LEFT BUILDING" : "🟢 IN BUILDING (Floor 07)"}
                  </div>
                </div>

                {/* Scannable Generated QR Code */}
                <div className="w-48 h-48 bg-[#F8FAFC] mx-auto p-3 rounded-2xl border-2 border-emerald-600 flex items-center justify-center shadow-inner">
                  {registeredQrUrl ? (
                    <img
                      src={registeredQrUrl}
                      alt={`QR Code for ${registeredOccupant.name}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-slate-400 font-mono">Generating QR...</div>
                  )}
                </div>

                <div className="text-[11px] font-mono font-black text-[#003B70] uppercase">
                  PASS CODE: {registeredOccupant.id}-{registeredOccupant.quadrant}
                </div>

                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => handleTogglePresence(registeredOccupant.id, "toggle")}
                    className="px-4 py-2 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                  >
                    {registeredOccupant.badgedOut ? "🟢 Mark As In Building" : "⚪ Mark As Left Building"}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-white border border-[#B8D8F8] text-[#005DAA] rounded-xl text-xs font-bold hover:bg-[#F0F6FC] transition cursor-pointer"
                  >
                    🖨️ Print Pass
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-[#005DAA] shadow-sm text-center space-y-4">
                <div className="border-b border-[#B8D8F8] pb-3">
                  <div className="text-xs font-mono font-bold uppercase text-[#005DAA]">
                    📱 MOBILE PHONE SCAN-TO-SIGN-IN
                  </div>
                  <div className="text-sm sm:text-base font-black text-[#0F2537] mt-0.5">
                    Scan with Your Phone Camera
                  </div>
                  <p className="text-xs text-[#475569] mt-0.5">
                    Point your camera at this QR code to sign in on your mobile phone, enter your Name & Phone, and get your OCC #.
                  </p>
                </div>

                {/* Scannable Mobile Sign-In QR */}
                <div className="w-48 h-48 sm:w-52 sm:h-52 bg-[#F8FAFC] mx-auto p-3 rounded-2xl border-2 border-[#005DAA] flex items-center justify-center shadow-inner">
                  {mobileSignInQrUrl ? (
                    <img
                      src={mobileSignInQrUrl}
                      alt="Scan to Sign In on Phone"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-slate-400 font-mono">Generating QR...</div>
                  )}
                </div>

                <div className="p-3 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] text-left text-xs space-y-1.5">
                  <div className="font-bold text-[#005DAA] flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Self-Service QR Sign-In Capabilities:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[#475569] text-[11px]">
                    <li>Gathers Name, Mobile Number, and Department Zone.</li>
                    <li>Auto-allocates official <strong>OCC #</strong> pass.</li>
                    <li>Detects building presence (Entering vs Leaving).</li>
                    <li>Instant live allocation on 4 Irving Place CAD map.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: LIVE QR SCANNER */}
      {kioskTab === "scan" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Live Camera Scanner Box */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#005DAA]">
                Optical Camera & Sensor Reader
              </span>
              <button
                onClick={() => setUseLiveCamera(!useLiveCamera)}
                className="text-xs font-bold text-[#005DAA] hover:underline cursor-pointer"
              >
                {useLiveCamera ? "Switch to Manual Mode" : "Switch to Live Camera"}
              </button>
            </div>

            {useLiveCamera ? (
              <QRCameraScanner
                onScanSuccess={(decoded, action) => handleScanSubmit(decoded, action)}
                stationName="Turnstile #07-Main"
                defaultAction={scanAction}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-[#B8D8F8] p-5 shadow-sm space-y-4">
                <div className="text-center py-4 space-y-2">
                  <span className="text-3xl">⌨️</span>
                  <div className="text-sm font-black text-[#0F2537]">Manual Badge, Phone #, or Name Input</div>
                  <p className="text-xs text-[#475569] max-w-sm mx-auto">
                    Type or paste any badge ID (e.g. OCC-101, VIS-801, or phone number) to sign in or out.
                  </p>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setScanAction("enter")}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase ${
                      scanAction === "enter" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    🟢 In Building
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanAction("leave")}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase ${
                      scanAction === "leave" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ⚪ Leave Building
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScanSubmit()}
                    placeholder="Enter Badge ID, Phone #, or Name..."
                    className="flex-1 min-h-[44px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-4 py-2 text-sm text-[#0F2537] font-mono focus:outline-none focus:border-[#005DAA]"
                  />
                  <button
                    onClick={() => handleScanSubmit()}
                    disabled={scanning || !scanInput.trim()}
                    className="px-5 rounded-xl bg-[#005DAA] text-white font-black text-xs uppercase hover:bg-[#004A88] cursor-pointer"
                  >
                    SUBMIT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick One-Tap Presence Tester Deck */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#B8D8F8] p-4 sm:p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F2537] flex items-center gap-1.5">
                <span>⚡</span>
                <span>Roster Presence Quick-Toggle Deck</span>
              </h3>
              <span className="text-[10px] font-extrabold text-[#005DAA] bg-[#EBF5FB] px-2 py-0.5 rounded">
                1-TAP ACTION
              </span>
            </div>

            <p className="text-xs text-[#475569] font-medium">
              Click In or Out to immediately update presence and capture attendance for any occupant:
            </p>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {occupants.slice(0, 12).map((occ) => (
                <div
                  key={occ.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] hover:border-[#005DAA] hover:bg-white transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-[#0F2537] truncate flex items-center gap-1.5">
                      <span>{occ.name}</span>
                      <span className="text-[10px] font-mono text-[#005DAA] bg-[#005DAA]/10 px-1.5 py-0.2 rounded font-bold">
                        {occ.id}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#475569] mt-0.5 font-medium">
                      {occ.phone || "(212) 555-0100"} · Quad {occ.quadrant} · Presence:{" "}
                      <span className={occ.badgedOut ? "text-slate-600 font-bold" : "text-emerald-700 font-bold"}>
                        {occ.badgedOut ? "⚪ Left Building" : "🟢 In Building"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePresence(occ.id, occ.badgedOut ? "enter" : "leave")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer shadow-2xs ${
                        occ.badgedOut
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-amber-600 hover:bg-amber-700 text-white"
                      }`}
                    >
                      {occ.badgedOut ? "BADGE IN 🟢" : "BADGE OUT ⚪"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QR CODE GENERATOR SUITE */}
      {kioskTab === "generator" && (
        <QRBadgeGenerator
          occupants={occupants}
          onSelectOccupantForScan={(id) => handleScanSubmit(id, "enter")}
          onCheckInSuccess={onCheckInSuccess}
        />
      )}

      {/* TAB 3: DAILY VISITOR REGISTRATION */}
      {kioskTab === "visitor" && (
        <div className="bg-white rounded-2xl border border-[#B8D8F8] p-4 sm:p-6 shadow-sm max-w-3xl mx-auto">
          <div className="border-b border-[#B8D8F8] pb-3 mb-5">
            <h3 className="text-base font-black uppercase tracking-wider text-[#0F2537] flex items-center gap-2">
              <span>👤</span>
              <span>Daily Visitor & Guest Pass Issuance</span>
            </h3>
            <p className="text-xs text-[#475569] mt-1 font-medium">
              Register contractors and guests visiting Floor 07 to generate their instant QR code pass and detect them in the building.
            </p>
          </div>

          <form onSubmit={handleRegisterVisitor} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Visitor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="e.g. Robert Taylor"
                  className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] focus:border-[#005DAA] focus:bg-white focus:outline-none placeholder-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  placeholder="e.g. (212) 555-8822"
                  className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] focus:border-[#005DAA] focus:bg-white focus:outline-none placeholder-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={visitorCompany}
                  onChange={(e) => setVisitorCompany(e.target.value)}
                  placeholder="e.g. Con Ed Energy Consultants"
                  className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] focus:border-[#005DAA] focus:bg-white focus:outline-none placeholder-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Host Employee on Floor 7
                </label>
                <input
                  type="text"
                  value={visitorHost}
                  onChange={(e) => setVisitorHost(e.target.value)}
                  placeholder="e.g. Sarah Jenkins (NW Engineering)"
                  className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] focus:border-[#005DAA] focus:bg-white focus:outline-none placeholder-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Assigned Floor Quadrant
                </label>
                <select
                  value={visitorQuad}
                  onChange={(e) => setVisitorQuad(e.target.value as QuadrantId)}
                  className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] focus:border-[#005DAA] focus:bg-white focus:outline-none font-medium"
                >
                  <option value="SE">SE · IT / Visitors (Default Guest Zone)</option>
                  <option value="NW">NW · Engineering</option>
                  <option value="NE">NE · Comms/Gov Affairs</option>
                  <option value="SW">SW · Legal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#0F2537] mb-1">
                  Visit Purpose / Notes
                </label>
                <input
                  type="text"
                  value={visitorNotes}
                  onChange={(e) => setVisitorNotes(e.target.value)}
                  placeholder="e.g. Quarterly Safety Audit Meeting"
                  className="w-full min-h-[42px] rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-3.5 py-2 text-sm text-[#0F2537] focus:border-[#005DAA] focus:bg-white focus:outline-none placeholder-[#64748B]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="submit"
                disabled={isRegisteringVisitor || !visitorName.trim()}
                className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-[#005DAA] text-white font-black text-xs uppercase tracking-wider hover:bg-[#004A88] active:scale-95 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <span>🏷️</span>
                <span>{isRegisteringVisitor ? "Issuing Pass..." : "ISSUE VISITOR PASS & DETECT IN BUILDING"}</span>
              </button>
            </div>
          </form>

          {/* Generated Visitor Pass Card */}
          {createdVisitor && (
            <div className="mt-6 p-4 rounded-xl border-2 border-emerald-500/60 bg-emerald-50 text-emerald-950 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-emerald-300 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  ✅ DAILY VISITOR PASS ISSUED & DETECTED IN BUILDING
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700">PASS ID: {createdVisitor.id}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-base font-black text-emerald-950">{createdVisitor.name}</div>
                  <div className="text-xs text-emerald-800 font-medium">Phone: {createdVisitor.phone || "N/A"} · {createdVisitor.notes}</div>
                  <div className="text-[11px] text-emerald-700 mt-1">
                    Quadrant: <strong className="text-emerald-950">{createdVisitor.quadrant}</strong> · Badged In At: <strong className="text-emerald-950">{createdVisitor.lastBadgeTime}</strong>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedBadgeOccupant(createdVisitor)}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-black uppercase tracking-wider hover:bg-emerald-800 transition cursor-pointer shrink-0 shadow-xs"
                >
                  VIEW QR BADGE 📱
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: QR BADGES DIRECTORY */}
      {kioskTab === "badges" && (
        <div className="bg-white rounded-2xl border border-[#B8D8F8] p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#B8D8F8] pb-3">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-[#0F2537]">
                🏷️ Occupant Directory & Building Presence
              </h3>
              <p className="text-xs text-[#475569] font-medium">
                Detect whether occupants are currently inside Floor 07 or have badged out of the building.
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-[#F0F6FC] p-1 rounded-xl border border-[#B8D8F8] flex-wrap">
              <button
                onClick={() => setBadgeCategoryFilter("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  badgeCategoryFilter === "ALL"
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "text-[#475569] hover:text-[#005DAA]"
                }`}
              >
                All ({occupants.length})
              </button>
              <button
                onClick={() => setBadgeCategoryFilter("IN_BUILDING")}
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  badgeCategoryFilter === "IN_BUILDING"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-[#475569] hover:text-[#005DAA]"
                }`}
              >
                In Building ({inBuildingCount})
              </button>
              <button
                onClick={() => setBadgeCategoryFilter("LEFT_BUILDING")}
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  badgeCategoryFilter === "LEFT_BUILDING"
                    ? "bg-amber-700 text-white shadow-xs"
                    : "text-[#475569] hover:text-[#005DAA]"
                }`}
              >
                Left Building ({leftBuildingCount})
              </button>
              <button
                onClick={() => setBadgeCategoryFilter("VISITOR")}
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  badgeCategoryFilter === "VISITOR"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-[#475569] hover:text-[#005DAA]"
                }`}
              >
                Visitors ({occupants.filter((o) => o.role === "Visitor").length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {filteredBadges.map((occ) => (
              <div
                key={occ.id}
                className="p-3.5 rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] hover:border-[#005DAA] hover:bg-white transition flex items-center justify-between group shadow-2xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-black text-[#0F2537] group-hover:text-[#005DAA] transition flex items-center gap-1.5">
                    <span className="truncate">{occ.name}</span>
                    <span className="text-[10px] font-mono text-[#005DAA] bg-[#005DAA]/10 px-1.5 py-0.2 rounded font-bold shrink-0">
                      {occ.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#475569] mt-0.5 font-medium">
                    {occ.phone || "(212) 555-0100"} · Quad {occ.quadrant}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        occ.badgedOut
                          ? "bg-slate-200 text-slate-700"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {occ.badgedOut ? "⚪ Left Building" : "🟢 In Building"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => setSelectedBadgeOccupant(occ)}
                    className="text-[10px] font-mono font-bold text-[#005DAA] bg-white px-2 py-1 rounded-md border border-[#B8D8F8] hover:bg-[#005DAA] hover:text-white transition cursor-pointer"
                  >
                    QR BADGE 🔲
                  </button>
                  <button
                    onClick={() => handleTogglePresence(occ.id, occ.badgedOut ? "enter" : "leave")}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition cursor-pointer ${
                      occ.badgedOut
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    }`}
                  >
                    {occ.badgedOut ? "Enter 🟢" : "Leave ⚪"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR BADGE CARD MODAL */}
      {selectedBadgeOccupant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border-2 border-[#005DAA] bg-white text-[#0F2537] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏷️</span>
                <span className="text-xs font-black uppercase tracking-wider text-[#005DAA]">
                  CON ED FSD DIGITAL BADGE PASS
                </span>
              </div>
              <button
                onClick={() => setSelectedBadgeOccupant(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition cursor-pointer flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Printable Badge Visual Card */}
            <div className="bg-[#F0F6FC] p-5 rounded-2xl border border-[#B8D8F8] text-center space-y-3.5 shadow-xs">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#005DAA] font-extrabold">
                FLOOR 07 · OFFICIAL ACCESS BADGE
              </div>

              <div className="text-lg font-black text-[#0F2537] tracking-tight">
                {selectedBadgeOccupant.name}
              </div>

              <div className="flex items-center justify-center gap-2">
                <span className="bg-[#005DAA] text-white px-2.5 py-0.5 rounded-full text-xs font-black uppercase">
                  OCC #: {selectedBadgeOccupant.id}
                </span>
                <span className="bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {selectedBadgeOccupant.quadrant} QUAD
                </span>
              </div>

              <div className="text-xs font-mono text-[#475569] font-bold">
                PHONE: {selectedBadgeOccupant.phone || "(212) 555-0100"} · STATUS:{" "}
                <span className={selectedBadgeOccupant.badgedOut ? "text-slate-600 font-black" : "text-emerald-700 font-black"}>
                  {selectedBadgeOccupant.badgedOut ? "LEFT BUILDING" : "IN BUILDING"}
                </span>
              </div>

              {/* Real Generated QR Code */}
              <div className="w-44 h-44 bg-white mx-auto p-2 rounded-xl border-2 border-[#005DAA] flex items-center justify-center shadow-md">
                {selectedBadgeQrUrl ? (
                  <img
                    src={selectedBadgeQrUrl}
                    alt={`QR Code for ${selectedBadgeOccupant.name}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-400 font-mono">Generating QR...</div>
                )}
              </div>

              <div className="font-mono text-xs font-bold text-[#005DAA]">
                CODE: CONED-BADGE-{selectedBadgeOccupant.id}-{selectedBadgeOccupant.quadrant}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  handleTogglePresence(selectedBadgeOccupant.id, selectedBadgeOccupant.badgedOut ? "enter" : "leave");
                  setSelectedBadgeOccupant(null);
                }}
                className={`flex-1 min-h-[42px] rounded-xl text-white text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs ${
                  selectedBadgeOccupant.badgedOut ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {selectedBadgeOccupant.badgedOut ? "🟢 Mark As In Building" : "⚪ Mark As Left Building"}
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 min-h-[42px] rounded-xl border border-[#B8D8F8] bg-white text-xs font-bold text-[#0F2537] hover:bg-[#F0F6FC] transition cursor-pointer"
              >
                🖨️ Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
