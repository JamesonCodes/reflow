import type { QueuedCapturedEvent } from '@reflow/contracts';

import type { DomainRule, PrivacyExclusionRule } from './scope';

export interface StudyDepartment {
  id: string;
  name: string;
}

export interface StudyRole {
  departmentId: string;
  id: string;
  name: string;
}

export interface ObserverDefaults {
  customRole: string | null;
  departmentId: string;
  jobRoleId: string | null;
}

export interface StudySetupSnapshot {
  departments: StudyDepartment[];
  domains: DomainRule[];
  exclusions: PrivacyExclusionRule[];
  installationId: string | null;
  joined: boolean;
  profile: ObserverDefaults | null;
  roles: StudyRole[];
  userId: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
}

export interface ActiveObservationState {
  departmentId: string;
  domains: DomainRule[];
  exclusions: PrivacyExclusionRule[];
  jobRoleId: string | null;
  lastScope: 'approved' | 'gap' | null;
  lastHostname: string | null;
  nextSequence: number;
  nextTabId: number;
  observerId: string;
  status: 'active' | 'paused';
  tabIds: Record<string, number>;
  windowId: string;
  workspaceId: string;
}

export interface StoredQueueItem {
  attempts: number;
  event: QueuedCapturedEvent;
  nextAttemptAt: number;
}

export interface PopupSnapshot extends StudySetupSnapshot {
  deliveryError: string | null;
  queueSize: number;
  recording: Pick<
    ActiveObservationState,
    'departmentId' | 'jobRoleId' | 'status' | 'windowId'
  > | null;
}

export type ExtensionResponse<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
