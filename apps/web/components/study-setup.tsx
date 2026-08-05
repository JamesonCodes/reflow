'use client';

import {
  approvedHostnameSchema,
  departmentNameSchema,
  inviteCodeSchema,
  observerDefaultsSchema,
  privacyPathPrefixSchema,
  roleNameSchema,
  workspaceNameSchema,
  type Tables,
} from '@reflow/contracts';
import type { User } from '@supabase/supabase-js';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import { getSupabaseBrowserClient } from '../lib/supabase-browser';

type Supabase = NonNullable<ReturnType<typeof getSupabaseBrowserClient>>;
type Workspace = Tables<'workspaces'>;
type Department = Tables<'departments'>;
type JobRole = Tables<'job_roles'>;
type AllowedDomain = Tables<'allowed_domains'>;
type PrivacyExclusion = Tables<'privacy_exclusions'>;
type WorkspaceInvite = Tables<'workspace_invites'>;
type ObserverProfile = Tables<'observer_profiles'>;

const installationStorageKey = 'reflow.observer.installation-id';

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function getInstallationId() {
  const existing = window.localStorage.getItem(installationStorageKey);
  if (existing) return existing;
  const id = window.crypto.randomUUID();
  window.localStorage.setItem(installationStorageKey, id);
  return id;
}

function Notice({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'error' | 'success';
}) {
  return <p className={`notice notice-${tone}`}>{children}</p>;
}

