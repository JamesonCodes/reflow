comment on table public.workspaces is
  'Top-level tenant boundary for one Reflow browser observation study.';
comment on column public.workspaces.id is
  'Stable UUID that identifies the workspace across all Reflow records.';
comment on column public.workspaces.name is
  'Human-readable workspace name shown in local administration interfaces.';
comment on column public.workspaces.created_by is
  'Permanent Supabase Auth user who created the workspace.';
comment on column public.workspaces.created_at is
  'Timestamp when the workspace was created.';
comment on column public.workspaces.updated_at is
  'Timestamp when mutable workspace details were last changed.';

comment on table public.workspace_members is
  'Workspace-scoped authorization roles for permanent and anonymous users.';
comment on column public.workspace_members.workspace_id is
  'Workspace in which the user has membership.';
comment on column public.workspace_members.user_id is
  'Supabase Auth user that holds the workspace membership.';
comment on column public.workspace_members.member_role is
  'Workspace authorization role: admin, analyst, or observer.';
comment on column public.workspace_members.created_at is
  'Timestamp when the user joined the workspace.';
comment on column public.workspace_members.updated_at is
  'Timestamp when the membership role was last changed.';

comment on table public.departments is
  'Administrator-defined departments used to group browser observations.';
comment on column public.departments.id is
  'Stable UUID that identifies the department.';
comment on column public.departments.workspace_id is
  'Workspace that owns the department.';
comment on column public.departments.name is
  'Human-readable department name selected by observers.';
comment on column public.departments.is_active is
  'Whether the department is available for new observation windows.';
comment on column public.departments.created_at is
  'Timestamp when the department was created.';
comment on column public.departments.updated_at is
  'Timestamp when the department was last changed.';

comment on table public.job_roles is
  'Optional common job roles scoped to a workspace department.';
comment on column public.job_roles.id is
  'Stable UUID that identifies the job role.';
comment on column public.job_roles.workspace_id is
  'Workspace that owns the job role.';
comment on column public.job_roles.department_id is
  'Department to which the job role belongs.';
comment on column public.job_roles.name is
  'Human-readable role name selected by observers.';
comment on column public.job_roles.is_active is
  'Whether the role is available for new observation windows.';
comment on column public.job_roles.created_at is
  'Timestamp when the job role was created.';
comment on column public.job_roles.updated_at is
  'Timestamp when the job role was last changed.';

comment on table public.allowed_domains is
  'Workspace allowlist defining browser hostnames eligible for observation.';
comment on column public.allowed_domains.id is
  'Stable UUID that identifies the domain rule.';
comment on column public.allowed_domains.workspace_id is
  'Workspace that owns the domain rule.';
comment on column public.allowed_domains.hostname is
  'Normalized lowercase hostname approved for browser observation.';
comment on column public.allowed_domains.include_subdomains is
  'Whether subdomains of the approved hostname are also observable.';
comment on column public.allowed_domains.is_enabled is
  'Whether the domain rule currently permits event ingestion.';
comment on column public.allowed_domains.created_at is
  'Timestamp when the domain rule was created.';
comment on column public.allowed_domains.updated_at is
  'Timestamp when the domain rule was last changed.';

comment on table public.workspace_invites is
  'Hashed, revocable invite records for anonymous browser observers.';
comment on column public.workspace_invites.id is
  'Stable UUID that identifies the invite record.';
comment on column public.workspace_invites.workspace_id is
  'Workspace an observer joins after redeeming the invite.';
comment on column public.workspace_invites.code_hash is
  'SHA-256 hash of the normalized invite code; the raw code is never stored.';
comment on column public.workspace_invites.created_by is
  'Workspace administrator who created the invite.';
comment on column public.workspace_invites.member_role is
  'Workspace role granted when the invite is redeemed.';
comment on column public.workspace_invites.max_uses is
  'Maximum number of successful first-time redemptions allowed.';
comment on column public.workspace_invites.use_count is
  'Number of successful first-time redemptions already recorded.';
comment on column public.workspace_invites.expires_at is
  'Optional timestamp after which new redemptions are rejected.';
comment on column public.workspace_invites.revoked_at is
  'Timestamp when the invite was revoked, or null while not revoked.';
comment on column public.workspace_invites.created_at is
  'Timestamp when the invite record was created.';

comment on table public.observer_installations is
  'Anonymous extension installation identities joined to one workspace.';
comment on column public.observer_installations.id is
  'Client-generated stable UUID for the unpacked browser extension installation.';
comment on column public.observer_installations.workspace_id is
  'Workspace joined by the extension installation.';
comment on column public.observer_installations.owner_id is
  'Anonymous Supabase Auth user associated with the installation.';
comment on column public.observer_installations.joined_at is
  'Timestamp when the installation first joined the workspace.';
comment on column public.observer_installations.last_seen_at is
  'Timestamp of the most recent successful invite join or heartbeat update.';
