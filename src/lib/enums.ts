export const DEAL_STAGES = ["NEW", "CONTACTED", "ENGAGED", "MEETING", "PROPOSAL", "WON", "LOST"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  ENGAGED: "Replied",
  MEETING: "Meeting",
  PROPOSAL: "Proposal out",
  WON: "Won",
  LOST: "Lost",
};

export const COMMODITY_LABEL: Record<string, string> = {
  SAND_GRAVEL: "Sand & gravel",
  CRUSHED_STONE: "Crushed stone",
  INDUSTRIAL_SAND: "Industrial sand",
  DIMENSION_STONE: "Dimension stone",
  OTHER: "Other",
};

export const MSHA_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  INTERMITTENT: "Intermittent",
  NEW: "New mine",
  TEMP_IDLED: "Temporarily idled",
  NONPRODUCING: "Non-producing",
  ABANDONED: "Abandoned",
};

export const SIGNAL_LABEL: Record<string, string> = {
  NEW_MINE: "New mine registered",
  OWNERSHIP_CHANGE: "Ownership change",
  REACTIVATION: "Reactivated",
  STATUS_CHANGE: "Status change",
  EXPANSION: "Expansion",
  HEARING_NOTICE: "Zoning hearing",
  PERMIT_APPLICATION: "WPDES application filed",
  MANUAL: "Note",
};

export const REPLY_CLASSES = [
  "INTERESTED",
  "MEETING_REQUEST",
  "PROPOSAL_REQUEST",
  "QUESTION",
  "NOT_NOW",
  "NOT_INTERESTED",
  "UNSUBSCRIBE",
  "OUT_OF_OFFICE",
  "REFERRAL",
  "BOUNCE",
  "OTHER",
] as const;
export type ReplyClass = (typeof REPLY_CLASSES)[number];

export const REPLY_CLASS_LABEL: Record<ReplyClass, string> = {
  INTERESTED: "Interested",
  MEETING_REQUEST: "Wants a meeting",
  PROPOSAL_REQUEST: "Wants pricing/proposal",
  QUESTION: "Question",
  NOT_NOW: "Not now",
  NOT_INTERESTED: "Not interested",
  UNSUBSCRIBE: "Unsubscribe",
  OUT_OF_OFFICE: "Out of office",
  REFERRAL: "Referral",
  BOUNCE: "Bounce",
  OTHER: "Other",
};

export const PERMIT_STATUSES = [
  "NOT_STARTED",
  "DRAFTING",
  "CLIENT_REVIEW",
  "READY_TO_FILE",
  "SUBMITTED",
  "AGENCY_REVIEW",
  "APPROVED",
  "NOT_REQUIRED",
] as const;

export const PERMIT_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  DRAFTING: "Drafting",
  CLIENT_REVIEW: "Client review",
  READY_TO_FILE: "Ready to file",
  SUBMITTED: "Submitted",
  AGENCY_REVIEW: "Agency review",
  APPROVED: "Approved",
  NOT_REQUIRED: "Not required",
};
