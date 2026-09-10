/**
 * MusterCommand Advanced Life-Safety Audio Engine
 * - High-Clarity, Natural AI Voice Synthesizer (Human-like, non-robotic, phonetic expansion)
 * - Authentic Commercial PA System Chime (Web Audio API)
 * - Industrial Walkie-Talkie Acoustic Effects (PTT Chirp, Roger Beep, Squelch)
 * - Live Push-to-Talk (PTT) Microphone Recorder & Real-time VU Meter
 */

let audioCtx: AudioContext | null = null;
let sirenOscillator: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;
let isSirenPlaying = false;
let isMuted = false;
let cachedVoices: SpeechSynthesisVoice[] = [];
let preferredVoiceName: string | null = null;

export function getAudioContext(): AudioContext | null {
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

/* ------------------------------------------------------------------ */
/* 1. Authentic PA System Announcement Chime                          */
/* ------------------------------------------------------------------ */

/**
 * Play standard life-safety two-tone acoustic chime (E5 659.25Hz -> A5 880Hz)
 * Precedes voice broadcasts to alert occupants and prime the audio hardware.
 */
export function playPaChime(): Promise<void> {
  if (isMuted) return Promise.resolve();
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      const now = ctx.currentTime;
      const tone1Freq = 659.25; // E5
      const tone2Freq = 880.0;  // A5

      // First Tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(tone1Freq, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Second Tone (higher pitch chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(tone2Freq, now + 0.22);
      gain2.gain.setValueAtTime(0.001, now + 0.22);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.75);

      setTimeout(resolve, 650);
    } catch {
      resolve();
    }
  });
}

/* ------------------------------------------------------------------ */
/* 2. Walkie-Talkie Radio Acoustic Effects (Motorola / Harris APX)    */
/* ------------------------------------------------------------------ */

/**
 * Radio PTT Key-Up Chirp: Authentic chirp played when Warden presses PTT
 */
export function playRadioPttChirp(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.linearRampToValueAtTime(980, now + 0.04);
    osc.frequency.setValueAtTime(980, now + 0.04);
    osc.frequency.linearRampToValueAtTime(1120, now + 0.08);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch {}
}

/**
 * Radio Roger Beep & Squelch Tail: Played when Warden releases PTT
 */
export function playRadioRogerBeep(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1200Hz Courtesy Beep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1209, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    // Subtle Squelch Tail Noise
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.05;
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseGain.gain.setValueAtTime(0.08, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now + 0.08);
  } catch {}
}

/**
 * Incoming Warden Radio Broadcast Alert Tone
 */
export function playRadioIncomingAlert(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1560, now + offset);

      gain.gain.setValueAtTime(0.01, now + offset);
      gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  } catch {}
}

/* ------------------------------------------------------------------ */
/* 3. Siren Generator (Web Audio API)                                 */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 4. High-Clarity, Natural AI Voice Synthesizer                      */
/* ------------------------------------------------------------------ */

// Preload & cache available voices
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

/**
 * Retrieve sorted list of available natural English voices
 */
export function getAvailableNaturalVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }

  const englishVoices = cachedVoices.filter((v) => v.lang.startsWith("en"));

  // Sort by naturalness / neural quality score
  return englishVoices.sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      const name = v.name.toLowerCase();
      if (name.includes("natural") || name.includes("neural") || name.includes("online (natural)")) s += 50;
      if (name.includes("enhanced") || name.includes("premium")) s += 40;
      if (name.includes("google us english") || name.includes("google uk english")) s += 35;
      if (name.includes("samantha") || name.includes("ava") || name.includes("karen") || name.includes("daniel") || name.includes("zoe")) s += 30;
      if (v.lang === "en-US") s += 10;
      if (v.default) s += 5;
      return s;
    };
    return score(b) - score(a);
  });
}

export function setPreferredVoiceName(name: string): void {
  preferredVoiceName = name;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("fsd_preferred_voice", name);
    } catch {}
  }
}

export function getPreferredVoiceName(): string | null {
  if (preferredVoiceName) return preferredVoiceName;
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem("fsd_preferred_voice");
    } catch {}
  }
  return null;
}

/**
 * Phonetically normalize emergency text so the speech engine sounds
 * natural, authoritative, and pauses naturally like a trained dispatcher.
 */
