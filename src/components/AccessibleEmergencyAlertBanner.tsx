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

  // If occupant clicked "I Acknowledge & Egressing", render persistent high-visibility top strip (comfortable eye-friendly)
  if (isMinimized && isCurrentAlertAcknowledged) {
    return (
      <aside
        aria-label="Active emergency broadcast status"
        className="bg-[#0F2537] text-white border-b-2 border-amber-400 p-2.5 shadow-md sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🚨</span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <span className="text-amber-300">{t.directiveBanner}</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded font-mono">
                ACTIVE
              </span>
            </div>
            <div className="text-xs font-medium text-slate-200 truncate max-w-md">
              {translatedNarrative || alert.title}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher Small */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[11px] font-bold">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLanguageChange(l.code)}
                className={`px-1.5 py-0.5 rounded transition ${
                  lang === l.code ? "bg-[#005DAA] text-white font-bold shadow-xs" : "text-slate-300 hover:bg-slate-700"
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
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition"
          >
            {t.btnSafeOutside}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="px-2.5 py-1 bg-white text-[#0F2537] font-bold text-xs rounded-lg hover:bg-slate-100 shadow-xs cursor-pointer border border-slate-300 transition"
          >
            Expand Directive ↗
          </button>
        </div>
      </aside>
    );
  }

  // Full Normal Eye-Friendly Accessibility Alert Modal
  return (
    <div
      role="region"
      aria-label="Critical life safety emergency broadcast"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 text-[#0F2537] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Authoritative Header - Calming navy/burgundy accent that doesn't hurt eyes */}
        <div className="bg-[#0F2537] text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>{t.directiveBanner}</span>
                <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded font-mono">
                  {alert.priority} PRIORITY
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                {t.immediateEvacuation}
              </h1>
            </div>
          </div>

          {/* Audio Voice Readout */}
          <button
            type="button"
            onClick={isSpeaking ? handleStopSpeech : handleReadAloud}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition ${
              isSpeaking
                ? "bg-amber-400 text-slate-900 hover:bg-amber-300"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
            }`}
          >
            <span>{isSpeaking ? "⏹️" : "🔊"}</span>
            <span>{isSpeaking ? t.btnStopAudio : t.btnReadAloud}</span>
          </button>
        </div>

        {/* Multi-Language Accessible Selector Bar */}
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <span>🌐 Select Language:</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLanguageChange(l.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
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

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Life-Safety Warning: No Elevators (Soft warm amber - eye-friendly) */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3 text-amber-950">
            <span className="text-2xl shrink-0">🚫🛗</span>
            <div>
              <div className="text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wide">
                {t.noElevators}
              </div>
              <div className="text-xs text-amber-800/90 mt-0.5">
                {t.proceedToStairwell}
              </div>
            </div>
          </div>

          {/* Commander Narrative */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <div className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider flex items-center justify-between">
              <span>FSD COMMANDER BROADCAST DISPATCH</span>
              <span>{alert.timestamp || new Date().toLocaleTimeString()}</span>
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
              {translatedNarrative || alert.narrative}
            </div>
          </div>

          {/* Routing Cards: Stairwell & Exterior Assembly Point */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
              <div className="text-[10px] font-mono font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1">
                <span>🏃‍♂️</span>
                <span>{t.stairwellLabel}</span>
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1">
                {stairwell}
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <span>📍</span>
                <span>{t.assemblyLabel}</span>
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1">
                {assemblyPoint}
              </div>
            </div>
          </div>

          {/* ACTUAL MAP OF THE BUILDING WITHOUT NAMES */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
              <span className="flex items-center gap-1.5">
                <span>🗺️</span>
                <span>Floor 07 Building Map · Egress Navigation</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Architectural CAD · Egress route without occupant names
              </span>
            </div>
            <ActualBuildingFloorMap
              targetQuadrant={currentOccupant?.quadrant || "NW"}
              targetDesk={currentOccupant?.desk}
              targetStairwell={stairwell}
              showEgressPath={true}
            />
          </div>

          {/* Device Push Notification Prompt if not yet granted */}
          {pushPermission === "default" && (
            <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between gap-2 text-xs">
              <span className="text-sky-900 font-medium">
                🔔 Enable instant lock-screen device notifications for drill alarms
              </span>
              <button
                type="button"
                onClick={handleEnablePush}
                className="px-2.5 py-1 bg-[#005DAA] hover:bg-[#004B87] text-white font-bold rounded-lg text-xs cursor-pointer transition"
              >
                Allow Push
              </button>
            </div>
          )}

          {/* Action Feedback Notification */}
          {actionFeedback && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold text-center">
              {actionFeedback}
            </div>
          )}

          {/* Immediate Action Buttons for Occupant */}
          <div className="pt-1 space-y-2">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
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
                className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs border border-emerald-700 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
              >
                <span className="text-lg">🟢</span>
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
                className="p-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs border border-rose-700 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
              >
                <span className="text-lg">🆘</span>
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
                className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs border border-indigo-700 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
              >
                <span className="text-lg">🛞</span>
                <span className="text-center">{t.btnEvacChair}</span>
              </button>
            </div>

            {/* Acknowledge & Minimize Directive */}
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setAcknowledgedAlertId(`${alert.title}-${alert.timestamp}`);
                  setIsMinimized(true);
                  handleStopSpeech();
                }}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-300 cursor-pointer transition"
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

