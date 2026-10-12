import React, { useState } from "react";
import { EmergencyAlertPayload, Occupant, QuadrantId, StatusSnapshot } from "../../types";
import { speakEmergencyBroadcast, testAiVoice } from "../../lib/audioBroadcast";
import { OccupantSafetyActionModal } from "../OccupantSafetyActionModal";
import {
  EmergencyLanguage,
  SUPPORTED_LANGUAGES,
  translateEmergencyNarrative,
} from "../../lib/emergencyTranslations";

interface Step4BroadcastProps {
  snapshot: StatusSnapshot | null;
  onSendAlert: (alertData: {
    title: string;
    narrative: string;
    priority: "CRITICAL" | "HIGH" | "WARNING";
    targetQuadrants: ("ALL" | QuadrantId)[];
    channels: string[];
  }) => Promise<EmergencyAlertPayload | void>;
  onProceedNext: () => void;
  onOpenWalkieTalkie?: () => void;
  onBackToStep3?: () => void;
  stairwell?: string;
  assemblyPoint?: string;
  onCheckIn?: (
    occupantId: string,
    status: any,
    via?: string,
    notes?: string,
    locationCategory?: any,
    assemblyPoint?: string
  ) => Promise<void>;
}

export const Step4Broadcast: React.FC<Step4BroadcastProps> = ({
  snapshot,
  onSendAlert,
  onProceedNext,
  onOpenWalkieTalkie,
  onBackToStep3,
  stairwell,
  assemblyPoint,
  onCheckIn,
}) => {
  const hazard = snapshot?.hazardType || "office-fire";
  const isIncident = snapshot?.mode === "incident";
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);
  const [selectedOccupantForAction, setSelectedOccupantForAction] = useState<Occupant | null>(null);
  const [previewLang, setPreviewLang] = useState<EmergencyLanguage>("es");

  const resolvedStairwell = stairwell || "Stairwell A (East Core - Union Sq East)";
  const resolvedAssembly = assemblyPoint || "Assembly Point A (Union Sq East / Park Plaza)";

  const defaultTitle = isIncident
    ? `🚨 EMERGENCY EVACUATION: ${hazard.toUpperCase().replace("-", " ")} ON FLOOR 07`
    : `🎯 LIFE-SAFETY DRILL: ${hazard.toUpperCase().replace("-", " ")} EVACUATION EXERCISE`;

  const defaultNarrative = isIncident
    ? `FSD Directive: Immediate evacuation ordered for all Floor 07 personnel due to ${hazard.replace("-", " ")}. Please proceed immediately via ${resolvedStairwell} to ${resolvedAssembly}. Do not use elevators.`
    : `FSD Drill Announcement: Scheduled emergency evacuation drill is now in progress for Floor 07 (${hazard.replace("-", " ")}). Please proceed via ${resolvedStairwell} to ${resolvedAssembly}. All occupants please badge out or self-report safe upon arrival.`;

  const [title, setTitle] = useState<string>(defaultTitle);
  const [narrative, setNarrative] = useState<string>(defaultNarrative);
  const [priority, setPriority] = useState<"CRITICAL" | "HIGH" | "WARNING">(
    isIncident ? "CRITICAL" : "HIGH"
  );
  const [targetAll, setTargetAll] = useState<boolean>(true);
  const [selectedQuadrants, setSelectedQuadrants] = useState<QuadrantId[]>(["NW", "NE", "SW", "SE"]);
  const [channels, setChannels] = useState<{ [key: string]: boolean }>({
    push: true,
    sms: true,
    pa: true,
    signage: true,
  });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [broadcastHistory, setBroadcastHistory] = useState<
    Array<{
      id: string;
      title: string;
      priority: string;
      sentAt: string;
      recipients: number;
      channels: string[];
    }>
  >([]);

  const handleToggleQuadrant = (qid: QuadrantId) => {
    if (selectedQuadrants.includes(qid)) {
      if (selectedQuadrants.length === 1) return; // Keep at least one
      setSelectedQuadrants(selectedQuadrants.filter((q) => q !== qid));
      setTargetAll(false);
    } else {
      const next = [...selectedQuadrants, qid];
      setSelectedQuadrants(next);
      if (next.length === 4) setTargetAll(true);
    }
  };

  const handleToggleAll = (all: boolean) => {
    setTargetAll(all);
    if (all) setSelectedQuadrants(["NW", "NE", "SW", "SE"]);
  };

  const handleTestVoice = async () => {
    setIsPlayingTestVoice(true);
    try {
      await testAiVoice();
    } finally {
      setIsPlayingTestVoice(false);
    }
  };

  const handleDispatch = async () => {
    if (!title.trim() || !narrative.trim()) return;
    setIsSending(true);

    const activeChannels = Object.keys(channels).filter((k) => channels[k]);
    const targetPayload = targetAll ? ["ALL" as const] : selectedQuadrants;

    try {
      const res = await onSendAlert({
        title,
        narrative,
        priority,
        targetQuadrants: targetPayload,
        channels: activeChannels,
      });

      speakEmergencyBroadcast(narrative, priority, { playChime: true });

      const entry = {
        id: `BCST-${Date.now().toString().slice(-4)}`,
        title,
        priority,
        sentAt: new Date().toLocaleTimeString(),
        recipients: snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0,
        channels: activeChannels,
      };

      setBroadcastHistory((prev) => [entry, ...prev]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="step-4-broadcast-container" className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA]" />
            STEP 04 OF 05 · MULTI-CHANNEL EMERGENCY BROADCAST
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#0F2537]">
            Push Emergency Alert to Every Device
          </h2>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Commander broadcasts instant life-safety alerts across all occupant mobile devices, SMS emergency gateways, in-building PA speaker channels, and digital safety displays.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#F0F6FC] px-4 py-2.5 rounded-xl border border-[#CBDCEE] text-right">
            <div className="text-[10px] font-mono font-bold text-[#475569] uppercase">Total Recipients</div>
            <div className="text-xl font-mono font-black text-[#005DAA]">
              {snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0} <span className="text-xs text-[#64748B]">Devices</span>
            </div>
          </div>

          {onBackToStep3 && (
            <button
              type="button"
              id="step4-back-to-step3-btn"
              onClick={onBackToStep3}
              className="px-4 py-3 rounded-xl border border-[#CBDCEE] bg-white hover:bg-[#F0F6FC] text-[#0F2537] font-bold text-xs tracking-wide transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>←</span>
              <span>Step 03 Alarm</span>
            </button>
          )}

          <button
            id="step4-proceed-btn"
            onClick={onProceedNext}
            className="px-5 py-3 rounded-xl bg-[#005DAA] hover:bg-[#004884] text-white font-black text-sm tracking-wide transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Step 05</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Step 3 Active Alarm Coupling Banner */}
      {snapshot?.incidentActive && (
        <div className="bg-linear-to-r from-red-50 via-amber-50 to-blue-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">🚨</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded">
                  {isIncident ? "LIVE EMERGENCY" : "ACTIVE DRILL"}
                </span>
                <span className="text-xs font-black text-[#0F2537] uppercase">
                  {hazard.replace("-", " ")}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                Designated Egress: <strong>{resolvedStairwell}</strong> · Assembly Point: <strong>{resolvedAssembly}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTitle(defaultTitle);
                setNarrative(defaultNarrative);
              }}
              className="px-3 py-1.5 text-xs font-bold text-[#005DAA] hover:bg-blue-100/60 rounded-lg transition border border-blue-200 cursor-pointer"
            >
              Sync Form with Alarm
            </button>
            {onBackToStep3 && (
              <button
                type="button"
                onClick={onBackToStep3}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-lg transition border border-slate-300 cursor-pointer"
              >
                Edit in Step 03
              </button>
            )}
          </div>
        </div>
      )}

      {/* Industrial Walkie-Talkie (PTT) & Natural Voice Station */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Card: Warden Walkie-Talkie Push-to-Talk (8 cols) */}
        <div className="md:col-span-8 bg-gradient-to-r from-[#0B1728] via-[#10243C] to-[#0B1728] rounded-2xl p-5 border-2 border-[#1E3E66] shadow-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-2xl shadow-inner shrink-0">
              📻
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                  <span>Warden Walkie-Talkie Radio Station</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                    LIVE PTT
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
                Authorized Floor Wardens and FSD Chief Commanders can transmit live spoken voice dispatches with real-time acoustic radio effects and live speech transcription directly to all floor occupant devices.
              </p>
            </div>
          </div>

          <button
            id="step4-launch-walkie-btn"
            type="button"
            onClick={onOpenWalkieTalkie}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            <span className="text-base">🎙️</span>
            <span>Key Walkie-Talkie</span>
          </button>
        </div>

        {/* Right Card: AI Voice Clarity Preview (4 cols) */}
        <div className="md:col-span-4 bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider flex items-center gap-1">
                <span>✨</span>
                <span>Natural Voice Engine</span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                PA Chime Active
              </span>
            </div>
            <p className="text-xs text-[#475569]">
              Replaced robotic synthesizer with natural human cadence (0.94 rate), warm vocal authority, and commercial PA acoustic chime.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestVoice}
            disabled={isPlayingTestVoice}
            className="mt-3 w-full py-2.5 bg-[#F0F6FC] hover:bg-[#E2EEF9] border border-[#CBDCEE] text-[#005DAA] font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isPlayingTestVoice ? "🔊 Playing Announcement..." : "🔊 Test Clear AI Voice"}</span>
          </button>
        </div>
      </div>

      {/* Step 3 & 4 Emergency Directive Protocol: WHAT TO SAY & WHAT TO SHOW */}
      <div className="bg-white rounded-2xl p-6 border-2 border-[#005DAA]/40 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="text-[10px] font-mono font-black uppercase text-[#005DAA] tracking-wider flex items-center gap-1.5">
              <span>📢</span>
              <span>STEP 03 &amp; STEP 04 COMMAND PROTOCOL</span>
            </div>
            <h3 className="text-base font-black text-[#0F2537] mt-0.5">
              Emergency Command Directives: What to Say &amp; What to Show
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-sky-100 text-[#005DAA] border border-sky-300 px-2.5 py-1 rounded-full font-bold">
              NYC Fire Code 3 RCNY §401-06
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Box 1: WHAT TO SAY */}
          <div className="bg-[#0C1E36] rounded-2xl p-5 border-2 border-sky-500/50 text-white space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-300 bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded">
                  🎙️ WHAT TO SAY (PA &amp; RADIO SPOKEN SCRIPT)
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  Read aloud via building PA
                </span>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 font-mono text-xs text-amber-100 leading-relaxed select-all">
                &ldquo;{narrative || defaultNarrative}&rdquo;
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() =>
                  speakEmergencyBroadcast(narrative || defaultNarrative, priority, { playChime: true })
                }
                className="px-3.5 py-2 bg-[#005DAA] hover:bg-[#004884] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <span>🔊</span>
                <span>Audio Playback Preview</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(narrative || defaultNarrative);
                }}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>📋</span>
                <span>Copy Script</span>
              </button>
            </div>
          </div>

          {/* Box 2: WHAT TO SHOW */}
          <div className="bg-[#0C1E36] rounded-2xl p-5 border-2 border-red-500/50 text-white space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-red-300 bg-red-950/70 border border-red-500/30 px-2 py-0.5 rounded">
                  📱 WHAT TO SHOW (MOBILE PASS &amp; SIGNAGE DISPLAY)
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  Live Broadcast Preview
                </span>
              </div>

              {/* Mobile Screen Mockup */}
              <div className="bg-gradient-to-br from-red-950 via-slate-900 to-red-900 rounded-xl p-3.5 border border-red-500/70 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black text-red-200">
                  <span className="flex items-center gap-1.5 truncate max-w-[220px]">
                    <span>🚨</span>
                    <span className="truncate">{title || defaultTitle}</span>
                  </span>
                  <span className="text-[10px] font-mono bg-red-600 text-white px-2 py-0.5 rounded shrink-0">
                    {priority}
                  </span>
                </div>

                <p className="text-[11px] text-slate-200 line-clamp-2 bg-black/40 p-2 rounded-lg border border-white/5 font-sans">
                  {narrative || defaultNarrative}
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-black/50 p-2 rounded-lg border border-sky-400/30">
                    <div className="text-slate-400 text-[9px]">PRIMARY STAIRWELL</div>
                    <div className="text-sky-300 font-bold truncate">{resolvedStairwell.split(" (")[0]}</div>
                  </div>
                  <div className="bg-black/50 p-2 rounded-lg border border-red-500/30">
                    <div className="text-slate-400 text-[9px]">ELEVATORS</div>
                    <div className="text-red-400 font-bold">LOCKED OUT 🚫</div>
                  </div>
                </div>

                <div className="bg-black/50 p-2 rounded-lg border border-amber-400/30 text-[11px]">
                  <div className="text-slate-400 text-[9px] font-mono">OUTDOOR MUSTER POINT</div>
                  <div className="text-amber-300 font-bold truncate">{resolvedAssembly}</div>
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-2 border-t border-white/10">
              <span>Pushed to {snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0} active occupant screens</span>
              <span className="text-emerald-400">● Signage Sync Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Composer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Broadcast Composer (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#0F2537] flex items-center gap-2">
              <span>📡</span>
              <span>Emergency Dispatch Message Composer</span>
            </h3>
            <span className="text-xs font-mono text-[#005DAA] bg-[#EBF3FB] px-2.5 py-0.5 rounded font-bold">
              Instant Push Ready
            </span>
          </div>

          {/* Priority Selector */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
              Broadcast Priority Level
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "CRITICAL", label: "🔴 Critical (Immediate Evac)", bg: "bg-red-50 text-red-950 border-red-500" },
                { id: "HIGH", label: "🟠 High (Urgent Action)", bg: "bg-amber-50 text-amber-950 border-amber-500" },
                { id: "WARNING", label: "🟡 Warning (Notice / Drill)", bg: "bg-yellow-50 text-yellow-950 border-yellow-500" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id as any)}
                  className={`p-3 rounded-xl border-2 text-xs font-black transition cursor-pointer text-center ${
                    priority === p.id ? `${p.bg} shadow-xs ring-2 ring-slate-900/10` : "border-slate-200 text-slate-600 bg-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Alert Subject Header *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-black text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              placeholder="e.g. MANDATORY EVACUATION: Office Fire on Floor 07"
            />
          </div>

          {/* Narrative Body */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Evacuation Instructions &amp; Action Directives *
            </label>
            <textarea
              rows={4}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-medium text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              placeholder="Enter exact evacuation instructions for occupants..."
            />
          </div>

          {/* Multi-Language Accessibility & Barrier-Free Transmission Preview */}
          <div className="bg-[#F0F6FC] border border-[#B8D8F8] rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-black text-[#005DAA] uppercase tracking-wider flex items-center gap-1.5">
                <span>🌐</span>
                <span>Multi-Language Accessibility Preview (ESL / Universal Safety)</span>
              </span>
              <div className="flex items-center gap-1">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setPreviewLang(l.code)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      previewLang === l.code
                        ? "bg-[#005DAA] text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-[#CBDCEE]"
                    }`}
                  >
                    {l.flag} {l.code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-[#CBDCEE] text-xs space-y-2">
              <div className="font-bold text-[#0F2537] flex items-center justify-between">
                <span>
                  Preview in {SUPPORTED_LANGUAGES.find((l) => l.code === previewLang)?.name} ({SUPPORTED_LANGUAGES.find((l) => l.code === previewLang)?.nativeName})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
                    window.speechSynthesis.cancel();
                    const meta = SUPPORTED_LANGUAGES.find((l) => l.code === previewLang);
                    const textToSpeak = translateEmergencyNarrative(narrative, previewLang);
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                    utterance.lang = meta?.speechLang || "en-US";
                    utterance.rate = 0.95;
                    const voices = window.speechSynthesis.getVoices();
                    const voice = voices.find((v) => v.lang.startsWith(utterance.lang)) || voices[0];
                    if (voice) utterance.voice = voice;
                    utterance.onstart = () => setIsPlayingTestVoice(true);
                    utterance.onend = () => setIsPlayingTestVoice(false);
                    utterance.onerror = () => setIsPlayingTestVoice(false);
                    window.speechSynthesis.speak(utterance);
                  }}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                >
                  <span>🔊</span>
                  <span>{isPlayingTestVoice ? "Playing Voice..." : "Listen Voice"}</span>
                </button>
              </div>
              <p className="text-[#334155] leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                "{translateEmergencyNarrative(narrative, previewLang)}"
              </p>
              <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                <span>✓</span>
                <span>Automatic multi-language translation, acoustic PA chime, and screen alert will be dispatched to all occupant devices.</span>
              </div>
            </div>
          </div>

          {/* Target Zones */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
              Target Broadcast Zones
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  targetAll
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "bg-[#F0F6FC] text-[#005DAA] border border-[#CBDCEE]"
                }`}
              >
                ✓ ALL FLOOR 07 ({snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0} Personnel)
              </button>

              {(["NW", "NE", "SW", "SE"] as QuadrantId[]).map((qid) => {
                const isSelected = selectedQuadrants.includes(qid);
                return (
                  <button
                    key={qid}
                    type="button"
                    onClick={() => handleToggleQuadrant(qid)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "bg-[#005DAA] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Quadrant {qid}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dispatch Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-[#64748B]">
              Broadcast dispatches in &lt;100ms via Con Ed mesh gateway.
            </div>

            <button
              type="button"
              onClick={handleDispatch}
              disabled={isSending || !title.trim() || !narrative.trim()}
              className="px-8 py-3.5 bg-[#FF6B00] hover:bg-[#FF8533] text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="text-lg">📢</span>
              <span>{isSending ? "Dispatching Broadcast..." : "Send Emergency Alert Now"}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Active Channels & Live Delivery Receipts (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Channels Selector */}
          <div className="bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs space-y-3">
            <h3 className="text-sm font-black text-[#0F2537]">Active Delivery Channels</h3>
            <div className="space-y-2.5 text-xs">
              {[
                { id: "push", label: "Mobile Occupant Web Push", desc: "Instant banner on all smartphones" },
                { id: "sms", label: "SMS Emergency Gateway", desc: "Twilio failover for low data connections" },
                { id: "pa", label: "Building PA Audio Chime", desc: "Floor 07 acoustic tone broadcast" },
                { id: "signage", label: "Digital Signage Displays", desc: "Hallway & elevator screen takeover" },
              ].map((ch) => (
                <label
                  key={ch.id}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#F8FAFC] transition cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={channels[ch.id]}
                    onChange={(e) =>
                      setChannels((prev) => ({ ...prev, [ch.id]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-[#CBDCEE] text-[#005DAA]"
                  />
                  <div>
                    <div className="font-bold text-[#0F2537]">{ch.label}</div>
                    <div className="text-[11px] text-[#64748B]">{ch.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Target Audience: Registered Personnel */}
          <div className="bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#0F2537] flex items-center gap-1.5">
                <span>📱</span>
                <span>Drill Notification Audience</span>
              </h3>
              <span className="text-[10px] font-mono text-[#005DAA] font-bold bg-[#EBF3FB] px-2 py-0.5 rounded">
                {snapshot?.occupants?.length || 0} Registered
              </span>
            </div>

            {(!snapshot?.occupants || snapshot.occupants.length === 0) ? (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold">⚠️ Roster Currently Empty (Ready for Intake)</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  No occupants are currently intaken. Personnel who sign in via the Step 01 QR code, Kiosk, or Quick Intake will appear here and receive direct push alerts and emergency SMS broadcasts.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {snapshot.occupants.map((occ) => (
                  <div key={occ.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#0F2537] flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOccupantForAction(occ)}
                          className="hover:text-[#005DAA] flex items-center gap-1.5 cursor-pointer text-left group"
                          title="Click name to view building location and execute individual life-safety actions"
                        >
                          <span className="group-hover:underline">{occ.name}</span>
                          <span className="text-[9px] bg-sky-100 group-hover:bg-[#005DAA] text-[#005DAA] group-hover:text-white border border-sky-300 px-1 py-0.2 rounded font-mono font-bold transition">
                            🛡️ Action
                          </span>
                        </button>
                        <span className="text-[10px] text-slate-500 font-mono">({occ.id})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                        {occ.phone && occ.phone !== "No phone registered" ? (
                          <a
                            href={`tel:${occ.phone.replace(/[^0-9+]/g, "")}`}
                            className="text-[#005DAA] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                            title="Direct Dial Real Phone Number"
                          >
                            <span>📞</span>
                            <span>{occ.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">No phone registered</span>
                        )}
                        <span>· Sector {occ.quadrant}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded">
                      {occ.phone ? "SMS + PUSH" : "PORTAL PUSH"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Broadcast Delivery History */}
          <div className="bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs space-y-3">
            <h3 className="text-sm font-black text-[#0F2537] flex items-center justify-between">
              <span>Dispatch Receipts</span>
              <span className="text-[10px] font-mono text-[#005DAA] font-bold">
                {broadcastHistory.length} Sent
              </span>
            </h3>

            {broadcastHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBDCEE]">
                No broadcasts sent yet during this session. Send an alert above to verify delivery.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {broadcastHistory.map((bc) => (
                  <div
                    key={bc.id}
                    className="p-3 bg-[#F0F6FC] rounded-xl border border-[#CBDCEE] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-[#0F2537]">
                      <span className="truncate max-w-[160px]">{bc.title}</span>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                        ✓ Delivered
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono">
                      <span>{bc.sentAt}</span>
                      <span>{bc.recipients} Recipients</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Individual Occupant Safety Action Modal */}
      <OccupantSafetyActionModal
        occupant={selectedOccupantForAction}
        onClose={() => setSelectedOccupantForAction(null)}
        onCheckIn={onCheckIn}
      />
    </div>
  );
};
