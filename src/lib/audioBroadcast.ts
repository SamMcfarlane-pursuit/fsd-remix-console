/**
 * Web Speech API Voice Synthesizer & Web Audio API Life-Safety Siren Generator
 * 100% Free, Zero-Cost, In-Browser Audio Engine (Zero external audio file dependencies)
 */

let audioCtx: AudioContext | null = null;
let sirenOscillator: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;
let isSirenPlaying = false;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setAudioMuted(muted: boolean): void {
  isMuted = muted;
  if (muted && isSirenPlaying) {
    stopAlarmSiren();
  }
  if (muted && typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function getAudioMuted(): boolean {
  return isMuted;
}

/**
 * Play synthesized FDNY emergency alarm siren sweep (Web Audio API)
 */
export function playAlarmSiren(durationSeconds: number = 6): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    stopAlarmSiren();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    const now = ctx.currentTime;

    // Siren frequency sweep: 520Hz to 960Hz warble
    osc.frequency.setValueAtTime(520, now);
    for (let t = 0; t < durationSeconds; t += 0.8) {
      osc.frequency.linearRampToValueAtTime(960, now + t + 0.4);
      osc.frequency.linearRampToValueAtTime(520, now + t + 0.8);
    }

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.setValueAtTime(0.25, now + durationSeconds - 0.3);
    gain.gain.linearRampToValueAtTime(0.001, now + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSeconds);

    sirenOscillator = osc;
    sirenGain = gain;
    isSirenPlaying = true;

    osc.onended = () => {
      isSirenPlaying = false;
      sirenOscillator = null;
      sirenGain = null;
    };
  } catch (err) {
    console.warn("Synthesized siren error:", err);
  }
}

export function stopAlarmSiren(): void {
  try {
    if (sirenOscillator) {
      sirenOscillator.stop();
      sirenOscillator.disconnect();
      sirenOscillator = null;
    }
    if (sirenGain) {
      sirenGain.disconnect();
      sirenGain = null;
    }
    isSirenPlaying = false;
  } catch {}
}

/**
 * Speak Emergency Directive aloud using the browser's Web Speech API
 */
export function speakEmergencyBroadcast(text: string, priority: "CRITICAL" | "HIGH" | "INFO" = "CRITICAL"): void {
  if (isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel(); // Stop any pending utterances

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = priority === "CRITICAL" ? 1.05 : 1.0;
    utterance.pitch = priority === "CRITICAL" ? 1.1 : 1.0;
    utterance.volume = 1.0;

    // Pick English US voice if available
    const voices = window.speechSynthesis.getVoices();
    const usVoice = voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en"));
    if (usVoice) {
      utterance.voice = usVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis error:", err);
  }
}
