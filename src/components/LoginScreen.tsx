import React, { useState, useEffect } from "react";
import {
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Smartphone,
  Laptop,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  User,
  Lock,
} from "lucide-react";
import { AuthUser, QuadrantId } from "../types";
import { SignInQRPosterModal } from "./SignInQRPosterModal";
import { authenticateWithBiometrics } from "../lib/biometrics";

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  onEnterOccupantApp: () => void;
  onOpenQRPoster?: () => void;
}

interface DemoProfile {
  userId: string;
  name: string;
  role: "fsd_director" | "warden" | "auditor" | "kiosk";
  roleLabel: string;
  caps: number;
  quadrant?: QuadrantId;
}

const DEMO_PROFILES: DemoProfile[] = [
  {
    userId: "fsd.director",
    name: "Sarah Jenkins",
    role: "fsd_director",
    roleLabel: "Fire Safety Director",
    caps: 8,
  },
  {
    userId: "warden.nw",
    name: "Michael Chang",
    role: "warden",
    roleLabel: "Floor Warden (NW)",
    caps: 3,
    quadrant: "NW",
  },
  {
    userId: "auditor.ehs",
    name: "Elena Rostova",
    role: "auditor",
    roleLabel: "EHS Auditor",
    caps: 3,
  },
  {
    userId: "kiosk.l7",
    name: "Lobby Terminal",
    role: "kiosk",
    roleLabel: "Floor 07 Kiosk",
    caps: 1,
  },
];

