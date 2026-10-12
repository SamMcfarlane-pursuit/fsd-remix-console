import React, { useState, useEffect, useRef } from "react";
import { EmergencyAlertPayload, Occupant, OccupantStatus } from "../types";
import { playPaChime } from "../lib/audioBroadcast";
import {
  EmergencyLanguage,
  SUPPORTED_LANGUAGES,
  EMERGENCY_STRINGS,
  translateEmergencyNarrative,
} from "../lib/emergencyTranslations";

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
    setActionFeedback(`✓ Verified: ${notes}. Command Console Updated.`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const t = EMERGENCY_STRINGS[lang];
  const translatedNarrative = alert ? translateEmergencyNarrative(alert.narrative, lang) : "";

  if (!alert) return null;

  const isCurrentAlertAcknowledged = acknowledgedAlertId === `${alert.title}-${alert.timestamp}`;

  // If occupant clicked "I Acknowledge & Egressing", render persistent high-visibility top strip
  if (isMinimized && isCurrentAlertAcknowledged) {
    return (
      <aside
        aria-label="Active emergency broadcast status"
        className="bg-red-700 text-white border-b-4 border-amber-400 p-3 shadow-xl sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 animate-pulse"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🚨</span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <span>{t.directiveBanner}</span>
              <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.2 rounded font-mono">
                ACTIVE
              </span>
            </div>
            <div className="text-xs font-semibold truncate max-w-md">
              {translatedNarrative || alert.title}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher Small */}
          <div className="flex items-center bg-red-900/80 rounded-lg p-0.5 border border-red-500 text-[11px] font-bold">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLanguageChange(l.code)}
                className={`px-1.5 py-0.5 rounded transition ${
                  lang === l.code ? "bg-white text-red-900 font-black shadow-xs" : "text-white hover:bg-red-800"
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
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-sm cursor-pointer"
          >
            {t.btnSafeOutside}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="px-2.5 py-1 bg-white text-red-900 font-black text-xs rounded-lg hover:bg-amber-300 shadow-sm cursor-pointer"
          >
            Expand Directive ↗
          </button>
        </div>
      </aside>
    );
  }

  // Full High-Contrast, Zero-Barrier Accessibility Alert Modal / Overlay
  return (
    <div
      role="region"
      aria-label="Critical life safety emergency broadcast"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-[#0F172A] border-4 border-red-600 text-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Pulsing Emergency Header */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-700 p-4 sm:p-5 flex items-center justify-between border-b-2 border-red-500">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">🚨</span>
            <div>
              <div className="text-[11px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-2">
                <span>{t.directiveBanner}</span>
                <span className="bg-black/40 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                  {alert.priority} PRIORITY
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-black text-white tracking-tight mt-0.5">
                {t.immediateEvacuation}
              </h1>
            </div>
          </div>

          {/* Quick Audio Voice Readout */}
          <button
            type="button"
            onClick={isSpeaking ? handleStopSpeech : handleReadAloud}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition ${
              isSpeaking
                ? "bg-amber-400 text-black hover:bg-amber-300 animate-pulse"
                : "bg-white text-red-700 hover:bg-red-50"
            }`}
          >
            <span>{isSpeaking ? "⏹️" : "🔊"}</span>
            <span>{isSpeaking ? t.btnStopAudio : t.btnReadAloud}</span>
          </button>
        </div>

        {/* Multi-Language Accessible Selector Bar */}
        <div className="bg-[#1E293B] px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>🌐 Select Language / Idioma / 语言 / Язык:</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLanguageChange(l.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  lang === l.code
                    ? "bg-red-600 text-white ring-2 ring-amber-400 font-black shadow-sm"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.nativeName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Life-Safety Rule 1: No Elevators Warning Banner */}
          <div className="bg-amber-500/20 border-2 border-amber-400 rounded-2xl p-3.5 flex items-center gap-3 text-amber-200">
            <span className="text-3xl">🚫🛗</span>
            <div>
              <div className="text-sm font-black text-amber-300 uppercase tracking-wide">
                {t.noElevators}
              </div>
              <div className="text-xs text-amber-100/90 mt-0.5">
                {t.proceedToStairwell}
              </div>
            </div>
          </div>

          {/* Commander Narrative */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-2">
            <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>FSD COMMANDER BROADCAST DISPATCH</span>
              <span>{alert.timestamp || new Date().toLocaleTimeString()}</span>
            </div>
            <div className="text-base sm:text-lg font-black text-white leading-relaxed">
              {translatedNarrative || alert.narrative}
            </div>
          </div>

          {/* Routing Cards: Stairwell & Exterior Assembly Point */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
              <div className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                <span>🏃‍♂️</span>
                <span>{t.stairwellLabel}</span>
              </div>
              <div className="text-xs font-bold text-white mt-1">
                {stairwell}
              </div>
            </div>

            <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
              <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <span>📍</span>
                <span>{t.assemblyLabel}</span>
              </div>
              <div className="text-xs font-bold text-white mt-1">
                {assemblyPoint}
              </div>
            </div>
          </div>

          {/* Device Push Notification Prompt if not yet granted */}
          {pushPermission === "default" && (
            <div className="p-2.5 bg-blue-900/40 border border-blue-500 rounded-xl flex items-center justify-between gap-2 text-xs">
              <span className="text-blue-200">
                🔔 Enable instant lock-screen device notifications for drill alarms
              </span>
              <button
                type="button"
                onClick={handleEnablePush}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Allow Push
              </button>
            </div>
          )}

          {/* Action Feedback Notification */}
          {actionFeedback && (
            <div className="p-3 bg-emerald-950 border border-emerald-500 text-emerald-200 rounded-xl text-xs font-bold animate-pulse text-center">
              {actionFeedback}
            </div>
          )}

          {/* Immediate Action Buttons for Occupant */}
          <div className="pt-2 space-y-2.5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
              Tap Your Current Status Below:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg border-2 border-emerald-400 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-95"
              >
                <span className="text-xl">🟢</span>
                <span className="text-center">{t.btnSafeOutside}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSafetyAction(
                    "need-help",
                    `EMERGENCY: Occupant reported trapped/needs help from ${currentOccupant?.quadrant || "Floor 07"}`,
                    "inside-building"
                  )
                }
                className="p-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg border-2 border-red-400 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-95"
              >
                <span className="text-xl">🆘</span>
                <span className="text-center">{t.btnNeedHelp}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSafetyAction(
                    "awaiting-evac-chair",
                    `Stryker evacuation chair assistance requested at Stairwell A landing`,
                    "inside-building"
                  )
                }
                className="p-3.5 bg-purple-700 hover:bg-purple-600 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg border-2 border-purple-400 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-95"
              >
                <span className="text-xl">🛞</span>
                <span className="text-center">{t.btnEvacChair}</span>
              </button>
            </div>

            {/* Acknowledge & Minimize Directive */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setAcknowledgedAlertId(`${alert.title}-${alert.timestamp}`);
                  setIsMinimized(true);
                  handleStopSpeech();
                }}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-600 cursor-pointer transition"
              >
                {t.btnAcknowledge}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
