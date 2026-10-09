export type QuadrantId = "NW" | "NE" | "SW" | "SE";

export type OccupantStatus =
  | "unaccounted"
  | "safe"
  | "need-help"
  | "mia"
  | "claimed-unverified"
  | "awaiting-evac-chair";

export type OccupantRole = "Employee" | "Contractor" | "Visitor" | "VIP" | "First Responder";

export type LocationCategory = "inside-building" | "outside-assembly" | "offsite";

export interface Occupant {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  quadrant: QuadrantId;
  status: OccupantStatus;
  role: OccupantRole;
  locationCategory?: LocationCategory;
  assemblyPoint?: string;
  badgedOut?: boolean;
  offSiteToday?: boolean;
  unaccountedMinutes?: number;
  lastLocation?: string;
  lastBadgeTime?: string;
  notes?: string;
  checkInMethod?: string;
  likelyMia?: boolean;
  likelyMiaEvidence?: string;
  araAssigned?: boolean;
  needEvacChair?: boolean;
  desk?: string;
  xCoord?: number;
  yCoord?: number;
  geofenceValidation?: {
    isInsideBuilding: boolean;
    isAtAssemblyPoint: boolean;
    locationCategory: LocationCategory;
    assemblyPoint?: string | null;
    confidence: string;
    distanceMeters?: number | null;
    verifiedAt?: string;
    auditDetails?: string;
  };
}

export interface QuadrantStat {
  id: QuadrantId;
  label: string;
  expected: number;
  accounted: number;
  claimedUnverified: number;
  needHelp: number;
  mia: number;
}

export interface WalkieTalkieBroadcast {
  id: string;
  senderName: string;
  senderRole: "warden" | "commander" | "fsd_director";
  senderBadge?: string;
  timestamp: string;
  audioUrl?: string;
  transcript?: string;
  distressLevel: "CRITICAL_DISTRESS" | "EVACUATION_ORDER" | "SITREP" | "ALL_CLEAR";
  quadrant?: QuadrantId | "ALL";
  durationSeconds?: number;
}

export interface StatusSnapshot {
  incidentActive: boolean;
  mode: "drill" | "incident" | null;
  hazardType: string | null;
  declaredAt: string | null;
  expectedOnFloor: number;
  accounted: number;
  needHelp: number;
  mia: number;
  awaitingEvacChair: number;
  quadrants: QuadrantStat[];
  occupants?: Occupant[];
  publicTunnelUrl?: string | null;
  lanIps?: string[];
  ledgerEntries?: LedgerEntry[];
  latestNarrative?: DrillNarrativeDraft | null;
  latestWalkieTalkie?: WalkieTalkieBroadcast | null;
  latestEmergencyAlert?: EmergencyAlertPayload | null;
}

export interface LedgerEntry {
  id: string;
  prevHash: string;
  hash: string;
  type: string;
  timestamp: string;
  payload: Record<string, any>;
}

export interface DrillNarrativeDraft {
  id: string;
  hash: string;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  executiveSummary: string;
  timelineNarrative: string;
  musterPerformance: {
    timeToAllSafeSec: number;
    p95TimeToSafe: number;
    musterCompletionRate: number;
  };
  miaExceptionReview: string;
  recommendedCorrectiveActions: string[];
  referencedLedgerIds: string[];
  verificationAudit?: {
    verifiedGroundTruth: boolean;
    zeroHallucinationAudit: "PASSED";
    expectedCount: number;
    accountedCount: number;
    unaccountedCount: number;
    verifiedCompletionRate: number;
    verifiedLedgerBlocksCount: number;
    validatedAt: string;
  };
}

export interface RedListQueryResponse {
  query: string;
  answer: string;
  filterSpec: {
    quadrant?: QuadrantId | null;
    status?: OccupantStatus | null;
    minMinutesUnaccounted?: number | null;
    isVisitor?: boolean | null;
    needEvacChair?: boolean | null;
    textSearch?: string | null;
  };
  matchedOccupants: Occupant[];
  totalMatched: number;
  verificationAudit?: {
    searchedPopulationCount: number;
    zeroHallucinationAudit: "PASSED";
    deterministicMatchCount: number;
    quadrantBreakdown?: Record<string, number>;
  };
}

export interface EmergencyAlertPayload {
  alertId: string;
  title: string;
  narrative: string;
  priority: "CRITICAL" | "HIGH" | "WARNING";
  targetQuadrants: ("ALL" | QuadrantId)[];
  channels: string[];
  senderRole: string;
  timestamp: string;
  deliveredCount: number;
  ackCount: number;
}

export type UserRole = "fsd_director" | "warden" | "auditor" | "kiosk" | "occupant";

export interface CheckinEvent {
  id: string;
  name: string;
  event_date: string;
  qr_token: string;
  created_at?: string;
  checkinUrl?: string;
  qrDataUrl?: string;
}

export interface RosterAttendee {
  id: string;
  event_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  org?: string | null;
  quadrant?: QuadrantId;
  role?: string;
  checked_in: boolean;
  checked_in_at?: string | null;
  signature_data?: string | null;
  signature_type?: "drawn" | "typed" | null;
}

export interface AttendanceRecord {
  id: string;
  event_id: string;
  roster_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  org?: string | null;
  signature_data?: string | null;
  signature_type?: "drawn" | "typed";
  ip_address?: string;
  checked_in_at: string;
}

export interface EventRosterStatus {
  event: CheckinEvent;
  roster: RosterAttendee[];
  walkIns: AttendanceRecord[];
  stats: {
    totalExpected: number;
    checkedInCount: number;
    walkInCount: number;
    pendingCount: number;
    attendanceRate: number;
  };
}

export interface AuthUser {
  id: string;
  userId: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  caps: number;
  capsList: string[];
  quadrant?: QuadrantId;
  token?: string;
  isGuest?: boolean;
  authMethod?: "PASSWORD_CREDENTIAL" | "BIOMETRIC_PASSKEY" | "QR_BADGE_SCAN" | "CONED_GUEST_ONBOARDING" | "PIN_CREDENTIAL";
  guestDetails?: {
    organization?: string;
    category?: "Contractor" | "Vendor" | "Visitor" | "Inspector" | "Emergency Liaison";
    hostEmployee?: string;
    qrPassCode?: string;
    phone?: string;
    needsAssistance?: boolean;
  };
}

