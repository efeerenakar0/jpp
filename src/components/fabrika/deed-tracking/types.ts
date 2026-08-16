import type { DeedWorkflow } from '@/lib/deed-workflow';

export type DeedCaseType =
  | 'SALE'
  | 'PURCHASE'
  | 'MORTGAGE'
  | 'INHERITANCE'
  | 'CORRECTION'
  | 'OTHER';

export type DeedCaseStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'DOCUMENTS_MISSING'
  | 'READY_FOR_APPOINTMENT'
  | 'APPOINTMENT_SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export type DeedChecklistItem = {
  key: string;
  label: string;
  required: boolean;
  completed: boolean;
};

export type DeedEvent = {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
};

export type DeedCase = {
  id: string;
  title: string;
  type: DeedCaseType;
  status: DeedCaseStatus;
  version: number;
  checklist: DeedChecklistItem[];
  guideId: string | null;
  workflow: DeedWorkflow | null;
  appointmentAt: string | null;
  dueAt: string | null;
  notes: string | null;
  officialIntegration: string;
  humanApprovalRequired: boolean;
  createdAt: string;
  updatedAt: string;
  property: { id: string; title: string; referenceCode: string; location?: string | null } | null;
  contact: { id: string; name: string } | null;
  assignedMember: { id: string; name: string } | null;
  events: DeedEvent[];
};

export type WorkspaceOption = { id: string; name?: string; title?: string; referenceCode?: string; active?: boolean; role?: string };

export type DeedWorkspace = {
  properties: Array<WorkspaceOption & { title: string; referenceCode: string }>;
  contacts: Array<WorkspaceOption & { name: string }>;
  members: Array<WorkspaceOption & { name: string; active: boolean }>;
};

export type DeedCaseDraft = {
  checklist: DeedChecklistItem[];
  workflow: DeedWorkflow;
  status: DeedCaseStatus;
  assignedMemberId: string;
  appointmentAt: string;
  dueAt: string;
  notes: string;
};