export function normalizeEmergencySpeechText(text: string): string {
  let s = text;

  // Clean Markdown/bold symbols
  s = s.replace(/[*_#`~[\]]/g, "");

  // Expand emergency jargon & abbreviations into articulate words
  const replacements: Array<[RegExp, string]> = [
    [/\bFSD\b/g, "Fire Safety Director"],
    [/\bARA\b/g, "Area of Rescue Assistance"],
    [/\bSitRep\b/g, "Situation Report"],
    [/\bFDNY\b/g, "F D N Y"],
    [/\bPA\b/g, "Public Address"],
    [/\bPTT\b/g, "Push To Talk"],
    [/\bNW\b/g, "Northwest"],
    [/\bNE\b/g, "Northeast"],
    [/\bSW\b/g, "Southwest"],
    [/\bSE\b/g, "Southeast"],
    [/\bStair\s+([A-D])\b/gi, "Staircase $1"],
    [/\bp95\b/gi, "95th percentile"],
    [/\bSq\b/gi, "Square"],
    [/\bPl\b/gi, "Place"],
    [/\bSt\b/gi, "Street"],
    [/\bAve\b/gi, "Avenue"],
    [/\bEvac\b/gi, "Evacuation"],
    [/\bMIA\b/g, "Missing in Action"],
    [/\bFl\b/gi, "Floor"],
    [/\bturnstile\b/gi, "turnstile"],
  ];

  for (const [regex, replacement] of replacements) {
    s = s.replace(regex, replacement);
  }

  // Ensure natural cadence pauses after headings and directives
  s = s.replace(/([.!?])\s+/g, "$1 ... ");
  s = s.replace(/:\s+/g, ": ... ");

  return s;
}

/**
 * Select best available natural voice
 */
function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = getAvailableNaturalVoices();
  if (voices.length === 0) return null;

  const userPref = getPreferredVoiceName();
  if (userPref) {
    const found = voices.find((v) => v.name === userPref);
    if (found) return found;
  }

  return voices[0] || null;
}

export interface SpeakOptions {
  playChime?: boolean;
  rate?: number;
  pitch?: number;
  voiceName?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Speak Emergency Directive aloud with crystal-clear non-robotic synthesis
 */
export async function speakEmergencyBroadcast(
  text: string,
  priority: "CRITICAL" | "HIGH" | "INFO" = "CRITICAL",
  options: SpeakOptions = {}
): Promise<void> {
  if (isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const {
    playChime = true,
    rate = 0.94, // Steady, clear, articulate cadence
    pitch = 0.98, // Natural vocal range (not robotic or squeaky)
    voiceName,
    onStart,
    onEnd,
  } = options;

  try {
    window.speechSynthesis.cancel();

    // Play smooth PA chime first
    if (playChime) {
      await playPaChime();
    }

    const cleanedText = normalizeEmergencySpeechText(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1.0;

    let selectedVoice: SpeechSynthesisVoice | null = null;
    if (voiceName) {
      const all = getAvailableNaturalVoices();
      selectedVoice = all.find((v) => v.name === voiceName) || null;
    }
    if (!selectedVoice) {
      selectedVoice = pickBestVoice();
    }
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis error:", err);
    if (onEnd) onEnd();
  }
}

/**
 * Preview / Test the AI Voice with a sample clear dispatch
 */
export function testAiVoice(voiceName?: string): Promise<void> {
  const sample =
    "This is Con Edison Life Safety Command, Floor 07. All systems are operational. Emergency stairwells Alpha and Bravo remain clear and fully pressurized.";
  return speakEmergencyBroadcast(sample, "HIGH", {
    playChime: true,
    voiceName,
  });
}

/* ------------------------------------------------------------------ */
/* 5. Walkie-Talkie Push-To-Talk (PTT) Recorder & Audio Meter        */
/* ------------------------------------------------------------------ */

export class WalkieTalkieRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioChunks: Blob[] = [];
  private speechRecognition: any = null;
  private liveTranscript: string = "";
  private isRecording: boolean = false;
  private startTime: number = 0;

  public async startRecording(onTranscriptUpdate?: (text: string) => void): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.warn("Microphone access not supported on this platform.");
      return false;
    }

    try {
      this.audioChunks = [];
      this.liveTranscript = "";
      this.isRecording = true;
      this.startTime = Date.now();

      playRadioPttChirp();

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup audio analysis for live VU meter
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
      }

      // Setup MediaRecorder
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      }

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100);

      // Setup Speech Recognition for live spoken distress transcription
      const SpeechRecClass =
        (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecClass) {
        try {
          this.speechRecognition = new SpeechRecClass();
          this.speechRecognition.continuous = true;
          this.speechRecognition.interimResults = true;
          this.speechRecognition.lang = "en-US";

          this.speechRecognition.onresult = (event: any) => {
            let transcript = "";
            for (let i = 0; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript + " ";
            }
            this.liveTranscript = transcript.trim();
            if (onTranscriptUpdate) onTranscriptUpdate(this.liveTranscript);
          };

          this.speechRecognition.onerror = () => {};
          this.speechRecognition.start();
        } catch {}
      }

      return true;
    } catch (err) {
      console.error("Failed to start walkie-talkie recording:", err);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Returns current microphone volume level (0 - 100) for real-time VU meter
   */
  public getLiveVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    // Normalize to 0-100 scale with dynamic headroom
    return Math.min(100, Math.round((average / 128) * 100));
  }

  public stopRecording(): Promise<{
    audioBlob: Blob;
    audioDataUrl: string;
    transcript: string;
    durationSeconds: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error("No active recording"));
      }

      playRadioRogerBeep();

      this.mediaRecorder.onstop = async () => {
        try {
          const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
          const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });

          // Convert blob to base64 Data URL
          const reader = new FileReader();
          reader.onloadend = () => {
            const audioDataUrl = (reader.result as string) || "";
            resolve({
              audioBlob,
              audioDataUrl,
              transcript: this.liveTranscript,
              durationSeconds,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          reject(err);
        } finally {
          this.cleanup();
        }
      };

      try {
        if (this.mediaRecorder.state !== "inactive") {
          this.mediaRecorder.stop();
        }
      } catch {
        this.cleanup();
      }

      if (this.speechRecognition) {
        try {
          this.speechRecognition.stop();
        } catch {}
      }
    });
  }

  public cancel(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.isRecording = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
    this.speechRecognition = null;
  }
}

