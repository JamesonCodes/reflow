import { browser } from 'wxt/browser';

import type {
  ExtensionResponse,
  ObserverDefaults,
  PopupSnapshot,
} from '../../lib/model';
import { domainPermissionPatterns } from '../../lib/scope';

import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
let snapshot: PopupSnapshot | null = null;

const errorLabels: Record<string, string> = {
  approved_active_tab_required:
    'Open an approved, non-private browser page before starting.',
  approved_domains_required: 'This study has no approved browser domains.',
  defaults_save_failed: 'Your department and role could not be saved.',
  exactly_one_role_required: 'Choose a common role or enter your role.',
  events_pending_delivery:
    'Reflow is still delivering sanitized events. Check your connection and try again.',
  extension_not_configured:
    'Add the WXT Supabase URL and publishable key, then rebuild Reflow.',
  host_permission_required: 'Site access is required to begin observation.',
  invalid_invite: 'That invite is invalid, expired, revoked, or fully used.',
  invalid_message: 'Reflow rejected an invalid extension message.',
  observation_start_failed: 'The observation window could not be started.',
  observation_transition_failed: 'The observation state could not be changed.',
  operation_failed: 'Something went wrong. Please try again.',
  setup_load_failed: 'The study setup could not be loaded.',
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
) {
  const created = document.createElement(tag);
  if (className) created.className = className;
  return created;
}

function text(
  tag: keyof HTMLElementTagNameMap,
  value: string,
  className?: string,
) {
  const created = element(tag, className);
  created.textContent = value;
  return created;
}

function button(label: string, className = 'button primary') {
  const created = element('button', className);
  created.type = 'button';
  created.textContent = label;
  return created;
}

