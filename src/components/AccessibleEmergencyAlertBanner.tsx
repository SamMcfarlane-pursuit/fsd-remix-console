import React, { useState, useEffect, useRef } from "react";
import { EmergencyAlertPayload, Occupant, OccupantStatus } from "../types";
import { playPaChime } from "../lib/audioBroadcast";
import {
  EmergencyLanguage,
  SUPPORTED_LANGUAGES,
  EMERGENCY_STRINGS,
  translateEmergencyNarrative,
} from "../lib/emergencyTranslations";
import { ActualBuildingFloorMap } from "./ActualBuildingFloorMap";
import {
  ShieldCheck,
  AlertTriangle,
  Accessibility,
  Volume2,
  VolumeX,
  X,
  Bell,
  ArrowRight,
  Maximize2,
  DoorOpen,
  MapPin,
} from "lucide-react";

interface AccessibleEmergencyAlertBannerProps {
  alert: EmergencyAlertPayload | null | undefined;
  currentOccupant?: Occupant | null;
  onCheckIn?: (
    occupantId: string,
    status: OccupantStatus,
    via?: string,
    notes?: string,
    locationCategory?: "inside-building" | "outside-assembly" | "offsite",
    assemblyPoint?: string
  ) => Promise<void> | void;
  stairwell?: string;
  assemblyPoint?: string;
}

