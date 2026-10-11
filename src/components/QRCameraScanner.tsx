import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { parseQRData } from "../lib/qr";
import { triggerHaptic } from "../lib/haptics";

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
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [presenceAction, setPresenceAction] = useState<"enter" | "leave" | "muster">(defaultAction);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanTimestamp = useRef<number>(0);
  const isScanningActive = useRef<boolean>(false);

  // Play audio chime and trigger mobile vibration on successful scan
  const playBeep = useCallback(() => {
    triggerHaptic(presenceAction === "leave" ? "warning" : "success");
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
  }, [presenceAction]);

  // Unified QR Data Handler with Debounce
  const handleDecodedString = useCallback(
    (rawDecoded: string) => {
      const now = Date.now();
      // Debounce duplicate scans within 1800ms
      if (now - lastScanTimestamp.current < 1800) {
        return;
      }
      lastScanTimestamp.current = now;

      const trimmed = rawDecoded.trim();
      if (!trimmed) return;

      const parsed = parseQRData(trimmed);
      const textToSend =
        parsed.occupantId ||
        parsed.badgeCode ||
        parsed.token ||
        parsed.stationName ||
        parsed.name ||
        parsed.phone ||
        trimmed;

      setLastScannedResult(textToSend);
      setIsProcessing(true);
      playBeep();

      onScanSuccess(textToSend, presenceAction);

      setTimeout(() => {
        setIsProcessing(false);
      }, 1800);
    },
    [onScanSuccess, playBeep, presenceAction]
  );

  // Decode Image using Native BarcodeDetector or jsQR
  const decodeImageElement = async (img: HTMLImageElement): Promise<string | null> => {
    // 1. Try Hardware BarcodeDetector if supported
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "data_matrix", "code_128", "code_39", "ean_13"],
        });
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch (e) {
        console.warn("BarcodeDetector image decode failed, falling back to jsQR:", e);
      }
    }

    // 2. Fallback to Canvas + jsQR
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try normal and inverted
    let code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (!code) {
      code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
    }

    return code?.data || null;
  };

  // Handle Photo Capture / QR Image File Upload Fallback
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const detected = await decodeImageElement(img);
          if (detected) {
            setCameraError(null);
            handleDecodedString(detected);
          } else {
            setCameraError(
              "⚠️ Could not detect a valid QR code in the uploaded photo. Please hold the camera closer or enter your badge/phone below."
            );
          }
        } catch {
          setCameraError("Failed to decode photo. Please enter your badge or phone number manually below.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input value so user can upload/snap again if needed
    e.target.value = "";
  };

  // Enumerate video devices
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          setAvailableCameras(videoDevices);
          if (videoDevices.length > 0 && !selectedCameraId) {
            const backCam = videoDevices.find(
              (d) =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("environment") ||
                d.label.toLowerCase().includes("rear")
            );
            if (backCam) {
              setSelectedCameraId(backCam.deviceId);
            }
          }
        })
        .catch((err) => {
          console.warn("Camera enumeration error:", err);
        });
    }
  }, [selectedCameraId]);

  // Resilient Progressive Camera Stream Initializer
  const getResilientMediaStream = async (
    targetCameraId?: string,
    targetFacing: "environment" | "user" = "environment"
  ): Promise<MediaStream> => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      throw new Error("CAMERA_UNSUPPORTED_PROTOCOL");
    }

    // Attempt 1: Exact deviceId if selected
    if (targetCameraId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: targetCameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        console.warn("Exact deviceId camera request failed, falling back:", err);
      }
    }

    // Attempt 2: Ideal facingMode and 720p resolution
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      console.warn("Ideal facingMode camera request failed, trying simple facingMode:", err);
    }

    // Attempt 3: Simple facingMode string
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: targetFacing },
        audio: false,
      });
    } catch (err) {
      console.warn("Simple facingMode failed, falling back to any video stream:", err);
    }

    // Attempt 4: Any camera stream available on the device
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await getResilientMediaStream(selectedCameraId, facingMode);
      streamRef.current = stream;

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() || {}) as any;
      setHasTorch(Boolean(capabilities?.torch));
      setTorchOn(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Autoplay error, awaiting interaction:", playErr);
        }
        setCameraActive(true);
        startScanLoop();
      }
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      setCameraActive(false);

      if (err.message === "CAMERA_UNSUPPORTED_PROTOCOL") {
        setCameraError(
          "Camera streaming requires HTTPS or Localhost. Use the '📸 Snap Photo of QR' button below for 100% reliable camera capture."
        );
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError(
          "Camera permission was denied. Tap '📸 Take Photo of QR' to use native phone camera or enter badge/phone below."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera detected on this device. Please enter badge/phone manually below.");
      } else {
        setCameraError(
          `Camera stream unavailable (${err.name || "Access Error"}). Tap '📸 Snap Photo of QR' below to scan.`
        );
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    isScanningActive.current = false;
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
    setTorchOn(false);
  };

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn("Torch constraint failed:", err);
      }
    }
  };

  // Flip Front / Rear Camera
  const handleFlipCamera = () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    setSelectedCameraId(""); // clear deviceId so facing constraint takes over
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [selectedCameraId, facingMode]);

  // Frame processing loop with Hardware BarcodeDetector + jsQR Fallback
  const startScanLoop = () => {
    isScanningActive.current = true;

    // Initialize native BarcodeDetector if available
    let barcodeDetector: any = null;
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "data_matrix", "code_128", "code_39", "ean_13"],
        });
      } catch (e) {
        console.warn("BarcodeDetector initialization failed, using jsQR:", e);
      }
    }

    const scanFrame = async () => {
      if (!isScanningActive.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        // 1. Try Hardware BarcodeDetector on the video element directly (super fast 60fps)
        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              handleDecodedString(barcodes[0].rawValue);
              animationFrameId.current = requestAnimationFrame(scanFrame);
              return;
            }
          } catch {
            // Silently fall through to canvas + jsQR
          }
        }

        // 2. Fallback to Canvas + jsQR
        if (canvas) {
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
                handleDecodedString(code.data.trim());
              }
            } catch (e) {
              console.warn("QR decode error:", e);
            }
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
    handleDecodedString(manualCode.trim());
    setManualCode("");
  };

  return (
    <div className="bg-[#0A1A2E] text-white rounded-2xl border-2 border-[#005DAA] p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header with Presence Intent Selector & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E3A60] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📷</span>
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sky-400">
              Live Optical QR Scanner & Presence Reader
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              STATION: {stationName} · HARDWARE READY
            </p>
          </div>
        </div>

        {/* Presence Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-[#0F2537] p-1 rounded-xl border border-[#1E3A60]">
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
              aria-label="Close scanner"
              className="ml-1 w-6 h-6 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-xs font-bold transition cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Video Viewport / Scanner Reticle */}
      <div className="relative w-full aspect-[4/3] max-h-[340px] bg-black rounded-xl overflow-hidden border-2 border-[#1E3A60] flex items-center justify-center">
        <canvas ref={canvasRef} className="hidden" />

        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Camera Off / Error State */}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-3 bg-[#0A1A2E]/95 z-10">
            <span className="text-3xl">📷</span>
            <div className="text-xs font-bold text-slate-300 max-w-xs leading-relaxed">
              {cameraError || "Initializing camera stream..."}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <span>📸</span>
                <span>Snap / Upload Photo of QR</span>
              </button>
              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                🔄 Retry Live Stream
              </button>
            </div>
          </div>
        )}

        {/* Reticle Overlay */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="absolute inset-0 bg-black/20" />

            <div
              className={`relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed rounded-2xl flex items-center justify-center transition-colors duration-200 ${
                isProcessing
                  ? "border-emerald-300 bg-emerald-500/20"
                  : presenceAction === "leave"
                  ? "border-amber-400"
                  : presenceAction === "muster"
                  ? "border-sky-400"
                  : "border-emerald-400"
              }`}
            >
              <div
                className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg ${
                  presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"
                }`}
              />
              <div
                className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg ${
                  presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"
                }`}
              />
              <div
                className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg ${
                  presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"
                }`}
              />
              <div
                className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-lg ${
                  presenceAction === "leave" ? "border-amber-400" : "border-emerald-400"
                }`}
              />

              <div
                className={`absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent ${
                  presenceAction === "leave"
                    ? "via-amber-400 shadow-[0_0_12px_#F59E0B]"
                    : "via-emerald-400 shadow-[0_0_12px_#34D399]"
                } to-transparent animate-scan-laser`}
              />

              {isProcessing && (
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider animate-bounce shadow-lg text-center max-w-[90%] truncate ${
                    presenceAction === "leave"
                      ? "bg-amber-500 text-slate-950"
                      : "bg-emerald-500 text-slate-950"
                  }`}
                >
                  ✓ {lastScannedResult || "SCANNED & RECORDED"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live HUD Status Pill */}
        <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-700 text-[10px] font-mono flex items-center gap-1.5 z-20">
          <span
            className={`w-2 h-2 rounded-full animate-pulse ${
              presenceAction === "leave" ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          <span className={presenceAction === "leave" ? "text-amber-400" : "text-emerald-400 font-bold"}>
            MODE:{" "}
            {presenceAction === "leave"
              ? "BADGE OUT (LEAVE)"
              : presenceAction === "muster"
              ? "MUSTER EVAC POINT"
              : "BADGE IN (FLOOR 07)"}
          </span>
        </div>

        {/* Top-Right Camera Controls (Flip / Torch) */}
        {cameraActive && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title="Toggle Torch / Flashlight"
                className={`p-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  torchOn
                    ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300"
                    : "bg-black/70 hover:bg-black/90 text-white border border-slate-700"
                }`}
              >
                🔦 {torchOn ? "ON" : "OFF"}
              </button>
            )}

            <button
              type="button"
              onClick={handleFlipCamera}
              title="Flip Camera (Front ⇄ Rear)"
              className="p-1.5 bg-black/70 hover:bg-black/90 text-white border border-slate-700 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1"
            >
              <span>🔄</span>
              <span className="hidden sm:inline text-[10px]">
                {facingMode === "environment" ? "Rear" : "Front"}
              </span>
            </button>
          </div>
        )}

        {/* Device Switcher (When multiple video devices present) */}
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

      {/* Hidden File Input for Native Camera Snapshot or QR Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Action Row: Native Camera Snap Button */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-2 px-3 bg-[#0F2537] hover:bg-[#1E3A60] text-sky-400 border border-[#1E3A60] rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>📸</span>
          <span>Snap / Upload Photo of QR Code</span>
        </button>
      </div>

      {/* Manual Input Fallback */}
      <form onSubmit={handleManualSubmit} className="space-y-2">
        <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
          <span>Direct Badge ID, Phone Number, or Name</span>
          <span className="text-sky-400 font-mono text-[10px]">e.g. OCC-101, (212) 555-0195, or Name</span>
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
              presenceAction === "leave"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {presenceAction === "leave" ? "LEAVE" : "ENTER"}
          </button>
        </div>
      </form>
    </div>
  );
};