comment on column public.observer_installations.revoked_at is
  'Timestamp when observation access was revoked, or null while active.';

comment on table public.observation_windows is
  'Explicit user-initiated periods during which approved browser activity may be recorded.';
comment on column public.observation_windows.id is
  'Client-generated UUID that identifies the observation window.';
comment on column public.observation_windows.workspace_id is
  'Workspace that owns the observation window.';
comment on column public.observation_windows.observer_id is
  'Anonymous Supabase Auth user who started the observation window.';
comment on column public.observation_windows.installation_id is
  'Extension installation used to create the observation window.';
comment on column public.observation_windows.department_id is
  'Selected department used to group the observation.';
comment on column public.observation_windows.job_role_id is
  'Optional selected common job role for the observation.';
comment on column public.observation_windows.department_snapshot is
  'Immutable department name captured when the observation began.';
comment on column public.observation_windows.role_snapshot is
  'Immutable selected or user-entered role label captured when observation began.';
comment on column public.observation_windows.status is
  'Current lifecycle state: active, paused, completed, or cancelled.';
comment on column public.observation_windows.started_at is
  'Client-reported timestamp when explicit observation began.';
comment on column public.observation_windows.paused_at is
  'Client-reported timestamp of the current pause, or null while not paused.';
comment on column public.observation_windows.ended_at is
  'Client-reported timestamp when observation completed or was cancelled.';
comment on column public.observation_windows.created_at is
  'Server timestamp when the observation window record was ingested.';
comment on column public.observation_windows.updated_at is
  'Server timestamp when the observation lifecycle state last changed.';

comment on table public.raw_event_tokens is
  'Immutable privacy-sanitized browser events captured during observation windows.';
comment on column public.raw_event_tokens.id is
  'Client-generated idempotency UUID for the sanitized event.';
comment on column public.raw_event_tokens.observation_window_id is
  'Observation window during which the event occurred.';
comment on column public.raw_event_tokens.workspace_id is
  'Workspace that owns the event.';
comment on column public.raw_event_tokens.observer_id is
  'Anonymous Supabase Auth user that submitted the event.';
comment on column public.raw_event_tokens.sequence_no is
  'Strictly positive client sequence number within the observation window.';
comment on column public.raw_event_tokens.action_type is
  'Normalized browser action category represented by the event.';
comment on column public.raw_event_tokens.hostname is
  'Approved normalized hostname, or null for an anonymous out-of-scope gap.';
comment on column public.raw_event_tokens.normalized_path is
  'Sanitized URL path with query strings, fragments, and sensitive identifiers removed.';
comment on column public.raw_event_tokens.element_role is
  'Sanitized semantic role of the interacted browser element.';
comment on column public.raw_event_tokens.element_label is
  'Bounded redacted label describing the interacted element.';
comment on column public.raw_event_tokens.page_landmark is
  'Bounded redacted page region or landmark associated with the event.';
comment on column public.raw_event_tokens.semantic_input_token is
  'Generalized classification token for input shape or meaning; never a raw input value.';
comment on column public.raw_event_tokens.tab_id is
  'Opaque positive tab identifier local to the observation session.';
comment on column public.raw_event_tokens.occurred_at is
  'Client-reported timestamp when the browser action occurred.';
comment on column public.raw_event_tokens.ingested_at is
  'Server timestamp when Supabase accepted the sanitized event.';

comment on table public.processing_jobs is
  'Durable local-worker queue for asynchronous Reflow processing stages.';
comment on column public.processing_jobs.id is
  'Database-generated monotonic identifier for the processing job.';
comment on column public.processing_jobs.workspace_id is
  'Workspace that owns the job and its target entity.';
comment on column public.processing_jobs.job_type is
  'Processing stage requested for the target entity.';
comment on column public.processing_jobs.entity_id is
  'UUID of the domain record to be processed by the job.';
comment on column public.processing_jobs.status is
  'Current queue state: queued, running, succeeded, failed, or cancelled.';
comment on column public.processing_jobs.attempt_count is
  'Number of times a worker has durably claimed the job.';
comment on column public.processing_jobs.max_attempts is
  'Maximum claim attempts allowed before automatic retries must stop.';
comment on column public.processing_jobs.available_at is
  'Earliest timestamp at which a queued job may be claimed.';
comment on column public.processing_jobs.locked_at is
  'Timestamp when the current worker claim was acquired.';
comment on column public.processing_jobs.lock_token is
  'Unique fencing token identifying the current worker claim.';
comment on column public.processing_jobs.locked_by is
  'Bounded identifier of the local worker holding the current claim.';
comment on column public.processing_jobs.error_code is
  'Bounded machine-readable code for the most recent job failure.';
comment on column public.processing_jobs.error_detail is
  'Bounded sanitized diagnostic detail for the most recent job failure.';
comment on column public.processing_jobs.created_at is
  'Timestamp when the processing job was created.';
comment on column public.processing_jobs.updated_at is
  'Timestamp when the processing job state last changed.';