function Shell({
  children,
  onSignOut,
  identity,
}: {
  children: React.ReactNode;
  onSignOut?: () => void;
  identity?: string;
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Reflow home">
          <span className="brand-mark">R</span>
          <span>Reflow</span>
        </a>
        {onSignOut ? (
          <div className="identity-block">
            <span>{identity}</span>
            <button
              className="button button-quiet"
              onClick={onSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>
      {children}
    </div>
  );
}

function Welcome({ supabase }: { supabase: Supabase }) {
  const [mode, setMode] = useState<'admin' | 'observer'>('admin');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestMagicLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else setMessage('Check your email for a one-time sign-in link.');
  }

  async function joinAsObserver(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const parsedCode = inviteCodeSchema.safeParse(inviteCode);
    if (!parsedCode.success) {
      setBusy(false);
      setError('Enter the invite code supplied by your Reflow administrator.');
      return;
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInAnonymously();
    if (authError || !authData.user) {
      setBusy(false);
      setError(authError?.message ?? 'Anonymous sign-in failed.');
      return;
    }

    const { error: joinError } = await supabase.rpc(
      'join_workspace_by_invite',
      {
        installation_id: getInstallationId(),
        invite_code: parsedCode.data,
      },
    );
    setBusy(false);
    if (joinError)
      setError('That invite is invalid, expired, revoked, or fully used.');
    else window.location.reload();
  }

  return (
    <Shell>
      <main className="welcome-layout">
        <section className="welcome-copy">
          <p className="eyebrow">Browser process discovery</p>
          <h1>See how work actually moves.</h1>
          <p className="lede">
            Reflow observes approved browser systems during explicit study
            windows, then groups the activity into recurring tasks. No workflow
            names or process manuals required.
          </p>
          <ul className="promise-list">
            <li>Browser interactions only</li>
            <li>Explicit start and stop</li>
            <li>Sanitized metadata, never raw input values</li>
          </ul>
        </section>
        <section className="auth-card card">
          <div className="segmented" aria-label="Choose access type">
            <button
              className={mode === 'admin' ? 'active' : ''}
              onClick={() => setMode('admin')}
              type="button"
            >
              Administrator
            </button>
            <button
              className={mode === 'observer' ? 'active' : ''}
              onClick={() => setMode('observer')}
              type="button"
            >
              Observer
            </button>
          </div>
          {mode === 'admin' ? (
            <form onSubmit={(event) => void requestMagicLink(event)}>
              <p className="section-kicker">Study administration</p>
              <h2>Sign in with email</h2>
              <p className="muted">
                Only addresses on your local administrator allowlist can create
                and configure studies.
              </p>
              <label>
                Email address
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button
                className="button button-primary"
                disabled={busy}
                type="submit"
              >
                {busy ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>
          ) : (
            <form onSubmit={(event) => void joinAsObserver(event)}>
              <p className="section-kicker">Observer setup</p>
              <h2>Join a study</h2>
              <p className="muted">
                Use the invite provided by your administrator. Reflow creates an
                anonymous identity for this browser.
              </p>
              <label>
                Invite code
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  onChange={(event) => setInviteCode(event.target.value)}
                  required
                  value={inviteCode}
                />
              </label>
              <button
                className="button button-primary"
                disabled={busy}
                type="submit"
              >
                {busy ? 'Joining…' : 'Join study'}
              </button>
            </form>
          )}
          {message ? <Notice tone="success">{message}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </section>
      </main>
    </Shell>
  );
}

function AdminConsole({
  supabase,
  user,
  onSignOut,
}: {
  supabase: Supabase;
  user: User;
  onSignOut: () => void;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadWorkspaces = useCallback(async () => {
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('member_role', 'admin');
    if (error) throw error;
    const ids = memberships.map((membership) => membership.workspace_id);
    if (ids.length === 0) {
      setWorkspaces([]);
      setWorkspaceId('');
      return;
    }
    const { data, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', ids)
      .order('created_at');
    if (workspaceError) throw workspaceError;
    setWorkspaces(data);
    setWorkspaceId((current) => current || data[0]?.id || '');
  }, [supabase, user.id]);

  useEffect(() => {
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Your session could not be verified.');
        const response = await fetch('/api/admin/authorize', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(body.error ?? 'Administrator access was denied.');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        setAuthorized(true);
        await loadWorkspaces();
      } catch (caughtError) {
        setAuthError(errorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadWorkspaces, supabase]);

  if (loading)
    return (
      <Shell identity={user.email ?? 'Administrator'} onSignOut={onSignOut}>
        <main className="center-state">
          <div className="spinner" />
          <p>Preparing your study workspace…</p>
        </main>
      </Shell>
    );
  if (!authorized)
    return (
      <Shell identity={user.email ?? 'Administrator'} onSignOut={onSignOut}>
        <main className="center-state">
          <section className="card compact-card">
            <p className="eyebrow">Access unavailable</p>
            <h1>Administrator approval required</h1>
            <Notice tone="error">{authError}</Notice>
            <p className="muted">
              Add this email to <code>REFLOW_ADMIN_EMAILS</code> in your local
              environment, then sign in again.
            </p>
          </section>
        </main>
      </Shell>
    );
  if (!workspaceId)
    return (
      <Shell identity={user.email ?? 'Administrator'} onSignOut={onSignOut}>
        <WorkspaceCreator supabase={supabase} onCreated={loadWorkspaces} />
      </Shell>
    );

  return (
    <Shell identity={user.email ?? 'Administrator'} onSignOut={onSignOut}>
      <AdminWorkspace
        onWorkspacesChanged={loadWorkspaces}
        setWorkspaceId={setWorkspaceId}
        supabase={supabase}
        workspace={
          workspaces.find((workspace) => workspace.id === workspaceId) ??
          workspaces[0]!
        }
        workspaces={workspaces}
      />
    </Shell>
  );
}

function WorkspaceCreator({
  supabase,
  onCreated,
}: {
  supabase: Supabase;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    const parsed = workspaceNameSchema.safeParse(name);
    if (!parsed.success) return setError('Enter a workspace name.');
    setBusy(true);
    const { error: createError } = await supabase.rpc('create_workspace', {
      workspace_name: parsed.data,
    });
    setBusy(false);
    if (createError) setError(createError.message);
    else await onCreated();
  }
  return (
    <main className="center-state">
      <section className="card compact-card">
        <p className="eyebrow">New observation study</p>
        <h1>Create your workspace</h1>
        <p className="muted">
          Start with the organizational context used to group observations.
          Reflow will infer the tasks later.
        </p>
        <form onSubmit={(event) => void createWorkspace(event)}>
          <label>
            Workspace name
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Finance operations study"
              required
              value={name}
            />
          </label>
          <button
            className="button button-primary"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
        </form>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </section>
    </main>
  );
}

function AdminWorkspace({
  supabase,
  workspace,
  workspaces,
  setWorkspaceId,
  onWorkspacesChanged,
}: {
  supabase: Supabase;
  workspace: Workspace;
  workspaces: Workspace[];
  setWorkspaceId: (id: string) => void;
  onWorkspacesChanged: () => Promise<void>;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [exclusions, setExclusions] = useState<PrivacyExclusion[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [departmentName, setDepartmentName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDepartmentId, setRoleDepartmentId] = useState('');
  const [hostname, setHostname] = useState('');
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [exclusionDomainId, setExclusionDomainId] = useState('');
  const [pathPrefix, setPathPrefix] = useState('');
  const [exclusionReason, setExclusionReason] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);

  const reload = useCallback(async () => {
    setError(null);
    const [
      departmentResult,
      roleResult,
      domainResult,
      exclusionResult,
      inviteResult,
    ] = await Promise.all([
      supabase
        .from('departments')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('name'),
      supabase
        .from('job_roles')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('name'),
      supabase
        .from('allowed_domains')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('hostname'),
      supabase
        .from('privacy_exclusions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('path_prefix'),
      supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false }),
    ]);
    const firstError = [
      departmentResult.error,
      roleResult.error,
      domainResult.error,
      exclusionResult.error,
      inviteResult.error,
    ].find(Boolean);
    if (firstError) return setError(firstError.message);
    setDepartments(departmentResult.data ?? []);
    setRoles(roleResult.data ?? []);
    setDomains(domainResult.data ?? []);
    setExclusions(exclusionResult.data ?? []);
    setInvites(inviteResult.data ?? []);
  }, [supabase, workspace.id]);

  useEffect(() => {
    setWorkspaceName(workspace.name);
    void reload();
  }, [reload, workspace.name]);
  useEffect(() => {
    if (!roleDepartmentId)
      setRoleDepartmentId(
        departments.find((department) => department.is_active)?.id ?? '',
      );
  }, [departments, roleDepartmentId]);
  useEffect(() => {
    if (!exclusionDomainId)
      setExclusionDomainId(
        domains.find((domain) => domain.is_enabled)?.id ?? '',
      );
  }, [domains, exclusionDomainId]);

  async function run(
    operation: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setError(null);
    const { error: operationError } = await operation();
    if (operationError) setError(operationError.message);
    else await reload();
  }

  async function renameWorkspace(event: FormEvent) {
    event.preventDefault();
    const parsed = workspaceNameSchema.safeParse(workspaceName);
    if (!parsed.success) return setError('Enter a workspace name.');
    await run(() =>
      supabase
        .from('workspaces')
        .update({ name: parsed.data })
        .eq('id', workspace.id),
    );
    await onWorkspacesChanged();
  }

  async function addDepartment(event: FormEvent) {
    event.preventDefault();
    const parsed = departmentNameSchema.safeParse(departmentName);
    if (!parsed.success) return setError('Enter a department name.');
    await run(() =>
      supabase
        .from('departments')
        .insert({ name: parsed.data, workspace_id: workspace.id }),
    );
    setDepartmentName('');
  }

  async function addRole(event: FormEvent) {
    event.preventDefault();
    const parsed = roleNameSchema.safeParse(roleName);
    if (!parsed.success || !roleDepartmentId)
      return setError('Choose a department and enter a role.');
    await run(() =>
      supabase.from('job_roles').insert({
        department_id: roleDepartmentId,
        name: parsed.data,
        workspace_id: workspace.id,
      }),
    );
    setRoleName('');
  }

  async function addDomain(event: FormEvent) {
    event.preventDefault();
    const parsed = approvedHostnameSchema.safeParse(hostname);
    if (!parsed.success)
      return setError(
        parsed.error.issues[0]?.message ?? 'Enter a valid hostname.',
      );
    await run(() =>
      supabase.from('allowed_domains').insert({
        hostname: parsed.data,
        include_subdomains: includeSubdomains,
        workspace_id: workspace.id,
      }),
    );
    setHostname('');
    setIncludeSubdomains(false);
  }

  async function addExclusion(event: FormEvent) {
    event.preventDefault();
    const parsed = privacyPathPrefixSchema.safeParse(pathPrefix);
    if (!parsed.success || !exclusionDomainId)
      return setError('Choose a domain and enter a valid path prefix.');
    await run(() =>
      supabase.from('privacy_exclusions').insert({
        allowed_domain_id: exclusionDomainId,
        path_prefix: parsed.data,
        reason: exclusionReason.trim() || null,
        workspace_id: workspace.id,
      }),
    );
    setPathPrefix('');
    setExclusionReason('');
  }

  async function createInvite() {
    setError(null);
    setLastInviteCode(null);
    const { data, error: inviteError } = await supabase.rpc(
      'create_workspace_invite',
      { invite_max_uses: inviteMaxUses, target_workspace_id: workspace.id },
    );
    if (inviteError || !data[0])
      return setError(inviteError?.message ?? 'Invite generation failed.');
    setLastInviteCode(data[0].invite_code);
    await reload();
  }

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <p className="section-kicker">Study setup</p>
        <select
          aria-label="Workspace"
          onChange={(event) => setWorkspaceId(event.target.value)}
          value={workspace.id}
        >
          {workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <nav>
          <a href="#workspace">Workspace</a>
          <a href="#departments">Departments & roles</a>
          <a href="#domains">Browser scope</a>
          <a href="#invites">Observer invites</a>
        </nav>
        <div className="sidebar-note">
          <strong>Discovery, not prescription</strong>
          <p>
            Do not enter workflow names or expected tasks. Reflow learns them
            from observed browser activity.
          </p>
        </div>
      </aside>
      <div className="dashboard-content">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Configuration</p>
            <h1>Observation study</h1>
            <p>
              Set the organizational and privacy boundaries. These guide
              grouping, not task inference.
            </p>
          </div>
          <span className="status-chip">
            <span /> Setup
          </span>
        </header>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <section className="card setup-section" id="workspace">
          <div className="section-heading">
            <div>
              <span className="step-number">01</span>
              <h2>Workspace</h2>
            </div>
            <p>A simple name for this browser observation study.</p>
          </div>
          <form
            className="inline-form"
            onSubmit={(event) => void renameWorkspace(event)}
          >
            <label>
              Workspace name
              <input
                onChange={(event) => setWorkspaceName(event.target.value)}
                value={workspaceName}
              />
            </label>
            <button className="button button-secondary" type="submit">
              Save name
            </button>
          </form>
        </section>
        <section className="card setup-section" id="departments">
          <div className="section-heading">
            <div>
              <span className="step-number">02</span>
              <h2>Departments and roles</h2>
            </div>
            <p>Used only to compare patterns across groups.</p>
          </div>
          <div className="split-grid">
            <div>
              <h3>Departments</h3>
              <form
                className="inline-form"
                onSubmit={(event) => void addDepartment(event)}
              >
                <label>
                  Department name
                  <input
                    onChange={(event) => setDepartmentName(event.target.value)}
                    placeholder="Accounts Payable"
                    value={departmentName}
                  />
                </label>
                <button className="button button-secondary" type="submit">
                  Add
                </button>
              </form>
              <div className="item-list">
                {departments.map((department) => (
                  <div className="list-row" key={department.id}>
                    <div>
                      <strong>{department.name}</strong>
                      <span>
                        {department.is_active
                          ? 'Available to observers'
                          : 'Not available for new studies'}
                      </span>
                    </div>
                    <button
                      className="button button-quiet"
                      onClick={() =>
                        void run(() =>
                          supabase
                            .from('departments')
                            .update({ is_active: !department.is_active })
                            .eq('id', department.id),
                        )
                      }
                      type="button"
                    >
                      {department.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Common roles</h3>
              <form
                className="stack-form"
                onSubmit={(event) => void addRole(event)}
              >
                <label>
                  Department
                  <select
                    onChange={(event) =>
                      setRoleDepartmentId(event.target.value)
                    }
                    value={roleDepartmentId}
                  >
                    <option value="">Choose department</option>
                    {departments
                      .filter((item) => item.is_active)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Role name
                  <input
                    onChange={(event) => setRoleName(event.target.value)}
                    placeholder="Invoice analyst"
                    value={roleName}
                  />
                </label>
                <button className="button button-secondary" type="submit">
                  Add common role
                </button>
              </form>
              <div className="item-list">
                {roles.map((role) => (
                  <div className="list-row" key={role.id}>
                    <div>
                      <strong>{role.name}</strong>
                      <span>
                        {
                          departments.find(
                            (item) => item.id === role.department_id,
                          )?.name
                        }
                      </span>
                    </div>
                    <button
                      className="button button-quiet"
                      onClick={() =>
                        void run(() =>
                          supabase
                            .from('job_roles')
                            .update({ is_active: !role.is_active })
                            .eq('id', role.id),
                        )
                      }
                      type="button"
                    >
                      {role.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="card setup-section" id="domains">
          <div className="section-heading">
            <div>
              <span className="step-number">03</span>
              <h2>Browser scope and privacy</h2>
            </div>
            <p>
              Only enabled domains are observable. Excluded paths remain
              private.
            </p>
          </div>
          <div className="split-grid">
            <div>
              <h3>Approved domains</h3>
              <form
                className="stack-form"
                onSubmit={(event) => void addDomain(event)}
              >
                <label>
                  Hostname
                  <input
                    onChange={(event) => setHostname(event.target.value)}
                    placeholder="billing.example.com"
                    value={hostname}
                  />
                </label>
                <label className="check-label">
                  <input
                    checked={includeSubdomains}
                    onChange={(event) =>
                      setIncludeSubdomains(event.target.checked)
                    }
                    type="checkbox"
                  />{' '}
                  Include subdomains
                </label>
                <button className="button button-secondary" type="submit">
                  Approve domain
                </button>
              </form>
              <div className="item-list">
                {domains.map((domain) => (
                  <div className="list-row" key={domain.id}>
                    <div>
                      <strong>{domain.hostname}</strong>
                      <span>
                        {domain.include_subdomains
                          ? 'Includes subdomains'
                          : 'Exact hostname only'}
                      </span>
                    </div>
                    <button
                      className="button button-quiet"
                      onClick={() =>
                        void run(() =>
                          supabase
                            .from('allowed_domains')
                            .update({ is_enabled: !domain.is_enabled })
                            .eq('id', domain.id),
                        )
                      }
                      type="button"
                    >
                      {domain.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Privacy exclusions</h3>
              <form
                className="stack-form"
                onSubmit={(event) => void addExclusion(event)}
              >
                <label>
                  Approved domain
                  <select
                    onChange={(event) =>
                      setExclusionDomainId(event.target.value)
                    }
                    value={exclusionDomainId}
                  >
                    <option value="">Choose domain</option>
                    {domains
                      .filter((item) => item.is_enabled)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.hostname}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Path prefix
                  <input
                    onChange={(event) => setPathPrefix(event.target.value)}
                    placeholder="/payroll"
                    value={pathPrefix}
                  />
                </label>
                <label>
                  Short reason <span className="optional">Optional</span>
                  <input
                    maxLength={160}
                    onChange={(event) => setExclusionReason(event.target.value)}
                    placeholder="Sensitive area"
                    value={exclusionReason}
                  />
                </label>
                <button className="button button-secondary" type="submit">
                  Exclude path
                </button>
              </form>
              <div className="item-list">
                {exclusions.map((exclusion) => (
                  <div className="list-row" key={exclusion.id}>
                    <div>
                      <strong>
                        {
                          domains.find(
                            (item) => item.id === exclusion.allowed_domain_id,
                          )?.hostname
                        }
                        {exclusion.path_prefix}
                      </strong>
                      <span>{exclusion.reason ?? 'No reason provided'}</span>
                    </div>
                    <button
                      className="button button-quiet"
                      onClick={() =>
                        void run(() =>
                          supabase
                            .from('privacy_exclusions')
                            .update({ is_enabled: !exclusion.is_enabled })
                            .eq('id', exclusion.id),
                        )
                      }
                      type="button"
                    >
                      {exclusion.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="card setup-section" id="invites">
          <div className="section-heading">
            <div>
              <span className="step-number">04</span>
              <h2>Observer invites</h2>
            </div>
            <p>
              Invite codes are shown once. Reflow stores only a one-way hash.
            </p>
          </div>
          <div className="invite-controls">
            <label>
              Maximum uses
              <input
                min={1}
                max={10000}
                onChange={(event) =>
                  setInviteMaxUses(Number(event.target.value))
                }
                type="number"
                value={inviteMaxUses}
              />
            </label>
            <button
              className="button button-primary"
              onClick={() => void createInvite()}
              type="button"
            >
              Generate invite
            </button>
          </div>
          {lastInviteCode ? (
            <div className="invite-reveal">
              <div>
                <span>Copy this code now</span>
                <code>{lastInviteCode}</code>
              </div>
              <button
                className="button button-secondary"
                onClick={() =>
                  void navigator.clipboard.writeText(lastInviteCode)
                }
                type="button"
              >
                Copy code
              </button>
            </div>
          ) : null}
          <div className="item-list">
            {invites.map((invite) => (
              <div className="list-row" key={invite.id}>
                <div>
                  <strong>
                    {invite.revoked_at
                      ? 'Revoked invite'
                      : `${invite.use_count} of ${invite.max_uses} uses`}
                  </strong>
                  <span>
                    Created {new Date(invite.created_at).toLocaleDateString()}
                  </span>
                </div>
                {invite.revoked_at ? null : (
                  <button
                    className="button button-quiet danger"
                    onClick={() =>
                      void run(() =>
                        supabase
                          .from('workspace_invites')
                          .update({ revoked_at: new Date().toISOString() })
                          .eq('id', invite.id),
                      )
                    }
                    type="button"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ObserverSetup({
  supabase,
  user,
  onSignOut,
}: {
  supabase: Supabase;
  user: User;
  onSignOut: () => void;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [exclusions, setExclusions] = useState<PrivacyExclusion[]>([]);
  const [profile, setProfile] = useState<ObserverProfile | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleChoice, setRoleChoice] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('member_role', 'observer');
    if (membershipError) throw membershipError;
    const currentWorkspaceId = memberships[0]?.workspace_id;
    if (!currentWorkspaceId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    const [
      workspaceResult,
      departmentResult,
      roleResult,
      domainResult,
      exclusionResult,
      profileResult,
    ] = await Promise.all([
      supabase
        .from('workspaces')
        .select('*')
        .eq('id', currentWorkspaceId)
        .single(),
      supabase
        .from('departments')
        .select('*')
        .eq('workspace_id', currentWorkspaceId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('job_roles')
        .select('*')
        .eq('workspace_id', currentWorkspaceId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('allowed_domains')
        .select('*')
        .eq('workspace_id', currentWorkspaceId)
        .eq('is_enabled', true)
        .order('hostname'),
      supabase
        .from('privacy_exclusions')
        .select('*')
        .eq('workspace_id', currentWorkspaceId)
        .eq('is_enabled', true)
        .order('path_prefix'),
      supabase
        .from('observer_profiles')
        .select('*')
        .eq('workspace_id', currentWorkspaceId)
        .eq('observer_id', user.id)
        .maybeSingle(),
    ]);
    const firstError = [
      workspaceResult.error,
      departmentResult.error,
      roleResult.error,
      domainResult.error,
      exclusionResult.error,
      profileResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;
    setWorkspace(workspaceResult.data);
    setDepartments(departmentResult.data ?? []);
    setRoles(roleResult.data ?? []);
    setDomains(domainResult.data ?? []);
    setExclusions(exclusionResult.data ?? []);
    setProfile(profileResult.data);
    if (profileResult.data) {
      setDepartmentId(profileResult.data.default_department_id);
      setRoleChoice(profileResult.data.default_job_role_id ?? 'custom');
      setCustomRole(profileResult.data.custom_role ?? '');
    }
    setLoading(false);
  }, [supabase, user.id]);

  useEffect(() => {
    void load().catch((caughtError) => {
      setError(errorMessage(caughtError));
      setLoading(false);
    });
  }, [load]);

  const matchingRoles = useMemo(
    () => roles.filter((role) => role.department_id === departmentId),
    [departmentId, roles],
  );

  async function join(event: FormEvent) {
    event.preventDefault();
    const parsed = inviteCodeSchema.safeParse(inviteCode);
    if (!parsed.success) return setError('Enter a valid invite code.');
    const { error: joinError } = await supabase.rpc(
      'join_workspace_by_invite',
      { installation_id: getInstallationId(), invite_code: parsed.data },
    );
    if (joinError)
      setError('That invite is invalid, expired, revoked, or fully used.');
    else await load();
  }

  async function saveDefaults(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!workspace) return;
    const parsed = observerDefaultsSchema.safeParse({
      workspaceId: workspace.id,
      observerId: user.id,
      departmentId,
      jobRoleId: roleChoice && roleChoice !== 'custom' ? roleChoice : null,
      customRole: roleChoice === 'custom' ? customRole : null,
    });
    if (!parsed.success)
      return setError('Choose a department and select or enter your role.');
    const { error: profileError } = await supabase
      .from('observer_profiles')
      .upsert(
        {
          workspace_id: parsed.data.workspaceId,
          observer_id: parsed.data.observerId,
          default_department_id: parsed.data.departmentId,
          default_job_role_id: parsed.data.jobRoleId,
          custom_role: parsed.data.customRole,
        },
        { onConflict: 'workspace_id,observer_id' },
      );
    if (profileError) setError(profileError.message);
    else {
      setMessage('Your defaults are saved for future observation windows.');
      await load();
    }
  }

  if (loading)
    return (
      <Shell identity="Anonymous observer" onSignOut={onSignOut}>
        <main className="center-state">
          <div className="spinner" />
          <p>Loading your study…</p>
        </main>
      </Shell>
    );
  if (!workspace)
    return (
      <Shell identity="Anonymous observer" onSignOut={onSignOut}>
        <main className="center-state">
          <section className="card compact-card">
            <p className="eyebrow">Observer setup</p>
            <h1>Join your study</h1>
            <p className="muted">
              Enter the invite code supplied by your administrator.
            </p>
            <form onSubmit={(event) => void join(event)}>
              <label>
                Invite code
                <input
                  autoComplete="off"
                  onChange={(event) => setInviteCode(event.target.value)}
                  value={inviteCode}
                />
              </label>
              <button className="button button-primary" type="submit">
                Join study
              </button>
            </form>
            {error ? <Notice tone="error">{error}</Notice> : null}
          </section>
        </main>
      </Shell>
    );

  return (
    <Shell identity="Anonymous observer" onSignOut={onSignOut}>
      <main className="observer-layout">
        <header className="page-heading">
          <div>
            <p className="eyebrow">{workspace.name}</p>
            <h1>Set your observation defaults</h1>
            <p>
              These details help Reflow compare patterns across groups. They do
              not tell Reflow what tasks to expect.
            </p>
          </div>
          <span className="status-chip">
            <span /> {profile ? 'Ready' : 'Setup needed'}
          </span>
        </header>
        <div className="observer-grid">
          <section className="card setup-section">
            <div className="section-heading">
              <div>
                <span className="step-number">01</span>
                <h2>Your team context</h2>
              </div>
              <p>
                You can override these defaults when an observation window
                begins.
              </p>
            </div>
            <form
              className="stack-form observer-form"
              onSubmit={(event) => void saveDefaults(event)}
            >
              <label>
                Department <span className="required">Required</span>
                <select
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setRoleChoice('');
                    setCustomRole('');
                  }}
                  value={departmentId}
                >
                  <option value="">Choose your department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role <span className="required">Required</span>
                <select
                  disabled={!departmentId}
                  onChange={(event) => setRoleChoice(event.target.value)}
                  value={roleChoice}
                >
                  <option value="">Choose or enter a role</option>
                  {matchingRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                  <option value="custom">Enter my role</option>
                </select>
              </label>
              {roleChoice === 'custom' ? (
                <label>
                  Your role
                  <input
                    maxLength={120}
                    onChange={(event) => setCustomRole(event.target.value)}
                    placeholder="Payment specialist"
                    value={customRole}
                  />
                </label>
              ) : null}
              <button
                className="button button-primary"
                disabled={
                  !departmentId ||
                  !roleChoice ||
                  (roleChoice === 'custom' && !customRole.trim())
                }
                type="submit"
              >
                Save defaults
              </button>
            </form>
            {message ? <Notice tone="success">{message}</Notice> : null}
            {error ? <Notice tone="error">{error}</Notice> : null}
          </section>
          <aside className="scope-card card">
            <p className="section-kicker">Study boundaries</p>
            <h2>What Reflow may observe</h2>
            <p>Only browser activity on these approved systems is in scope.</p>
            <div className="scope-list">
              {domains.map((domain) => (
                <div key={domain.id}>
                  <strong>{domain.hostname}</strong>
                  <span>
                    {domain.include_subdomains
                      ? 'Including subdomains'
                      : 'Exact hostname'}
                  </span>
                  {exclusions
                    .filter((item) => item.allowed_domain_id === domain.id)
                    .map((item) => (
                      <small key={item.id}>Private: {item.path_prefix}</small>
                    ))}
                </div>
              ))}
            </div>
            <div className="privacy-callout">
              <strong>No recording yet</strong>
              <p>
                Phase 3 adds explicit start, pause, resume, and stop controls.
                Chrome never resumes observation automatically.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </Shell>
  );
}

export function StudySetup() {
  const [supabase, setSupabase] = useState<Supabase | null>(null);
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setConfigured(false);
      setLoading(false);
      return;
    }
    setSupabase(client);
    void client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  if (!configured)
    return (
      <Shell>
        <main className="center-state">
          <section className="card compact-card">
            <p className="eyebrow">Configuration needed</p>
            <h1>Connect hosted Supabase</h1>
            <p className="muted">
              Add the project URL and publishable key to your local{' '}
              <code>.env.local</code>, then restart Reflow.
            </p>
          </section>
        </main>
      </Shell>
    );
  if (loading || !supabase)
    return (
      <Shell>
        <main className="center-state">
          <div className="spinner" />
          <p>Opening Reflow…</p>
        </main>
      </Shell>
    );
  if (!user) return <Welcome supabase={supabase} />;
  if (user.is_anonymous)
    return (
      <ObserverSetup
        onSignOut={() => void signOut()}
        supabase={supabase}
        user={user}
      />
    );
  return (
    <AdminConsole
      onSignOut={() => void signOut()}
      supabase={supabase}
      user={user}
    />
  );
}
