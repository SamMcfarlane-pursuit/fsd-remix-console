import React, { useState, useEffect } from "react";
import {
  Fingerprint,
  Building2,
  Smartphone,
  Laptop,
  ArrowRight,
  RefreshCw,
  User,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AuthUser, QuadrantId } from "../types";
import { SignInQRPosterModal } from "./SignInQRPosterModal";
import { authenticateWithBiometrics } from "../lib/biometrics";

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  onEnterOccupantApp: () => void;
  onOpenQRPoster?: () => void;
}

type UserCategory = "worker" | "visitor" | "admin";

export default function LoginScreen({
  onLoginSuccess,
  onEnterOccupantApp,
  onOpenQRPoster,
}: LoginScreenProps) {
  const [activeCategory, setActiveCategory] = useState<UserCategory>("worker");

  // Worker inputs
  const [workerName, setWorkerName] = useState<string>("Sarah Jenkins");
  const [workerPhone, setWorkerPhone] = useState<string>("(212) 555-0199");
  const [workerQuad, setWorkerQuad] = useState<QuadrantId>("NW");
  const [workerAction, setWorkerAction] = useState<"enter" | "leave" | "muster">("enter");

  // Visitor inputs
  const [visitorName, setVisitorName] = useState<string>("");
  const [visitorPhone, setVisitorPhone] = useState<string>("");
  const [visitorHost, setVisitorHost] = useState<string>("John Davis (Floor Warden)");
  const [visitorQuad, setVisitorQuad] = useState<QuadrantId>("SE");

  // Admin inputs
  const [adminRole, setAdminRole] = useState<"fsd_director" | "warden" | "security">("fsd_director");
  const [adminPin, setAdminPin] = useState<string>("7007");

  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const userAgent = navigator.userAgent || "";
    const isMobileDevice = /android|iphone|ipad|ipod|mobile/i.test(userAgent) || window.innerWidth < 768;
    setIsMobile(isMobileDevice);
  }, []);

  // Update default PIN when admin role changes
  useEffect(() => {
    if (adminRole === "fsd_director") setAdminPin("7007");
    else if (adminRole === "warden") setAdminPin("2026");
    else setAdminPin("1901");
  }, [adminRole]);

  // 1. Worker Direct Sign-In
  const handleWorkerSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!workerName.trim()) {
      setErrorMsg("Please enter your Name or Badge ID");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/occupant/sign-in-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workerName.trim(),
          phone: workerPhone.trim(),
          action: workerAction,
          role: "Employee",
          company: "Con Edison",
          quadrant: workerQuad,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem("muster_occupant_id", data.occupant.id);
        } catch {}
        setSuccessMsg(`Welcome ${data.occupant.name}! Recorded as PRESENT on Floor 07.`);
        setTimeout(() => {
          onEnterOccupantApp();
        }, 600);
      } else {
        onEnterOccupantApp();
      }
    } catch {
      onEnterOccupantApp();
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Visitor Pass Issuance
  const handleVisitorSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) {
      setErrorMsg("Please enter your Full Name");
      return;
    }
    if (!visitorPhone.trim()) {
      setErrorMsg("Please enter your Mobile Phone for emergency alerts");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/occupant/sign-in-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: visitorName.trim(),
          phone: visitorPhone.trim(),
          action: "enter",
          role: "Visitor",
          company: `Guest of ${visitorHost}`,
          quadrant: visitorQuad,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem("muster_occupant_id", data.occupant.id);
        } catch {}
        setSuccessMsg(`Visitor Pass #${data.occupant.id} Issued! Welcome to Floor 07.`);
        setTimeout(() => {
          onEnterOccupantApp();
        }, 600);
      } else {
        onEnterOccupantApp();
      }
    } catch {
      onEnterOccupantApp();
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Admin Commander Access
  const handleAdminSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const validPins: Record<string, string> = {
      fsd_director: "7007",
      warden: "2026",
      security: "1901",
    };

    const targetPin = validPins[adminRole];
    if (adminPin.trim() !== targetPin && adminPin.trim() !== "demo") {
      setErrorMsg(`Invalid PIN for this role. Default is ${targetPin}.`);
      setIsLoading(false);
      return;
    }

    try {
      const adminProfiles: Record<string, AuthUser> = {
        fsd_director: {
          id: "fsd.director",
          userId: "fsd.director",
          name: "Sarah Jenkins",
          role: "fsd_director",
          roleLabel: "Fire Safety Director",
          caps: 8,
          capsList: ["incident:control", "attendance:view"],
          token: `AUTH-ADMIN-${Date.now()}`,
          authMethod: "PIN_CREDENTIAL",
        },
        warden: {
          id: "warden.nw",
          userId: "warden.nw",
          name: "Michael Chang",
          role: "warden",
          roleLabel: "Floor Warden (NW)",
          caps: 4,
          capsList: ["incident:view", "attendance:manage"],
          quadrant: "NW",
          token: `AUTH-WARDEN-${Date.now()}`,
          authMethod: "PIN_CREDENTIAL",
        },
        security: {
          id: "kiosk.l7",
          userId: "kiosk.l7",
          name: "Turnstile Security Desk",
          role: "kiosk",
          roleLabel: "Front Desk Security",
          caps: 2,
          capsList: ["attendance:scan"],
          token: `AUTH-SEC-${Date.now()}`,
          authMethod: "PIN_CREDENTIAL",
        },
      };

      onLoginSuccess(adminProfiles[adminRole]);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Biometric Touch ID Quick Sign-In
  const handleBiometricClick = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const bioRes = await authenticateWithBiometrics(
        activeCategory === "admin" ? "FSD Commander" : workerName || "Floor 07 Personnel"
      );
      if (bioRes.success) {
        if (activeCategory === "admin") {
          handleAdminSignIn();
        } else {
          handleWorkerSignIn();
        }
      }
    } catch (err: any) {
      setErrorMsg("Biometric verification canceled.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] flex flex-col items-center justify-center p-3 sm:p-6 selection:bg-[#FF6B00] selection:text-black">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#1E3A60_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="w-full max-w-md relative z-10 my-auto py-2 space-y-4">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1E3A60]/60 border border-[#1E3A60] rounded-full text-[10px] font-mono font-bold text-[#38BDF8] uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>4 IRVING PLACE · FLOOR 07</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase">
            MUSTERCOMMAND
          </h1>
          <p className="text-xs font-mono text-[#829AB8] uppercase tracking-widest">
            Floor 07 Ingress &amp; Life-Safety Portal
          </p>
        </div>

        {/* Unified 3-Segmented Role Selector */}
        <div className="bg-[#0B172B] p-1.5 rounded-2xl border border-[#1E3A60] flex gap-1 shadow-lg text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveCategory("worker");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
              activeCategory === "worker"
                ? "bg-[#005DAA] text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <span className="text-base">🏢</span>
            <span>Worker</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveCategory("visitor");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
              activeCategory === "visitor"
                ? "bg-amber-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <span className="text-base">🎟️</span>
            <span>Visitor</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveCategory("admin");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
              activeCategory === "admin"
                ? "bg-red-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <span className="text-base">🛡️</span>
            <span>Admin</span>
          </button>
        </div>

        {/* Main Clean Card */}
        <div className="bg-[#0B172B] border border-[#1E3A60] rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-sm space-y-4 text-white text-xs">
          {/* Feedback Toasts */}
          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-200 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-200 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. WORKER / EMPLOYEE TAB                                  */}
          {/* ========================================================= */}
          {activeCategory === "worker" && (
            <form onSubmit={handleWorkerSignIn} className="space-y-3.5 animate-fadeIn">
              <div className="text-slate-300 font-medium pb-1 border-b border-[#1E3A60] flex items-center justify-between">
                <span>Con Edison Staff Sign-In (Floor 07)</span>
                <span className="text-[10px] text-sky-400 font-mono">195 Expected</span>
              </div>

              {/* 1-Tap Fingerprint / Touch ID Button */}
              <button
                type="button"
                onClick={handleBiometricClick}
                disabled={isLoading}
                className="w-full py-2.5 px-3 bg-linear-to-r from-[#0E2648] to-[#133664] hover:from-[#133664] hover:to-[#184682] border border-sky-400/40 hover:border-sky-400 text-sky-200 rounded-xl transition cursor-pointer flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="w-5 h-5 text-sky-400" />
                  <div className="text-left">
                    <div className="font-bold text-white text-[11px]">1-Tap Fingerprint / Touch ID</div>
                    <div className="text-[10px] text-slate-400 font-mono">Quick scan sensor</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-400" />
              </button>

              {/* Worker Name / Badge */}
              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1">
                  FULL NAME OR BADGE ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins or OCC-001"
                    required
                    className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl pl-9 pr-3 py-2.5 text-white font-mono text-xs focus:border-[#005DAA] outline-none"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Quadrant Sector */}
              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1">
                  FLOOR 07 WORK SECTOR
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-center font-mono font-bold text-[11px]">
                  {(["NW", "NE", "SW", "SE"] as QuadrantId[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setWorkerQuad(q)}
                      className={`py-1.5 rounded-lg border transition cursor-pointer ${
                        workerQuad === q
                          ? "bg-[#005DAA] border-sky-400 text-white shadow-sm"
                          : "bg-[#060E1C] border-[#1E3A60] text-slate-400 hover:text-white"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1">
                  SIGN-IN ACTION
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold text-center">
                  <button
                    type="button"
                    onClick={() => setWorkerAction("enter")}
                    className={`py-2 px-1 rounded-lg border transition cursor-pointer ${
                      workerAction === "enter"
                        ? "bg-emerald-950 border-emerald-400 text-emerald-300 font-black"
                        : "bg-[#060E1C] border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    🟢 Enter Floor 07
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerAction("leave")}
                    className={`py-2 px-1 rounded-lg border transition cursor-pointer ${
                      workerAction === "leave"
                        ? "bg-amber-950 border-amber-400 text-amber-300 font-black"
                        : "bg-[#060E1C] border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    ⚪ Badge Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerAction("muster")}
                    className={`py-2 px-1 rounded-lg border transition cursor-pointer ${
                      workerAction === "muster"
                        ? "bg-sky-950 border-sky-400 text-sky-300 font-black"
                        : "bg-[#060E1C] border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    🚨 Muster Safe
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#005DAA] hover:bg-[#004884] text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>⚡</span>}
                <span>Direct Sign-In &amp; View Pass</span>
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 2. VISITOR / GUEST TAB                                    */}
          {/* ========================================================= */}
          {activeCategory === "visitor" && (
            <form onSubmit={handleVisitorSignIn} className="space-y-3.5 animate-fadeIn">
              <div className="text-slate-300 font-medium pb-1 border-b border-[#1E3A60] flex items-center justify-between">
                <span>Guest &amp; Contractor Ingress</span>
                <span className="text-[10px] text-amber-400 font-mono">Floor 07 Badge</span>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1">
                  VISITOR FULL NAME
                </label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  required
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl px-3 py-2.5 text-white font-mono text-xs focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1">
                  MOBILE PHONE (FOR SMS ALERTS)
                </label>
                <input
                  type="tel"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  placeholder="(917) 555-0812"
                  required
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl px-3 py-2.5 text-white font-mono text-xs focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1">
                  VISITING HOST OR COMPANY
                </label>
                <input
                  type="text"
                  value={visitorHost}
                  onChange={(e) => setVisitorHost(e.target.value)}
                  placeholder="e.g. John Davis (Warden)"
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl px-3 py-2.5 text-white font-mono text-xs focus:border-amber-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>🎟️</span>}
                <span>Issue Visitor Pass &amp; Enter Floor 07</span>
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 3. ADMIN / COMMANDER TAB                                  */}
          {/* ========================================================= */}
          {activeCategory === "admin" && (
            <form onSubmit={handleAdminSignIn} className="space-y-3.5 animate-fadeIn">
              <div className="text-slate-300 font-medium pb-1 border-b border-[#1E3A60] flex items-center justify-between">
                <span>FSD Commander &amp; Warden Deck</span>
                <span className="text-[10px] text-red-400 font-mono">PIN Secured</span>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1">
                  SELECT COMMAND ROLE
                </label>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-bold text-center">
                  <button
                    type="button"
                    onClick={() => setAdminRole("fsd_director")}
                    className={`py-2 px-1 rounded-lg border transition cursor-pointer ${
                      adminRole === "fsd_director"
                        ? "bg-red-950 border-red-500 text-white font-black"
                        : "bg-[#060E1C] border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    FSD Director
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminRole("warden")}
                    className={`py-2 px-1 rounded-lg border transition cursor-pointer ${
                      adminRole === "warden"
                        ? "bg-red-950 border-red-500 text-white font-black"
                        : "bg-[#060E1C] border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    Floor Warden
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminRole("security")}
                    className={`py-2 px-1 rounded-lg border transition cursor-pointer ${
                      adminRole === "security"
                        ? "bg-red-950 border-red-500 text-white font-black"
                        : "bg-[#060E1C] border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    Security
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase">
                    4-DIGIT SECURITY PIN
                  </label>
                  <span className="text-[10px] text-sky-400 font-mono">
                    Default: {adminRole === "fsd_director" ? "7007" : adminRole === "warden" ? "2026" : "1901"}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={4}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="****"
                    required
                    className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl pl-9 pr-3 py-2.5 text-white font-mono text-center tracking-widest text-base font-black focus:border-red-500 outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>🛡️</span>}
                <span>Unlock 5-Step Commander Console</span>
              </button>
            </form>
          )}
        </div>

        {/* Bottom Fast Action: Display Floor QR Poster */}
        <div className="flex items-center justify-between text-xs px-1">
          <button
            type="button"
            onClick={() => {
              if (onOpenQRPoster) onOpenQRPoster();
              else setIsQrModalOpen(true);
            }}
            className="text-sky-400 hover:text-sky-300 font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <span>📱</span>
            <span>Display Floor 07 Entrance QR Code</span>
          </button>

          <button
            type="button"
            onClick={onEnterOccupantApp}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            Occupant Pass Direct →
          </button>
        </div>

        {/* QR Poster Modal */}
        <SignInQRPosterModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          onOpenSignInForm={() => {
            setIsQrModalOpen(false);
            onEnterOccupantApp();
          }}
          occupantsCount={195}
          inBuildingCount={142}
        />
      </div>
    </div>
  );
}