async function send<T>(request: unknown) {
  const response: ExtensionResponse<T> =
    await browser.runtime.sendMessage(request);
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

function showError(error: unknown) {
  const code = error instanceof Error ? error.message : 'operation_failed';
  const notice = text(
    'p',
    errorLabels[code] ?? 'Something went wrong. Please try again.',
    'notice error',
  );
  app.prepend(notice);
}

function header() {
  const section = element('header', 'header');
  const brand = element('div', 'brand');
  brand.append(text('span', 'R', 'mark'), text('strong', 'Reflow'));
  section.append(brand, text('span', 'Browser observer', 'tag'));
  return section;
}

function roleFields(initial: ObserverDefaults | null) {
  const container = element('div', 'fields');
  const departmentLabel = text('label', 'Department');
  const department = element('select');
  department.required = true;
  department.append(new Option('Choose department', ''));
  for (const item of snapshot?.departments ?? []) {
    department.append(new Option(item.name, item.id));
  }
  department.value = initial?.departmentId ?? '';
  departmentLabel.append(department);

  const roleLabel = text('label', 'Role');
  const role = element('select');
  const custom = element('input');
  custom.placeholder = 'Enter your role';
  custom.maxLength = 120;
  custom.value = initial?.customRole ?? '';

  function populateRoles() {
    role.replaceChildren(new Option('Choose or enter role', ''));
    for (const item of snapshot?.roles ?? []) {
      if (item.departmentId === department.value)
        role.append(new Option(item.name, item.id));
    }
    role.append(new Option('Enter my role', 'custom'));
    const initialRole =
      initial?.jobRoleId ?? (initial?.customRole ? 'custom' : '');
    role.value = initialRole;
    custom.hidden = role.value !== 'custom';
  }
  populateRoles();
  department.addEventListener('change', () => {
    role.value = '';
    custom.value = '';
    populateRoles();
  });
  role.addEventListener('change', () => {
    custom.hidden = role.value !== 'custom';
  });
  roleLabel.append(role, custom);
  container.append(departmentLabel, roleLabel);

  return {
    container,
    read(): ObserverDefaults {
      if (!department.value || !role.value)
        throw new Error('exactly_one_role_required');
      if (role.value === 'custom') {
        const customRole = custom.value.trim();
        if (!customRole) throw new Error('exactly_one_role_required');
        return {
          customRole,
          departmentId: department.value,
          jobRoleId: null,
        };
      }
      return {
        customRole: null,
        departmentId: department.value,
        jobRoleId: role.value,
      };
    },
  };
}

function studyScope() {
  const scope = element('section', 'scope');
  scope.append(text('p', 'Approved browser systems', 'eyebrow'));
  for (const domain of snapshot?.domains ?? []) {
    const row = element('div', 'scope-row');
    row.append(
      text('strong', domain.hostname),
      text(
        'span',
        domain.includeSubdomains ? 'Includes subdomains' : 'Exact host',
      ),
    );
    scope.append(row);
  }
  if ((snapshot?.exclusions.length ?? 0) > 0) {
    scope.append(
      text(
        'p',
        `${snapshot!.exclusions.length} private path exclusion${snapshot!.exclusions.length === 1 ? '' : 's'} active`,
        'privacy-note',
      ),
    );
  }
  return scope;
}

function renderJoin() {
  const card = element('section', 'card');
  card.append(
    text('p', 'Observer setup', 'eyebrow'),
    text('h1', 'Join a Reflow study'),
    text(
      'p',
      'Enter the invite code supplied by your study administrator.',
      'muted',
    ),
  );
  const input = element('input');
  input.placeholder = 'Invite code';
  input.autocomplete = 'off';
  const join = button('Join study');
  join.addEventListener('click', () => {
    void (async () => {
      try {
        join.disabled = true;
        snapshot = await send<PopupSnapshot>({
          type: 'setup:join',
          inviteCode: input.value,
        });
        render();
      } catch (error) {
        showError(error);
      } finally {
        join.disabled = false;
      }
    })();
  });
  card.append(input, join);
  app.append(card);
}

function renderDefaults() {
  const card = element('section', 'card');
  card.append(
    text('p', snapshot?.workspaceName ?? 'Observation study', 'eyebrow'),
    text('h1', 'Set your team context'),
    text(
      'p',
      'Department and role guide grouping. They do not define expected tasks.',
      'muted',
    ),
  );
  const fields = roleFields(snapshot?.profile ?? null);
  const save = button('Save defaults');
  save.addEventListener('click', () => {
    void (async () => {
      try {
        save.disabled = true;
        snapshot = await send<PopupSnapshot>({
          type: 'setup:save-defaults',
          ...fields.read(),
        });
        render();
      } catch (error) {
        showError(error);
      } finally {
        save.disabled = false;
      }
    })();
  });
  card.append(fields.container, save);
  app.append(card, studyScope());
}

async function requestStudyPermissions() {
  const origins = [
    ...new Set((snapshot?.domains ?? []).flatMap(domainPermissionPatterns)),
  ];
  if (origins.length === 0) throw new Error('approved_domains_required');
  const granted = await browser.permissions.request({ origins });
  if (!granted) throw new Error('host_permission_required');
}

function renderReady() {
  const card = element('section', 'card');
  card.append(
    text('p', snapshot?.workspaceName ?? 'Observation study', 'eyebrow'),
    text('h1', 'Ready to observe'),
    text(
      'p',
      'Open an approved browser system, then start an explicit observation window.',
      'muted',
    ),
  );
  const fields = roleFields(snapshot?.profile ?? null);
  const start = button('Start observation');
  start.addEventListener('click', () => {
    void (async () => {
      try {
        start.disabled = true;
        const defaults = fields.read();
        await requestStudyPermissions();
        snapshot = await send<PopupSnapshot>({
          type: 'recording:start',
          ...defaults,
        });
        render();
      } catch (error) {
        showError(error);
      } finally {
        start.disabled = false;
      }
    })();
  });
  card.append(fields.container, start);
  app.append(card, studyScope());
}

function renderRecording() {
  const recording = snapshot!.recording!;
  const card = element('section', 'card recording');
  const status = element('div', `recording-status ${recording.status}`);
  status.append(
    element('span'),
    text('strong', recording.status === 'active' ? 'Observing' : 'Paused'),
  );
  card.append(
    status,
    text(
      'h1',
      recording.status === 'active'
        ? 'Browser observation is active'
        : 'Observation is paused',
    ),
    text(
      'p',
      recording.status === 'active'
        ? 'Only sanitized interactions on approved systems are being recorded.'
        : 'No browser interactions are being recorded while paused.',
      'muted',
    ),
  );
  const controls = element('div', 'controls');
  const toggle = button(recording.status === 'active' ? 'Pause' : 'Resume');
  const stop = button('Stop', 'button secondary');
  toggle.addEventListener('click', () => {
    void (async () => {
      try {
        toggle.disabled = true;
        snapshot = await send<PopupSnapshot>({
          type:
            recording.status === 'active'
              ? 'recording:pause'
              : 'recording:resume',
        });
        render();
      } catch (error) {
        showError(error);
      }
    })();
  });
  stop.addEventListener('click', () => {
    void (async () => {
      try {
        stop.disabled = true;
        snapshot = await send<PopupSnapshot>({ type: 'recording:stop' });
        render();
      } catch (error) {
        showError(error);
      }
    })();
  });
  controls.append(toggle, stop);
  card.append(controls);
  if (snapshot!.queueSize > 0)
    card.append(
      text(
        'p',
        `${snapshot!.queueSize} sanitized event${snapshot!.queueSize === 1 ? '' : 's'} awaiting delivery`,
        'queue-note',
      ),
    );
  app.append(card);
}

function render() {
  app.replaceChildren(header());
  if (!snapshot?.joined) renderJoin();
  else if (!snapshot.profile) renderDefaults();
  else if (snapshot.recording) renderRecording();
  else renderReady();
}

async function initialize() {
  app.replaceChildren(header(), text('p', 'Opening Reflow…', 'loading'));
  try {
    snapshot = await send<PopupSnapshot>({ type: 'setup:get' });
    render();
  } catch (error) {
    render();
    showError(error);
  }
}

void initialize();
