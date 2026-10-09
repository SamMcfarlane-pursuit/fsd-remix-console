import React, { useState, useEffect, useRef } from "react";
import { AuthUser, QuadrantId, StatusSnapshot, WalkieTalkieBroadcast } from "../types";
import {
  WalkieTalkieRecorder,
  playRadioIncomingAlert,
  getAvailableNaturalVoices,
  setPreferredVoiceName,
  getPreferredVoiceName,
  testAiVoice,
} from "../lib/audioBroadcast";

interface WalkieTalkieModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  snapshot: StatusSnapshot | null;
  onBroadcastSent?: (broadcast: WalkieTalkieBroadcast) => void;
}

export const WalkieTalkieModal: React.FC<WalkieTalkieModalProps> = ({
  isOpen,
  onClose,
  authUser,
  snapshot,
  onBroadcastSent,
}) => {
  // Authorization state: Warden or Commander role required
  const isAuthorizedByDefault =
    authUser?.role === "warden" ||
    authUser?.role === "commander" ||
    authUser?.role === "fsd_director";

  const [isUnlocked, setIsUnlocked] = useState<boolean>(isAuthorizedByDefault);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  // Radio transmitter settings
  const [selectedChannel, setSelectedChannel] = useState<QuadrantId | "ALL">("ALL");
  const [distressLevel, setDistressLevel] = useState<
    "CRITICAL_DISTRESS" | "EVACUATION_ORDER" | "SITREP" | "ALL_CLEAR"
  >("CRITICAL_DISTRESS");
  const [senderName, setSenderName] = useState<string>(() => {
    if (authUser?.name) return authUser.name;
    return authUser?.role === "warden"
      ? "Deputy Warden Marcus Vance (Floor 07)"
      : "FSD Chief Commander";
  });
  const [senderBadge, setSenderBadge] = useState<string>(() => {
    return authUser?.role === "warden" ? "W-07-ALPHA" : "FSD-CHIEF-01";
  });

  // Recording & PTT State
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [isHandsFreeLatch, setIsHandsFreeLatch] = useState<boolean>(false);
  const [liveVolume, setLiveVolume] = useState<number>(0);
  const [transmissionSeconds, setTransmissionSeconds] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Audio Playback for preview / review
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [broadcastLog, setBroadcastLog] = useState<WalkieTalkieBroadcast[]>([]);

  // AI Voice Clarity Tab
  const [activeTab, setActiveTab] = useState<"walkie" | "voice_settings">("walkie");
  const [naturalVoices, setNaturalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [isTestingVoice, setIsTestingVoice] = useState<boolean>(false);

  const recorderRef = useRef<WalkieTalkieRecorder | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    setIsUnlocked(isAuthorizedByDefault);
  }, [isAuthorizedByDefault, authUser]);

  useEffect(() => {
    if (isOpen) {
      const voices = getAvailableNaturalVoices();
      setNaturalVoices(voices);
      const pref = getPreferredVoiceName() || (voices[0] ? voices[0].name : "");
      setSelectedVoice(pref);
    }
  }, [isOpen]);

  // Clean up recording if modal closes
  useEffect(() => {
    if (!isOpen && isTransmitting) {
      handleStopTransmission(false);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen]);

  // Handle PIN Unlock for non-warden users
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "2026") {
      setIsUnlocked(true);
      setSenderName("Deputy Warden (Floor 07)");
      setSenderBadge("W-07-DEPUTY");
      setPinError("");
    } else if (pinInput === "7007") {
      setIsUnlocked(true);
      setSenderName("FSD Chief Commander");
      setSenderBadge("FSD-CHIEF-01");
      setPinError("");
    } else {
      setPinError("Invalid Emergency Radio PIN. (Warden: 2026, Commander: 7007)");
    }
  };

  // Start Transmission (Key-Up)
  const handleStartTransmission = async () => {
    if (isTransmitting || isDispatching) return;
    setStatusMessage(null);
    setRecordedAudioUrl(null);
    setLiveTranscript("");
    setTransmissionSeconds(0);

    const rec = new WalkieTalkieRecorder();
    recorderRef.current = rec;

    const started = await rec.startRecording((transcript) => {
      setLiveTranscript(transcript);
    });

    if (!started) {
      setStatusMessage({
        type: "error",
        text: "Could not access microphone. Please check browser permissions.",
      });
      return;
    }

    setIsTransmitting(true);

    // Track transmission duration
    timerIntervalRef.current = setInterval(() => {
      setTransmissionSeconds((s) => s + 1);
    }, 1000);

    // Audio VU Meter loop
    const updateMeter = () => {
      if (recorderRef.current) {
        setLiveVolume(recorderRef.current.getLiveVolume());
        animFrameRef.current = requestAnimationFrame(updateMeter);
      }
    };
    animFrameRef.current = requestAnimationFrame(updateMeter);
  };

  // Stop Transmission & Broadcast (Key-Down)
  const handleStopTransmission = async (dispatchToServer = true) => {
    if (!isTransmitting || !recorderRef.current) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsTransmitting(false);
    setLiveVolume(0);

    try {
      const result = await recorderRef.current.stopRecording();
      setRecordedAudioUrl(result.audioDataUrl);

      if (dispatchToServer) {
        await broadcastAudio(result.audioDataUrl, result.transcript, result.durationSeconds);
      }
    } catch (err) {
      console.warn("Failed stopping walkie-talkie:", err);
    } finally {
      recorderRef.current = null;
    }
  };

  // Dispatch live audio broadcast to server & occupants
  const broadcastAudio = async (
    audioDataUrl: string,
    transcriptText: string,
    durationSec: number
  ) => {
    setIsDispatching(true);
    setStatusMessage({ type: "info", text: "Transmitting emergency distress audio to all floor devices..." });

    try {
      const res = await fetch("/api/walkie-talkie/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName,
          senderRole: authUser?.role === "warden" ? "warden" : "commander",
          senderBadge,
          audioData: audioDataUrl,
          transcript: transcriptText.trim() || `Live Warden verbal distress broadcast for quadrant ${selectedChannel}.`,
          distressLevel,
          quadrant: selectedChannel,
          durationSeconds: durationSec,
          pin: pinInput || (authUser?.role === "warden" ? "2026" : "7007"),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed broadcasting walkie-talkie distress");
      }

      const data = await res.json();
      if (data.broadcast) {
        setBroadcastLog((prev) => [data.broadcast, ...prev]);
        if (onBroadcastSent) onBroadcastSent(data.broadcast);
      }

      setStatusMessage({
        type: "success",
        text: `✓ Distress voice transmission dispatched to ${snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0} personnel on Floor 07!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to dispatch walkie-talkie broadcast.",
      });
    } finally {
      setIsDispatching(false);
    }
  };

  // Test AI Voice preview
  const handleTestAiVoice = async () => {
    setIsTestingVoice(true);
    try {
      await testAiVoice(selectedVoice);
    } finally {
      setIsTestingVoice(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="walkie-talkie-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#0B1522] border-2 border-[#1E3A5F] text-slate-100 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Radio Handset Header */}
        <div className="bg-gradient-to-r from-[#0F2338] via-[#162F4A] to-[#0F2338] px-5 py-4 border-b border-[#254B75] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-xl shadow-inner">
              📻
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                  <span>Warden Walkie-Talkie</span>
                  <span className="text-amber-400 text-xs font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    LIVE PTT
                  </span>
                </h2>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Direct Two-Way Emergency Voice Dispatch · Floor 07 Life-Safety Mesh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch between Walkie Talkie & AI Voice settings */}
            <div className="bg-[#0A1828] p-1 rounded-xl border border-slate-700 flex text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("walkie")}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  activeTab === "walkie"
                    ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🎙️ Radio PTT
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("voice_settings")}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  activeTab === "voice_settings"
                    ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🔊 AI Voice Clarity
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Close radio transmitter"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Authorization Check Guard */}
          {!isUnlocked ? (
            <div className="bg-[#101F33] border border-amber-500/40 rounded-2xl p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-3xl">
                🔒
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Restricted Radio Transmission Authorization
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
                  Life-safety voice broadcasting is strictly restricted to verified Floor Wardens and FSD Chief Commanders to prevent unauthorized evacuation panics.
                </p>
              </div>

              <form onSubmit={handleVerifyPin} className="max-w-xs mx-auto space-y-3">
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError("");
                  }}
                  placeholder="Enter 4-Digit PIN (Warden: 2026)"
                  className="w-full text-center tracking-[0.4em] font-mono text-xl py-3 px-4 bg-[#0A1424] border border-amber-400/50 rounded-xl text-amber-300 placeholder:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                />

                {pinError && (
                  <div className="text-xs text-rose-400 font-bold">{pinError}</div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
                >
                  Unlock Transmitter Handset
                </button>
              </form>

              <div className="text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                Floor 07 Warden PIN: <strong className="text-amber-300">2026</strong> · FSD Commander PIN: <strong className="text-amber-300">7007</strong>
              </div>
            </div>
          ) : activeTab === "walkie" ? (
            /* ACTIVE WALKIE-TALKIE PTT INTERFACE */
            <div className="space-y-5">
              {/* Radio Identity & Channel Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0A1626] p-4 rounded-2xl border border-[#1A3352]">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                    TRANSMITTING CALLSIGN / WARDEN
                  </label>
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>{senderName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({senderBadge})</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                    RADIO CHANNEL / TARGET ZONE
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value as any)}
                    className="w-full bg-[#102238] border border-[#23456D] text-xs font-bold text-white rounded-xl p-2 outline-hidden focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="ALL">📻 CH 07: ALL FLOOR 07 ({snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0} Personnel)</option>
                    <option value="NW">📡 CH 01: NW CORRIDOR &amp; LABS</option>
                    <option value="NE">📡 CH 02: NE OPERATIONS</option>
                    <option value="SW">📡 CH 03: SW CORE &amp; STAIR A</option>
                    <option value="SE">📡 CH 04: SE EXECUTIVE &amp; STAIR B</option>
                  </select>
                </div>
              </div>

              {/* Distress Severity Selector */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                  VERBAL DISTRESS CATEGORY
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    {
                      id: "CRITICAL_DISTRESS",
                      label: "🚨 Critical Distress",
                      desc: "Imminent Hazard",
                      color: "border-red-500 bg-red-950/40 text-red-200",
                    },
                    {
                      id: "EVACUATION_ORDER",
                      label: "⚠️ Evac Directive",
                      desc: "Move to Stair A/B",
                      color: "border-amber-500 bg-amber-950/40 text-amber-200",
                    },
                    {
                      id: "SITREP",
                      label: "ℹ️ Warden SitRep",
                      desc: "Floor Status",
                      color: "border-sky-500 bg-sky-950/40 text-sky-200",
                    },
                    {
                      id: "ALL_CLEAR",
                      label: "🟢 All Clear",
                      desc: "Stand Down",
                      color: "border-emerald-500 bg-emerald-950/40 text-emerald-200",
                    },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDistressLevel(d.id as any)}
                      className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                        distressLevel === d.id
                          ? `${d.color} ring-2 ring-white/20 font-black`
                          : "border-slate-800 bg-[#0A1424] text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="font-bold text-[11px] leading-tight">{d.label}</div>
                      <div className="text-[9px] opacity-75 mt-0.5">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Central Industrial PTT Push-To-Talk Console */}
              <div className="bg-gradient-to-b from-[#13283F] via-[#0E1E30] to-[#0A1420] border-2 border-[#204369] rounded-3xl p-6 text-center space-y-5 shadow-2xl relative">
                {/* On-Air Beacon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        isTransmitting
                          ? "bg-red-500 animate-ping"
                          : "bg-slate-700"
                      }`}
                    />
                    <span
                      className={`text-xs font-mono font-black tracking-widest uppercase ${
                        isTransmitting ? "text-red-400 animate-pulse" : "text-slate-500"
                      }`}
                    >
                      {isTransmitting ? "● LIVE TRANSMITTING ON AIR" : "STANDBY · READY TO KEY MIC"}
                    </span>
                  </div>

                  {/* Mode toggle: Hold to Talk vs Hands-free Latch */}
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isHandsFreeLatch}
                      onChange={(e) => setIsHandsFreeLatch(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500"
                    />
                    <span>Hands-Free Latch</span>
                  </label>
                </div>

                {/* Real-time Dynamic LED VU Audio Meter */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>MIC INPUT LEVEL</span>
                    <span>{isTransmitting ? `${liveVolume}%` : "OFF AIR"}</span>
                  </div>
                  <div className="grid grid-cols-20 gap-1 h-3 bg-black/60 p-1 rounded-lg border border-slate-800">
                    {Array.from({ length: 20 }).map((_, idx) => {
                      const threshold = (idx + 1) * 5;
                      const isActive = isTransmitting && liveVolume >= threshold;
                      let color = "bg-emerald-500";
                      if (idx >= 14) color = "bg-amber-400";
                      if (idx >= 17) color = "bg-red-500";

                      return (
                        <div
                          key={idx}
                          className={`rounded-xs transition-colors duration-75 ${
                            isActive ? `${color} shadow-xs shadow-${color}` : "bg-slate-800/60"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Big Ergonomic PTT Push-To-Talk Button */}
                <div className="py-2">
                  <button
                    id="walkie-talkie-ptt-button"
                    type="button"
                    disabled={isDispatching}
                    onMouseDown={() => {
                      if (!isHandsFreeLatch) handleStartTransmission();
                    }}
                    onMouseUp={() => {
                      if (!isHandsFreeLatch) handleStopTransmission(true);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      if (!isHandsFreeLatch) handleStartTransmission();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      if (!isHandsFreeLatch) handleStopTransmission(true);
                    }}
                    onClick={() => {
                      if (isHandsFreeLatch) {
                        if (isTransmitting) {
                          handleStopTransmission(true);
                        } else {
                          handleStartTransmission();
                        }
                      }
                    }}
                    className={`w-44 h-44 mx-auto rounded-full border-4 flex flex-col items-center justify-center transition-all duration-150 select-none shadow-2xl cursor-pointer ${
                      isTransmitting
                        ? "bg-gradient-to-b from-red-600 to-red-800 border-red-300 scale-95 ring-8 ring-red-500/30 text-white animate-pulse"
                        : "bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 border-amber-300 text-slate-950 active:scale-95 shadow-amber-500/20"
                    }`}
                  >
                    <span className="text-4xl mb-1">
                      {isTransmitting ? "🎙️" : "📻"}
                    </span>
                    <span className="text-sm font-black uppercase tracking-wider">
                      {isTransmitting ? "TRANSMITTING" : "PUSH TO TALK"}
                    </span>
                    <span className="text-[10px] font-mono font-bold opacity-80 mt-0.5">
                      {isHandsFreeLatch
                        ? isTransmitting ? "CLICK TO RELEASE" : "CLICK TO TALK"
                        : isTransmitting ? "RELEASE TO DISPATCH" : "HOLD TO SPEAK"}
                    </span>
                    {isTransmitting && (
                      <span className="text-xs font-mono font-black mt-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/20">
                        {String(Math.floor(transmissionSeconds / 60)).padStart(2, "0")}:
                        {String(transmissionSeconds % 60).padStart(2, "0")}
                      </span>
                    )}
                  </button>
                </div>

                {/* Spoken Distress Live ADA Transcript */}
                <div className="bg-[#07101B] border border-slate-800 rounded-2xl p-4 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📝</span>
                      <span>LIVE SPOKEN DISTRESS TRANSCRIPTION (ADA ACCESSIBLE)</span>
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">Auto Speech-to-Text</span>
                  </div>

                  <div className="min-h-[44px] text-xs text-slate-200 font-medium leading-relaxed italic bg-black/30 p-2.5 rounded-xl border border-white/5">
                    {liveTranscript ||
                      (isTransmitting
                        ? "Listening to your voice... Speak clearly into the microphone."
                        : "Hold the PTT button to speak. Your verbal distress instructions will be transcribed here and broadcast in real-time.")}
                  </div>
                </div>

                {/* Status message */}
                {statusMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold text-center animate-fadeIn ${
                      statusMessage.type === "success"
                        ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300"
                        : statusMessage.type === "error"
                        ? "bg-red-500/20 border border-red-400/40 text-red-300"
                        : "bg-sky-500/20 border border-sky-400/40 text-sky-300"
                    }`}
                  >
                    {statusMessage.text}
                  </div>
                )}

                {/* Recorded Audio Replay Preview */}
                {recordedAudioUrl && !isTransmitting && (
                  <div className="bg-[#091524] p-3 rounded-xl border border-[#1F3D61] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔊</span>
                      <span className="font-bold text-slate-300">Last Transmission Preview</span>
                    </div>
                    <audio src={recordedAudioUrl} controls className="h-8 max-w-[240px]" />
                  </div>
                )}
              </div>

              {/* Radio Transmission Audit Log */}
              {broadcastLog.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Recent Distress Transmissions ({broadcastLog.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {broadcastLog.map((b) => (
                      <div
                        key={b.id}
                        className="bg-[#0A1424] border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-amber-300">{b.senderName}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(b.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-[9px] font-mono bg-red-950 text-red-300 px-1.5 py-0.5 rounded border border-red-800">
                              {b.distressLevel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 truncate mt-0.5">
                            "{b.transcript}"
                          </p>
                        </div>
                        {b.audioUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              const aud = new Audio(b.audioUrl);
                              aud.play().catch(() => {});
                            }}
                            className="px-3 py-1 bg-[#162D4A] hover:bg-[#1E3B61] text-amber-300 rounded-lg font-bold text-[11px] shrink-0 cursor-pointer"
                          >
                            ▶ Replay
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* AI VOICE CLARITY & NATURAL SPEECH CONFIGURATION TAB */
            <div className="space-y-5">
              <div className="bg-[#0A1626] p-5 rounded-2xl border border-[#1A3352] space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">✨</span>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      Natural Neural Voice Synthesizer
                    </h3>
                    <p className="text-xs text-slate-300">
                      Eliminates robotic mechanical speech. Uses natural vocal pitch, steady deliberate pacing (94%), phonetic emergency expansions, and commercial PA chime acoustics.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Select Natural English Voice
                    </label>
                    <select
                      value={selectedVoice}
                      onChange={(e) => {
                        setSelectedVoice(e.target.value);
                        setPreferredVoiceName(e.target.value);
                      }}
                      className="w-full bg-[#102238] border border-[#23456D] text-xs font-bold text-white rounded-xl p-3 outline-hidden focus:ring-1 focus:ring-amber-400"
                    >
                      {naturalVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang}) {v.name.includes("Natural") || v.name.includes("Enhanced") ? "★ Premium Natural" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-[#0D1E33] p-3.5 rounded-xl border border-sky-500/20 text-xs text-sky-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <span>🔔</span>
                      <span>Commercial PA Announcement Chime (Two-Tone E5 → A5):</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Standard life-safety public address systems play an acoustic harmonic chime before any voice dispatch to clear the airwaves and alert building occupants.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestAiVoice}
                    disabled={isTestingVoice}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isTestingVoice ? "🔊 Playing Sample Announcement..." : "🔊 Preview AI Voice Clarity"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#0B1522] border-t border-[#1C3554] p-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono">NYC 3 RCNY §401-06 Voice Standard Compliant</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
          >
            Close Transmitter
          </button>
        </div>
      </div>
    </div>
  );
};
