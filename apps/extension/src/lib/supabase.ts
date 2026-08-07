import type { Database, Tables } from '@reflow/contracts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type {
  ActiveObservationState,
  ObserverDefaults,
  StudySetupSnapshot,
} from './model';
import { supabaseAuthStorage, getInstallationId } from './storage';

let client: SupabaseClient<Database> | null = null;

function extensionEnvironment() {
  const url = import.meta.env.WXT_SUPABASE_URL;
  const publishableKey = import.meta.env.WXT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !url.startsWith('https://') || !publishableKey) {
    throw new Error('extension_not_configured');
  }
  return { publishableKey, url };
}

export function getSupabaseClient() {
  if (client) return client;
  const environment = extensionEnvironment();
  client = createClient<Database>(environment.url, environment.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: supabaseAuthStorage,
    },
  });
  return client;
}

export async function ensureAnonymousIdentity() {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user?.is_anonymous) return existing.user;
  if (existing.user) throw new Error('anonymous_identity_required');
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error('anonymous_sign_in_failed');
  return data.user;
}

export async function joinStudy(inviteCode: string) {
  const supabase = getSupabaseClient();
  await ensureAnonymousIdentity();
  const installationId = await getInstallationId();
  const { error } = await supabase.rpc('join_workspace_by_invite', {
    installation_id: installationId,
    invite_code: inviteCode.trim(),
  });
  if (error) throw new Error('invalid_invite');
}

type Profile = Tables<'observer_profiles'>;

export async function saveObserverDefaults(defaults: ObserverDefaults) {
  const supabase = getSupabaseClient();
  const user = await ensureAnonymousIdentity();
  const setup = await loadStudySetup();
  if (!setup.workspaceId) throw new Error('study_not_joined');

  const editableDefaults = {
    custom_role: defaults.customRole,
    default_department_id: defaults.departmentId,
    default_job_role_id: defaults.jobRoleId,
  };
  const query = setup.profile
    ? supabase
        .from('observer_profiles')
        .update(editableDefaults)
        .eq('workspace_id', setup.workspaceId)
        .eq('observer_id', user.id)
    : supabase.from('observer_profiles').insert({
        ...editableDefaults,
        observer_id: user.id,
        workspace_id: setup.workspaceId,
      });
  const { error } = await query;
  if (error) throw new Error('defaults_save_failed');
}

function mapProfile(profile: Profile | null): ObserverDefaults | null {
  return profile
    ? {
        customRole: profile.custom_role,
        departmentId: profile.default_department_id,
        jobRoleId: profile.default_job_role_id,
      }
    : null;
}

export async function loadStudySetup(): Promise<StudySetupSnapshot> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.is_anonymous) {
    return {
      departments: [],
      domains: [],
      exclusions: [],
      installationId: null,
      joined: false,
      profile: null,
      roles: [],
      userId: null,
      workspaceId: null,
      workspaceName: null,
    };
  }

  const { data: installations, error: installationError } = await supabase
    .from('observer_installations')
    .select('*')
    .eq('owner_id', user.id)
    .is('revoked_at', null);
  if (installationError) throw new Error('setup_load_failed');
  const installation = installations[0];
  if (!installation) {
    return {
      departments: [],
      domains: [],
      exclusions: [],
      installationId: await getInstallationId(),
      joined: false,
      profile: null,
      roles: [],
      userId: user.id,
      workspaceId: null,
      workspaceName: null,
    };
  }

  const workspaceId = installation.workspace_id;
  const [workspace, departments, roles, domains, exclusions, profile] =
    await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabase
        .from('departments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('job_roles')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('allowed_domains')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_enabled', true)
        .order('hostname'),
      supabase
        .from('privacy_exclusions')
        .select('*, allowed_domains!inner(hostname, include_subdomains)')
        .eq('workspace_id', workspaceId)
        .eq('is_enabled', true)
        .order('path_prefix'),
      supabase
        .from('observer_profiles')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('observer_id', user.id)
        .maybeSingle(),
    ]);

  if (
    workspace.error ||
    departments.error ||
    roles.error ||
    domains.error ||
    exclusions.error ||
    profile.error
  ) {
    throw new Error('setup_load_failed');
  }

  return {
    departments: (departments.data ?? []).map((department) => ({
      id: department.id,
      name: department.name,
    })),
    domains: (domains.data ?? []).map((domain) => ({
      hostname: domain.hostname,
      includeSubdomains: domain.include_subdomains,
    })),
    exclusions: (exclusions.data ?? []).map((exclusion) => ({
      hostname: exclusion.allowed_domains.hostname,
      includeSubdomains: exclusion.allowed_domains.include_subdomains,
      pathPrefix: exclusion.path_prefix,
    })),
    installationId: installation.id,
    joined: true,
    profile: mapProfile(profile.data),
    roles: (roles.data ?? []).map((role) => ({
      departmentId: role.department_id,
      id: role.id,
      name: role.name,
    })),
    userId: user.id,
    workspaceId,
    workspaceName: workspace.data.name,
  };
}

export async function startObservation(defaults: ObserverDefaults) {
  const supabase = getSupabaseClient();
  const setup = await loadStudySetup();
  if (!setup.joined || !setup.workspaceId || !setup.userId)
    throw new Error('study_not_joined');

  const targetWindowId = crypto.randomUUID();
  const roleArguments = defaults.jobRoleId
    ? { target_job_role_id: defaults.jobRoleId }
    : { target_custom_role: defaults.customRole! };
  const { data, error } = await supabase.rpc('start_observation_window', {
    target_department_id: defaults.departmentId,
    target_window_id: targetWindowId,
    ...roleArguments,
  });
  if (error || !data) throw new Error('observation_start_failed');

  return {
    departmentId: data.department_id,
    domains: setup.domains,
    exclusions: setup.exclusions,
    jobRoleId: data.job_role_id,
    lastScope: null,
    lastHostname: null,
    nextSequence: 1,
    nextTabId: 1,
    observerId: data.observer_id,
    status: 'active',
    tabIds: {},
    windowId: data.id,
    workspaceId: data.workspace_id,
  } satisfies ActiveObservationState;
}

export async function transitionObservation(
  windowId: string,
  status: 'active' | 'paused' | 'completed' | 'cancelled',
) {
  const { data, error } = await getSupabaseClient().rpc(
    'transition_observation_window',
    {
      target_status: status,
      target_window_id: windowId,
    },
  );
  if (error || !data) throw new Error('observation_transition_failed');
  return data;
}
