/**
 * Rapid 4-Digit Emergency PIN Authentication & Role Guard (100% Free)
 */

export type UserRole = "commander" | "warden" | "security" | "occupant";

export interface RoleCredentials {
  role: UserRole;
  displayName: string;
  pin: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleCredentials> = {
  commander: {
    role: "commander",
    displayName: "FSD Chief Commander (Director)",
    pin: "7007",
  },
  warden: {
    role: "warden",
    displayName: "Floor 07 Deputy Warden",
    pin: "2026",
  },
  security: {
    role: "security",
    displayName: "Turnstile Security / Front Desk",
    pin: "1901",
  },
  occupant: {
    role: "occupant",
    displayName: "Occupant / Visitor",
    pin: "",
  },
};

export function verifyRolePin(role: UserRole, inputPin: string): boolean {
  if (role === "occupant") return true;
  const config = ROLE_CONFIGS[role];
  return config ? config.pin === inputPin.trim() : false;
}

export function getStoredRole(): UserRole {
  if (typeof window === "undefined") return "occupant";
  const stored = sessionStorage.getItem("muster_verified_role") as UserRole | null;
  return stored || "commander"; // Default to commander for developer ease
}

export function setStoredRole(role: UserRole): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("muster_verified_role", role);
  }
}
