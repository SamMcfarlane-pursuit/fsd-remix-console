import React, { useRef, useState, useEffect } from "react";

interface DigitalSignaturePadProps {
  onSignatureChange: (signatureData: string | null, signatureType: "drawn" | "typed") => void;
  defaultName?: string;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  onSignatureChange,
  defaultName = "",
}) => {
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState(defaultName);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Sync default name if supplied
  useEffect(() => {
    if (defaultName && !typedName) {
      setTypedName(defaultName);
    }
  }, [defaultName]);

  // Set up canvas context and high DPI
  useEffect(() => {
    if (signatureMode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#003B70";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [signatureMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onSignatureChange(dataUrl, "drawn");
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null, "drawn");
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypedName(val);
    if (val.trim()) {
      // Generate svg or text representation
      onSignatureChange(val.trim(), "typed");
    } else {
      onSignatureChange(null, "typed");
    }
  };

  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black uppercase tracking-wider text-[#0F2537] flex items-center gap-1.5">
          <span>✍️</span>
          <span>Official Sign-In Signature</span>
          <span className="text-red-500">*</span>
        </label>

        {/* Draw vs Type Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#F0F6FC] p-0.5 rounded-lg border border-[#B8D8F8] text-[10px] font-bold">
          <button
            type="button"
            onClick={() => {
              setSignatureMode("draw");
              onSignatureChange(null, "drawn");
            }}
            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
              signatureMode === "draw" ? "bg-[#005DAA] text-white shadow-xs" : "text-[#475569] hover:text-[#005DAA]"
            }`}
          >
            ✏️ Draw
          </button>
          <button
            type="button"
            onClick={() => {
              setSignatureMode("type");
              if (typedName.trim()) onSignatureChange(typedName.trim(), "typed");
            }}
            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
              signatureMode === "type" ? "bg-[#005DAA] text-white shadow-xs" : "text-[#475569] hover:text-[#005DAA]"
            }`}
          >
            ⌨️ Type
          </button>
        </div>
      </div>

      {signatureMode === "draw" ? (
        <div className="relative border-2 border-dashed border-[#B8D8F8] bg-[#FAFDFE] rounded-xl overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            width={380}
            height={110}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-[110px] touch-none cursor-crosshair block"
          />

          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium">
              Draw your digital signature here with finger or mouse
            </div>
          )}

          {hasDrawn && (
            <button
              type="button"
              onClick={clearCanvas}
              className="absolute top-2 right-2 text-[10px] font-bold text-slate-500 hover:text-red-600 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200 transition shadow-xs cursor-pointer"
            >
              Clear
            </button>
          )}

          <div className="bg-[#EBF5FB] border-t border-[#CBDCEE] px-2.5 py-1 text-[10px] text-[#005DAA] font-mono flex items-center justify-between">
            <span>DIGITAL AUDIT SIGNATURE STAMP</span>
            <span>{hasDrawn ? "✓ Captured" : "Required"}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <input
            type="text"
            value={typedName}
            onChange={handleTypeChange}
            placeholder="Type your legal sign-in name (e.g. Sarah Jenkins)"
            className="w-full bg-white border-2 border-[#B8D8F8] rounded-xl px-3 py-2 text-sm text-[#0F2537] font-serif italic focus:outline-none focus:border-[#005DAA] shadow-inner"
          />
          <div className="text-[10px] text-slate-500 font-medium px-1 flex items-center justify-between">
            <span>By typing your name, you confirm legal floor presence.</span>
            <span className="font-mono text-[#005DAA] font-bold">/s/ {typedName || "..."}</span>
          </div>
        </div>
      )}
    </div>
  );
};