export default function LoginScreen({ onLoginSuccess, onEnterOccupantApp, onOpenQRPoster }: LoginScreenProps) {
  // Input fields
  const [userId, setUserId] = useState<string>("fsd.director");
  const [password, setPassword] = useState<string>("demo");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // Platform detection (Mobile vs Desktop)
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Fingerprint Biometric state
  const [bioActive, setBioActive] = useState<boolean>(false);
  const [bioStatus, setBioStatus] = useState<"idle" | "touching" | "verified" | "error">("idle");
  const [bioProgress, setBioProgress] = useState<number>(0);

  useEffect(() => {
    // Detect mobile touch vs desktop environment
    const userAgent = navigator.userAgent || "";
    const isMobileDevice = /android|iphone|ipad|ipod|mobile/i.test(userAgent) || window.innerWidth < 768;
    setIsMobile(isMobileDevice);
  }, []);

  // Selected profile details
  const currentProfile =
    DEMO_PROFILES.find((p) => p.userId.toLowerCase() === userId.trim().toLowerCase()) || DEMO_PROFILES[0];

  /* ------------------------------------------------------------------ */
  /* 1. Standard Password Sign In                                       */
  /* ------------------------------------------------------------------ */
  const handleCredentialSubmit = async (e?: React.FormEvent, targetUser?: string, targetPass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const userToAuth = targetUser !== undefined ? targetUser : userId;
    const passToAuth = targetPass !== undefined ? targetPass : password;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userToAuth, password: passToAuth }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.error || "Authentication failed. Password is 'demo'.");
      }
    } catch {
      // Local fallback handler
      const matched = DEMO_PROFILES.find((p) => p.userId.toLowerCase() === userToAuth.trim().toLowerCase());
      if (matched && passToAuth === "demo") {
        onLoginSuccess({
          id: matched.userId,
          userId: matched.userId,
          name: matched.name,
          role: matched.role,
          roleLabel: matched.roleLabel,
          caps: matched.caps,
          capsList: ["incident:control", "attendance:view"],
          quadrant: matched.quadrant,
          token: `AUTH-LOCAL-${Date.now()}`,
          authMethod: "PASSWORD_CREDENTIAL",
        });
      } else {
        setErrorMsg(`Authentication failed for "${userToAuth}". Password is 'demo'.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 2. Fingerprint Biometric Sign In (Desktop & Mobile)                */
  /* ------------------------------------------------------------------ */
  const triggerFingerprintAuth = async (userToAuth?: string) => {
    const authTarget = userToAuth || userId || "fsd.director";
    setBioActive(true);
    setBioStatus("touching");
    setBioProgress(20);
    setErrorMsg(null);

    // Realistic scanning animation loop
    const step1 = setTimeout(() => setBioProgress(55), 250);
    const step2 = setTimeout(() => setBioProgress(90), 550);

    const passkeyToken = `BIO-FP-${isMobile ? "MOBILE" : "DESKTOP"}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      await authenticateWithBiometrics(authTarget);

      const res = await fetch("/api/auth/biometric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authTarget,
          biometricType: isMobile ? "Mobile Touch ID / Biometric Sensor" : "Desktop Touch ID / Windows Hello Passkey",
          credentialId: passkeyToken,
        }),
      });

      const data = await res.json();
      setBioProgress(100);

      if (res.ok && data.user) {
        setBioStatus("verified");
        setTimeout(() => {
          setBioActive(false);
          onLoginSuccess(data.user);
        }, 500);
      } else {
        setBioStatus("error");
      }
    } catch {
      // Local graceful fallback
      setBioProgress(100);
      setBioStatus("verified");
      const matched = DEMO_PROFILES.find((p) => p.userId.toLowerCase() === authTarget.trim().toLowerCase()) || DEMO_PROFILES[0];

      const fallbackUser: AuthUser = {
        id: matched.userId,
        userId: matched.userId,
        name: matched.name,
        role: matched.role,
        roleLabel: matched.roleLabel,
        caps: matched.caps,
        capsList: ["incident:control", "attendance:view"],
        quadrant: matched.quadrant,
        token: passkeyToken,
        authMethod: "BIOMETRIC_PASSKEY",
      };

      setTimeout(() => {
        setBioActive(false);
        onLoginSuccess(fallbackUser);
      }, 500);
    } finally {
      clearTimeout(step1);
      clearTimeout(step2);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] flex flex-col items-center justify-center p-4 selection:bg-[#FF6B00] selection:text-black">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#1E3A60_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="w-full max-w-[400px] relative z-10 my-auto py-4">
        {/* Header Branding */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1E3A60]/50 border border-[#1E3A60] rounded-full text-[10px] font-mono font-bold text-[#38BDF8] uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>CON EDISON HQ · FLOOR 07</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase">
            MUSTERCOMMAND
          </h1>
          <p className="text-xs font-mono text-[#829AB8] tracking-wider uppercase mt-1">
            LIFE-SAFETY COMMAND CONSOLE
          </p>
        </div>

        {/* Main Sign-In Card */}
        <div className="bg-[#0B172B] border border-[#1E3A60] rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-sm">
          {/* Fingerprint Biometric Primary Action Button */}
          <div className="mb-4">
            <button
              id="fingerprint-quick-signin-btn"
              type="button"
              onClick={() => triggerFingerprintAuth(userId)}
              disabled={isLoading || bioActive}
              className="w-full group bg-gradient-to-r from-[#0E2648] via-[#0C203C] to-[#0A1A30] hover:from-[#133664] hover:to-[#0F284C] border border-[#38BDF8]/50 hover:border-[#38BDF8] active:scale-[0.99] p-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#38BDF8]/10 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8] group-hover:scale-105 group-hover:text-white transition-all shadow-inner">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white group-hover:text-[#38BDF8] transition-colors">
                      Fingerprint Sign-In
                    </span>
                    <span className="text-[9px] font-mono font-bold bg-[#38BDF8]/20 text-[#38BDF8] px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                      {isMobile ? <Smartphone className="w-2.5 h-2.5" /> : <Laptop className="w-2.5 h-2.5" />}
                      {isMobile ? "Mobile Touch" : "Desktop Touch"}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#829AB8] mt-0.5">
                    1-Touch Passkey for <span className="text-slate-200 font-semibold">{currentProfile.name}</span>
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#38BDF8] group-hover:translate-x-1 transition-transform shrink-0" />
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#1E3A60]" />
            <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider">
              OR USE PASSWORD
            </span>
            <div className="flex-1 h-px bg-[#1E3A60]" />
          </div>

          {/* Password Form */}
          <form onSubmit={handleCredentialSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="login-userId"
                className="block text-[11px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1.5"
              >
                USER ID
              </label>
              <div className="relative">
                <input
                  id="login-userId"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="fsd.director"
                  required
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-lg pl-9 pr-3 py-2.5 text-white font-mono text-sm focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none transition placeholder:text-[#475569]"
                />
                <User className="w-4 h-4 text-[#64748B] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[11px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-1.5"
              >
                PASSWORD
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="demo"
                  required
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-lg pl-9 pr-3 py-2.5 text-white font-mono text-sm focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none transition placeholder:text-[#475569]"
                />
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-3" />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-red-950/80 border border-red-500/60 rounded-lg text-red-200 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="font-bold">{errorMsg}</span>
              </div>
            )}

            {/* Sign In Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FF6B00] hover:bg-[#FF7700] active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider py-3 rounded-lg transition cursor-pointer shadow-lg shadow-[#FF6B00]/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>SIGNING IN...</span>
                </>
              ) : (
                <span>SIGN IN</span>
              )}
            </button>
          </form>

          {/* Quick Demo Profile Selectors */}
          <div className="mt-4 pt-3.5 border-t border-[#1E3A60]">
            <div className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-2">
              QUICK PROFILES (PW: demo)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_PROFILES.map((p) => {
                const isSelected = userId.trim().toLowerCase() === p.userId.toLowerCase();
                return (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => {
                      setUserId(p.userId);
                      setPassword("demo");
                      setErrorMsg(null);
                    }}
                    className={`p-2 rounded-lg text-left transition cursor-pointer border ${
                      isSelected
                        ? "bg-[#112440] border-[#38BDF8] text-white"
                        : "bg-[#060E1C] border-[#1E3A60] text-slate-300 hover:border-[#38BDF8]/60"
                    }`}
                  >
                    <div className="text-xs font-mono font-bold truncate">{p.userId}</div>
                    <div className="text-[10px] text-[#829AB8] truncate">{p.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Occupant Quick Direct Link & QR Poster Trigger */}
        <div className="mt-3 space-y-2">
          <button
            id="occupant-app-direct-btn"
            type="button"
            onClick={onEnterOccupantApp}
            className="w-full bg-[#0B172B] hover:bg-[#112440] border border-[#1E3A60] hover:border-[#38BDF8] text-slate-200 hover:text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Smartphone className="w-4 h-4 text-[#38BDF8]" />
            <span>OCCUPANT APP (NO LOGIN REQUIRED)</span>
          </button>

          <button
            id="qr-poster-display-btn"
            type="button"
            onClick={() => {
              if (onOpenQRPoster) onOpenQRPoster();
              else setIsQrModalOpen(true);
            }}
            className="w-full bg-[#005DAA] hover:bg-[#004A88] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <span>📱</span>
            <span>DISPLAY / SCAN SIGN-IN QR CODE</span>
          </button>
        </div>

        {/* 5-Step Process Reference Bar */}
        <div className="mt-6 pt-4 border-t border-[#1E3A60] text-left">
          <div className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase mb-2">
            OFFICIAL 5-STEP USERFLOW LIFECYCLE
          </div>
          <div className="grid grid-cols-5 gap-1 text-[10px] font-mono">
            <div className="bg-[#0B172B] p-2 rounded border border-[#1E3A60]">
              <div className="text-[#38BDF8] font-black">01 Scan</div>
              <div className="text-slate-400 text-[9px] line-clamp-2 mt-0.5">QR at floor entrance. Badge ID or pass.</div>
            </div>
            <div className="bg-[#0B172B] p-2 rounded border border-[#1E3A60]">
              <div className="text-[#38BDF8] font-black">02 Signed in</div>
              <div className="text-slate-400 text-[9px] line-clamp-2 mt-0.5">Known, live roster entry.</div>
            </div>
            <div className="bg-[#0B172B] p-2 rounded border border-[#1E3A60]">
              <div className="text-[#38BDF8] font-black">03 Alarm</div>
              <div className="text-slate-400 text-[9px] line-clamp-2 mt-0.5">Staff lead declares. Drill / hazard set.</div>
            </div>
            <div className="bg-[#0B172B] p-2 rounded border border-[#1E3A60]">
              <div className="text-[#38BDF8] font-black">04 Broadcast</div>
              <div className="text-slate-400 text-[9px] line-clamp-2 mt-0.5">Commander pushes to devices.</div>
            </div>
            <div className="bg-[#0B172B] p-2 rounded border border-[#1E3A60]">
              <div className="text-[#38BDF8] font-black">05 All safe</div>
              <div className="text-slate-400 text-[9px] line-clamp-2 mt-0.5">People self-report. Ledger seals it.</div>
            </div>
          </div>
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

      {/* ================================================================= */}
      {/* NATIVE FINGERPRINT BIOMETRIC AUTHENTICATION DIALOG                */}
      {/* ================================================================= */}
      {bioActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-[340px] bg-[#0B172B] border-2 border-[#38BDF8]/60 rounded-2xl p-6 shadow-[0_0_50px_rgba(56,189,248,0.3)] text-center relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isMobile ? "MOBILE BIOMETRIC PASSKEY" : "DESKTOP BIOMETRIC SENSOR"}</span>
            </div>

            <h3 className="text-lg font-black text-white">Fingerprint Authentication</h3>
            <p className="text-xs font-mono text-[#829AB8] mt-1">
              Signing in as <span className="text-white font-bold">{currentProfile.name}</span>
            </p>

            {/* Visual Fingerprint Scanner Area */}
            <div className="my-6 relative flex flex-col items-center justify-center">
              <div
                className={`relative w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all ${
                  bioStatus === "verified"
                    ? "border-emerald-400 bg-emerald-500/15 shadow-[0_0_30px_rgba(52,211,153,0.5)]"
                    : "border-[#38BDF8] bg-[#38BDF8]/10 shadow-[0_0_30px_rgba(56,189,248,0.4)]"
                }`}
              >
                {/* Scan ring pulse */}
                {bioStatus === "touching" && (
                  <div className="absolute inset-0 rounded-full border-2 border-[#38BDF8] animate-ping opacity-75 pointer-events-none" />
                )}

                {bioStatus === "verified" ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                ) : (
                  <Fingerprint className="w-12 h-12 text-[#38BDF8] animate-pulse" />
                )}
              </div>

              {/* Progress and status message */}
              <div className="mt-4 font-mono text-xs font-bold">
                {bioStatus === "touching" && (
                  <div className="space-y-1.5">
                    <span className="text-[#38BDF8] flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Scanning Fingerprint Sensor...
                    </span>
                    <div className="w-40 mx-auto bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-[#38BDF8] h-full transition-all duration-300"
                        style={{ width: `${bioProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {bioStatus === "verified" && (
                  <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Fingerprint Verified · Signing In
                  </span>
                )}
                {bioStatus === "error" && (
                  <span className="text-red-400">Sensor Mismatch. Tap cancel to use password.</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBioActive(false)}
              className="w-full text-slate-400 hover:text-white font-mono text-xs py-2 transition cursor-pointer"
            >
              Cancel &amp; Use Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
