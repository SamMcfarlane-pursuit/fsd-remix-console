import React, { useState } from "react";
import { UserRole, ROLE_CONFIGS, verifyRolePin } from "../lib/authGuard";

interface PinModalProps {
  isOpen: boolean;
  targetRole: UserRole;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  targetRole,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const config = ROLE_CONFIGS[targetRole];

  const handleDigitClick = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 4) {
        if (verifyRolePin(targetRole, nextPin)) {
          setTimeout(() => {
            setPin("");
            onSuccess();
          }, 150);
        } else {
          setError("Invalid PIN. Default: " + config.pin);
          setTimeout(() => setPin(""), 600);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-[#0A1A2E] border-2 border-[#005DAA] rounded-2xl w-full max-w-sm p-5 text-white shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#005DAA]/30 border border-[#005DAA] flex items-center justify-center text-2xl">
            🔒
          </div>
          <h3 className="text-base font-black tracking-wide">
            {config.displayName}
          </h3>
          <p className="text-xs text-slate-400">
            Enter 4-Digit Security PIN (Default: <strong className="text-sky-300 font-mono">{config.pin}</strong>)
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center items-center gap-3 py-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pin.length > i
                  ? "bg-sky-400 border-sky-400 scale-110 shadow-sm"
                  : "border-slate-600 bg-slate-800"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-center text-xs font-bold text-red-400 bg-red-950/60 p-2 rounded-lg border border-red-800 animate-shake">
            {error}
          </div>
        )}

        {/* Tactile Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => handleDigitClick(d)}
              className="h-12 bg-slate-800 hover:bg-slate-700 active:bg-[#005DAA] rounded-xl font-mono text-lg font-black transition cursor-pointer flex items-center justify-center border border-slate-700 active:scale-95"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-12 bg-slate-800/60 hover:bg-slate-700 text-xs font-bold text-slate-400 rounded-xl transition cursor-pointer border border-slate-700"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigitClick("0")}
            className="h-12 bg-slate-800 hover:bg-slate-700 active:bg-[#005DAA] rounded-xl font-mono text-lg font-black transition cursor-pointer flex items-center justify-center border border-slate-700 active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-12 bg-slate-800/60 hover:bg-slate-700 text-xs font-bold text-slate-400 rounded-xl transition cursor-pointer border border-slate-700"
          >
            ⌫
          </button>
        </div>

        <div className="pt-2 flex justify-between gap-2">
          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Quick dev bypass
              setPin(config.pin);
              setTimeout(() => onSuccess(), 100);
            }}
            className="w-full py-2.5 bg-[#005DAA]/40 hover:bg-[#005DAA] text-sky-200 text-xs font-bold rounded-xl transition cursor-pointer border border-[#005DAA]/50"
          >
            ⚡ Auto-Fill ({config.pin})
          </button>
        </div>
      </div>
    </div>
  );
};