export const AccessibleEmergencyAlertBanner: React.FC<AccessibleEmergencyAlertBannerProps> = ({
  alert,
  currentOccupant,
  onCheckIn,
  stairwell = "Stairwell A (East Core - Union Sq East)",
  assemblyPoint = "Assembly Point A (Union Sq East / Park Plaza)",
}) => {
  // Detect device language or retrieve stored preference
  const [lang, setLang] = useState<EmergencyLanguage>(() => {
    try {
      const stored = localStorage.getItem("fsd_emergency_preferred_lang");
      if (stored && ["en", "es", "zh", "ru", "ht", "bn"].includes(stored)) {
        return stored as EmergencyLanguage;
      }
      const navLang = navigator.language?.toLowerCase() || "";
      if (navLang.startsWith("es")) return "es";
      if (navLang.startsWith("zh")) return "zh";
      if (navLang.startsWith("ru")) return "ru";
      if (navLang.startsWith("ht")) return "ht";
      if (navLang.startsWith("bn")) return "bn";
    } catch {}
    return "en";
  });

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [acknowledgedAlertId, setAcknowledgedAlertId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  });

  const lastAlertTimestampRef = useRef<string | null>(null);

  // When a new alert arrives or changes
  useEffect(() => {
    if (!alert) return;

    const alertKey = `${alert.title}-${alert.timestamp}`;
    if (alertKey !== lastAlertTimestampRef.current) {
      lastAlertTimestampRef.current = alertKey;
      setIsMinimized(false); // Pop full screen/banner on new alert

      // 1. Play Life-Safety Chime
      playPaChime().catch(() => {});

      // 2. Hardware vibration for mobile devices (3 pulse cadence)
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([300, 150, 300, 150, 600]);
        } catch {}
      }

      // 3. Native OS notification if permitted
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(alert.title, {
            body: alert.narrative,
            icon: "/favicon.ico",
            tag: "fsd-emergency-alert",
          });
        } catch {}
      }
    }
  }, [alert]);

  const handleLanguageChange = (newLang: EmergencyLanguage) => {
    setLang(newLang);
    try {
      localStorage.setItem("fsd_emergency_preferred_lang", newLang);
    } catch {}
    if (isSpeaking) {
      handleStopSpeech();
    }
  };

  const handleEnablePush = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const res = await Notification.requestPermission();
      setPushPermission(res);
      if (res === "granted" && alert) {
        new Notification(alert.title, {
          body: alert.narrative,
        });
      }
    }
  };

  // Text to Speech Readout in native language
  const handleReadAloud = () => {
    if (!alert || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const meta = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
    const translatedText = translateEmergencyNarrative(alert.narrative, lang);
    const t = EMERGENCY_STRINGS[lang];

    const utteranceText = `${t.directiveBanner}. ${translatedText}. ${t.noElevators}. ${t.proceedToStairwell}`;

    const utterance = new SpeechSynthesisUtterance(utteranceText);
    utterance.lang = meta?.speechLang || "en-US";
    utterance.rate = 0.95; // Clear, articulate cadence for panic situations
    utterance.pitch = 1.0;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(utterance.lang)) || voices[0];
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Life Safety Quick Check-In from Banner
  const handleSafetyAction = async (status: OccupantStatus, notes: string, category: any, ap?: string) => {
    const occId = currentOccupant?.id || "OCC-101";
    setActionFeedback("Transmitting your status to FSD Commander Console...");
    if (onCheckIn) {
      await onCheckIn(occId, status, "accessible-alert-banner", notes, category, ap);
    }
    setActionFeedback(`✓ Transmitted: ${notes}. Command Console Updated.`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const t = EMERGENCY_STRINGS[lang];
  const translatedNarrative = alert ? translateEmergencyNarrative(alert.narrative, lang) : "";

  if (!alert) return null;

  const isCurrentAlertAcknowledged = acknowledgedAlertId === `${alert.title}-${alert.timestamp}`;

  // If occupant clicked "I Acknowledge & Egressing", render persistent high-visibility top strip (eye-friendly enterprise design)
  if (isMinimized && isCurrentAlertAcknowledged) {
    return (
      <aside
        aria-label="Active emergency broadcast status"
        className="bg-[#0F2537] text-white border-b-2 border-amber-400 px-4 py-2.5 shadow-md sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="text-amber-300">{t.directiveBanner}</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded font-mono">
                ACTIVE
              </span>
            </div>
            <div className="text-xs font-medium text-slate-200 truncate max-w-md">
              {translatedNarrative || alert.title}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher Mini */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[11px]">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLanguageChange(l.code)}
                className={`px-1.5 py-0.5 rounded transition ${
                  lang === l.code ? "bg-[#005DAA] text-white font-bold" : "text-slate-300 hover:bg-slate-700"
                }`}
                title={l.name}
              >
                {l.flag} {l.code.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleSafetyAction("safe", "Safe Outside at Assembly Point A", "outside-assembly", assemblyPoint)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t.btnSafeOutside}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="px-2.5 py-1 bg-white text-[#0F2537] font-bold text-xs rounded-lg hover:bg-slate-100 shadow-xs cursor-pointer border border-slate-300 transition flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Expand Directive</span>
          </button>
        </div>
      </aside>
    );
  }

  // Full Enterprise Egress Directive Modal (Professional Level UI/UX)
  return (
    <div
      role="region"
      aria-label="Critical life safety emergency broadcast"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 text-[#0F2537] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Executive Header Bar */}
        <div className="bg-[#0F2537] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <div>
              <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <span>CON EDISON · FDNY LIFE SAFETY DISPATCH</span>
                <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded font-mono">
                  {alert.priority} PRIORITY
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight mt-0.5">
                {t.immediateEvacuation}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Voice Readout */}
            <button
              type="button"
              onClick={isSpeaking ? handleStopSpeech : handleReadAloud}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition ${
                isSpeaking
                  ? "bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              }`}
              title="Read instructions aloud"
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isSpeaking ? t.btnStopAudio : t.btnReadAloud}</span>
            </button>

            {/* Quick minimize / dismiss */}
            <button
              type="button"
              onClick={() => {
                setAcknowledgedAlertId(`${alert.title}-${alert.timestamp}`);
                setIsMinimized(true);
                handleStopSpeech();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Minimize directive"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Segmented Multi-Language Control Bar */}
        <div className="bg-slate-50 px-4 sm:px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-600 text-[11px]">Language / Idioma:</span>

          <div className="flex flex-wrap gap-1">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLanguageChange(l.code)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  lang === l.code
                    ? "bg-[#005DAA] text-white shadow-xs font-bold"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.nativeName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
          {/* Directive Warning Bar (Soft amber tone - eye-friendly & clear) */}
          <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 flex items-start sm:items-center gap-3 text-amber-950">
            <span className="text-xl shrink-0 mt-0.5 sm:mt-0">🚫🛗</span>
            <div className="text-xs">
              <span className="font-bold uppercase text-amber-900 tracking-wide">
                {t.noElevators}:
              </span>{" "}
              <span className="text-amber-900/90 font-medium">
                {t.proceedToStairwell}
              </span>
            </div>
          </div>

          {/* Commander Broadcast Message */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs sm:text-sm space-y-1">
            <div className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider flex items-center justify-between">
              <span>BROADCAST DISPATCH</span>
              <span>{alert.timestamp || new Date().toLocaleTimeString()}</span>
            </div>
            <p className="font-semibold text-slate-900 leading-snug">
              {translatedNarrative || alert.narrative}
            </p>
          </div>

          {/* Routing Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-sky-50/80 border border-sky-200 rounded-xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0 text-sky-700">
                <DoorOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold text-sky-800 uppercase tracking-wider">
                  {t.stairwellLabel}
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {stairwell}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
                  {t.assemblyLabel}
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {assemblyPoint}
                </div>
              </div>
            </div>
          </div>

          {/* Authentic Building Map Without Cluttered Names */}
          <div className="space-y-1">
            <ActualBuildingFloorMap
              targetQuadrant={currentOccupant?.quadrant || "NW"}
              targetDesk={currentOccupant?.desk}
              targetStairwell={stairwell}
              showEgressPath={true}
            />
          </div>

          {/* Push Notification Opt-in if Default */}
          {pushPermission === "default" && (
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-slate-500" />
                <span>Enable lock-screen emergency notifications</span>
              </span>
              <button
                type="button"
                onClick={handleEnablePush}
                className="px-2.5 py-1 bg-[#005DAA] hover:bg-[#004B87] text-white font-semibold rounded-md text-xs cursor-pointer transition"
              >
                Allow
              </button>
            </div>
          )}

          {/* Action Feedback confirmation */}
          {actionFeedback && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold text-center">
              {actionFeedback}
            </div>
          )}

          {/* Ergonomic Life-Safety Action Cards */}
          <div className="pt-1 space-y-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
              Select Your Current Safety Status:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 🟢 I Am Safe Outside */}
              <button
                type="button"
                onClick={() =>
                  handleSafetyAction(
                    "safe",
                    "Checked in safe at exterior assembly point",
                    "outside-assembly",
                    assemblyPoint
                  )
                }
                className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs border border-emerald-700 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition active:scale-[0.98] group"
              >
                <ShieldCheck className="w-5 h-5 text-emerald-100 group-hover:scale-110 transition" />
                <span className="font-extrabold text-xs sm:text-sm">{t.btnSafeOutside}</span>
                <span className="text-[10px] text-emerald-100 font-normal">Exterior Assembly</span>
              </button>

              {/* 🆘 Need Assistance */}
              <button
                type="button"
                onClick={() =>
                  handleSafetyAction(
                    "need-help",
                    `EMERGENCY: Occupant reported trapped/needs help from ${currentOccupant?.quadrant || "Floor 07"}`,
                    "inside-building"
                  )
                }
                className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs border border-rose-700 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition active:scale-[0.98] group"
              >
                <AlertTriangle className="w-5 h-5 text-rose-100 group-hover:scale-110 transition" />
                <span className="font-extrabold text-xs sm:text-sm">{t.btnNeedHelp}</span>
                <span className="text-[10px] text-rose-100 font-normal">Alert Fire Command</span>
              </button>

              {/* 🛞 Evac Chair */}
              <button
                type="button"
                onClick={() =>
                  handleSafetyAction(
                    "awaiting-evac-chair",
                    `Stryker evacuation chair assistance requested at Stairwell A landing`,
                    "inside-building"
                  )
                }
                className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs border border-indigo-700 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition active:scale-[0.98] group"
              >
                <Accessibility className="w-5 h-5 text-indigo-100 group-hover:scale-110 transition" />
                <span className="font-extrabold text-xs sm:text-sm">{t.btnEvacChair}</span>
                <span className="text-[10px] text-indigo-100 font-normal">Mobility Assistance</span>
              </button>
            </div>

            {/* Acknowledge & Egress Action */}
            <div className="pt-1.5 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setAcknowledgedAlertId(`${alert.title}-${alert.timestamp}`);
                  setIsMinimized(true);
                  handleStopSpeech();
                }}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs rounded-xl border border-slate-300 cursor-pointer transition flex items-center gap-1.5"
              >
                <span>{t.btnAcknowledge}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
