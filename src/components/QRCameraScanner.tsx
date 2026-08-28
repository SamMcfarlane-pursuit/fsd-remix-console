import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";

interface QRCameraScannerProps {
  onScanSuccess: (decodedText: string, action: "enter" | "leave" | "muster") => void;
  onClose?: () => void;
  stationName?: string;
  defaultAction?: "enter" | "leave" | "muster";
}

export const QRCameraScanner: React.FC<QRCameraScannerProps> = ({
  onScanSuccess,
  onClose,
  stationName = "Station #07-Muster",
  defaultAction = "enter",
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [presenceAction, setPresenceAction] = useState<"enter" | "leave" | "muster">(defaultAction);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Play audio chime on successful scan
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(presenceAction === "leave" ? 600 : 880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(presenceAction === "leave" ? 440 : 1760, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      }
    } catch {
      // Audio not permitted
    }
  };

  // Enumerate video devices
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0 && !selectedCameraId) {
          const backCam = videoDevices.find((d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
          setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
        }
      }).catch((err) => {
        console.warn("Camera enumeration error:", err);
      });
    }
  }, []);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
        startScanLoop();
      }
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission was denied. Please allow camera access or use the manual badge input below."
          : `Camera could not be started: ${err.message || "Device not found"}. Use manual badge sign-in.`
      );
      setCameraActive(false);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [selectedCameraId]);

  // Frame processing loop with jsQR
  const startScanLoop = () => {
    const scanFrame = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code && code.data && code.data.trim()) {
              let text = code.data.trim();
              // Parse URL or badge payload if applicable
              try {
                if (text.startsWith("http://") || text.startsWith("https://")) {
                  const parsedUrl = new URL(text);
                  const paramId = parsedUrl.searchParams.get("id") || parsedUrl.searchParams.get("badge") || parsedUrl.searchParams.get("token");
                  if (paramId) text = paramId;
                }
              } catch {}

              const badgeMatch = text.match(/CONED-BADGE-(OCC-\d+|VIS-\d+|[A-Za-z0-9_-]+)/i);
              if (badgeMatch && badgeMatch[1]) {
                text = badgeMatch[1];
              }

              playBeep();
              setIsProcessing(true);
              onScanSuccess(text, presenceAction);
              setTimeout(() => {
                setIsProcessing(false);
              }, 1800);
            }
          } catch (e) {
            console.warn("QR decode error:", e);
          }
        }
      }
      animationFrameId.current = requestAnimationFrame(scanFrame);
    };
    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playBeep();
    onScanSuccess(manualCode.trim(), presenceAction);
    setManualCode("");
  };

  return (
    <div className="bg-[#0A1A2E] text-white rounded-2xl border-2 border-[#005DAA] p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header with Presence Intent Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E3A60] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📷</span>
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sky-400">
              Live Optical QR Scanner & Presence Reader
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              LOCATION: {stationName}
            </p>
          </div>
        </div>

        {/* Presence Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#0F2537] p-1 rounded-xl border border-[#1E3A60]">
          <button
            type="button"
            onClick={() => setPresenceAction("enter")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1 ${
              presenceAction === "enter"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🟢</span>
            <span>ENTER FLOOR</span>
          </button>
          <button
            type="button"
            onClick={() => setPresenceAction("leave")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1 ${
              presenceAction === "leave"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>⚪</span>
            <span>LEAVE BUILDING</span>
          </button>
          <button
            type="button"
            onClick={() => setPresenceAction("muster")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1 ${
              presenceAction === "muster"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🚩</span>
            <span>MUSTER</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-1 w-6 h-6 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-xs font-bold transition cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Video Viewport / Scanner Reticle */}
      <div className="relative w-full aspect-[4/3] max-h-[320px] bg-black rounded-xl overflow-hidden border-2 border-[#1E3A60] flex items-center justify-center">
        <canvas ref={canvasRef} className="hidden" />

        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${cameraActive ? "opacity-100" : "opacity-0"}`}
        />

        {/* Camera Off / Error State */}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-3 bg-[#0A1A2E]/90 z-10">
            <span className="text-3xl">📷</span>
            <div className="text-xs font-bold text-slate-300 max-w-xs">
              {cameraError || "Initializing camera stream..."}
            </div>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-[#005DAA] text-white rounded-lg text-xs font-bold hover:bg-[#004A88] transition cursor-pointer"
            >
              🔄 Retry Camera Stream
            </button>
          </div>
        )}

        {/* Reticle Overlay */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="absolute inset-0 bg-black/20" />

            <div className={`relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed rounded-2xl flex items-center justify-center ${
              presenceAction === "leave" ? "border-amber-400" : presenceAction === "muster" ? "border-sky-400" : "border-emerald-400"
            }`}>
              <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg ${presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"}`} />
              <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg ${presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"}`} />
              <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg ${presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"}`} />
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-lg ${presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"}`} />

              <div className={`absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent ${
                presenceAction === "leave" ? "via-amber-400 shadow-[0_0_12px_#F59E0B]" : "via-emerald-400 shadow-[0_0_12px_#34D399]"
              } to-transparent animate-scan-laser`} />

              {isProcessing && (
                <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider animate-bounce shadow-lg ${
                  presenceAction === "leave" ? "bg-amber-500 text-slate-950" : "bg-emerald-500 text-slate-950"
                }`}>
                  ✓ {presenceAction === "leave" ? "LEFT BUILDING RECORDED" : "IN BUILDING RECORDED"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live HUD Status Pill */}
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-700 text-[10px] font-mono flex items-center gap-1.5 z-20">
          <span className={`w-2 h-2 rounded-full animate-pulse ${presenceAction === "leave" ? "bg-amber-400" : "bg-emerald-400"}`} />
          <span className={presenceAction === "leave" ? "text-amber-400" : "text-emerald-400"}>
            MODE: {presenceAction === "leave" ? "BADGE OUT (LEAVE BUILDING)" : presenceAction === "muster" ? "MUSTER POINT EVAC" : "BADGE IN (ENTER FLOOR 07)"}
          </span>
        </div>

        {availableCameras.length > 1 && (
          <div className="absolute bottom-3 right-3 z-20">
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="bg-black/80 text-white text-[11px] font-mono px-2 py-1 rounded border border-slate-700 focus:outline-none"
            >
              {availableCameras.map((cam, idx) => (
                <option key={cam.deviceId || idx} value={cam.deviceId}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Manual Input Fallback */}
      <form onSubmit={handleManualSubmit} className="space-y-2">
        <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
          <span>Direct Badge ID, Phone Number, or Name</span>
          <span className="text-sky-400 font-mono text-[10px]">e.g. OCC-101, (212) 555-0110, or Name</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Type badge, phone #, or name..."
            className="flex-1 bg-[#0F2537] border border-[#1E3A60] rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className={`px-4 py-2 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50 ${
              presenceAction === "leave" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {presenceAction === "leave" ? "LEAVE" : "ENTER"}
          </button>
        </div>
      </form>
    </div>
  );
};
