const port = window.location.port || '3100';
const systems = {
  ap: {
    accent: '#c85d42',
    eyebrow: 'Accounts Payable',
    hostname: `ap.localhost:${port}`,
    name: 'Northstar Invoice Hub',
  },
  bank: {
    accent: '#26756f',
    eyebrow: 'Treasury',
    hostname: `bank.localhost:${port}`,
    name: 'Clearline Payments',
  },
  erp: {
    accent: '#6657a8',
    eyebrow: 'Procurement',
    hostname: `erp.localhost:${port}`,
    name: 'Atlas ERP',
  },
  outside: {
    accent: '#68717a',
    eyebrow: 'Unapproved system',
    hostname: `127.0.0.1:${port}`,
    name: 'External Reference Portal',
  },
};

function currentSystemKey() {
  const prefix = window.location.hostname.split('.')[0];
  return prefix in systems
    ? prefix
    : window.location.hostname === '127.0.0.1'
      ? 'outside'
      : 'ap';
}

function url(system, path) {
  return `http://${systems[system].hostname}${path}`;
}

function icon(name) {
  const icons = {
    arrow:
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>',
    check:
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-9"/></svg>',
    invoice:
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v12H5zM12 2v5h4M8 11h5M8 14h5"/></svg>',
    lock: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2"/><path d="M7 8V6a3 3 0 0 1 6 0v2"/></svg>',
  };
  return icons[name] ?? '';
}

function shell(content, options = {}) {
  const key = currentSystemKey();
  const system = systems[key];
  document.documentElement.style.setProperty('--accent', system.accent);
  document.title = `${options.title ?? system.name} · Reflow Workflow Lab`;

  return `
    <div class="demo-ribbon">
      <strong>Reflow Workflow Lab</strong>
      <span>Synthetic data only</span>
      <a href="${url('ap', '/')}">Reset walkthrough</a>
    </div>
    <div class="app-shell">
      <aside class="sidebar" aria-label="${system.name} navigation">
        <a class="brand" href="${url(key, '/')}">
          <span class="brand-mark">${system.name.slice(0, 1)}</span>
          <span><small>${system.eyebrow}</small>${system.name}</span>
        </a>
        ${navigation(key)}
        <div class="sidebar-foot">
          <span class="avatar">JM</span>
          <span><strong>Jamie Morgan</strong><small>Demo observer</small></span>
        </div>
      </aside>
      <main class="workspace" aria-label="${options.landmark ?? 'Workflow workspace'}">
        ${content}
      </main>
    </div>`;
}

function navigation(key) {
  if (key === 'ap') {
    return `<nav>
      <a href="${url('ap', '/')}">Overview</a>
      <a href="${url('ap', '/inbox')}">Invoice inbox <span class="count">4</span></a>
      <a href="${url('ap', '/approvals')}">Approvals</a>
      <a href="${url('ap', '/private/vendor-login')}">${icon('lock')} Private portal</a>
    </nav>`;
  }
  if (key === 'erp') {
    return `<nav>
      <a href="${url('erp', '/')}">ERP home</a>
      <a href="${url('erp', '/vendors/ACME-42')}">Vendors</a>
      <a href="${url('erp', '/purchase-orders')}">Purchase orders</a>
      <a href="${url('ap', '/invoices/INV-1042')}">Back to Invoice Hub</a>
    </nav>`;
  }
  if (key === 'bank') {
    return `<nav>
      <a href="${url('bank', '/')}">Cash position</a>
      <a href="${url('bank', '/payments/new')}">New payment</a>
      <a href="${url('bank', '/payments/history')}">Payment history</a>
      <a href="${url('ap', '/invoices/INV-1042')}">Back to Invoice Hub</a>
    </nav>`;
  }
  return `<nav><a href="${url('outside', '/')}">Reference home</a><a href="${url('ap', '/')}">Return to approved systems</a></nav>`;
}

function pageHeader(eyebrow, title, description, actions = '') {
  return `<header class="page-header">
    <div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>
    <div class="header-actions">${actions}</div>
  </header>`;
}

function apHome() {
  return shell(
    `
    ${pageHeader('Tuesday, August 11', 'Good morning, Jamie', 'Here is what needs attention across Accounts Payable.')}
    <section class="metric-grid" aria-label="Invoice summary">
      <article class="metric"><span>Invoices waiting</span><strong>4</strong><small>2 received today</small></article>
      <article class="metric"><span>Needs validation</span><strong>2</strong><small>One possible duplicate</small></article>
      <article class="metric"><span>Ready to pay</span><strong>$12,480</strong><small>Across three vendors</small></article>
    </section>
    <section class="panel task-card" aria-label="Suggested walkthrough">
      <div class="step-number">1</div>
      <div><p class="eyebrow">Suggested demo workflow</p><h2>Process the Acme Office Supply invoice</h2><p>Follow one invoice across the Invoice Hub, Atlas ERP, and Clearline Payments.</p></div>
      <a class="button primary" href="${url('ap', '/inbox')}">Open invoice inbox ${icon('arrow')}</a>
    </section>
    ${testDataCard()}
  `,
    { title: 'Overview', landmark: 'Accounts Payable overview' },
  );
}

function testDataCard() {
  return `<details class="panel test-data">
    <summary>Safe sentinel data for privacy testing</summary>
    <p>Paste these values into the matching fields. They should become semantic tokens, never raw event data.</p>
    <div class="sentinels">
      <code>alex.person@example.com</code><code>+1 (312) 555-0188</code>
      <code>4111 1111 1111 1111</code><code>123-45-6789</code>
    </div>
  </details>`;
}

function invoiceInbox() {
  const rows = [
    [
      'INV-1042',
      'Acme Office Supply',
      '$2,840.00',
      'Needs validation',
      'Today, 9:42 AM',
    ],
    ['INV-1039', 'Kite & Harbor', '$740.00', 'Ready to pay', 'Yesterday'],
    ['INV-1038', 'Juniper Telecom', '$4,200.00', 'Needs approval', 'Yesterday'],
    ['INV-1031', 'Bayside Logistics', '$4,700.00', 'Ready to pay', 'Aug 8'],
  ];
  return shell(
    `
    ${pageHeader('Invoice operations', 'Invoice inbox', 'Review new invoices and route exceptions.', '<button class="button secondary" type="button" data-hash="filters">Filters</button>')}
    <section class="panel table-panel" aria-label="Invoice queue">
      <div class="toolbar"><label>Search invoices<input type="search" placeholder="Invoice or vendor" /></label><span>4 results</span></div>
      <table><thead><tr><th>Invoice</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Received</th></tr></thead>
      <tbody>${rows.map(([id, vendor, amount, status, received]) => `<tr><td><a href="${url('ap', `/invoices/${id}`)}"><strong>${id}</strong></a></td><td>${vendor}</td><td>${amount}</td><td><span class="status">${status}</span></td><td>${received}</td></tr>`).join('')}</tbody></table>
    </section>
    <p class="fixture-hint">Opening an invoice uses a traditional full-page navigation.</p>
  `,
    { title: 'Invoice inbox', landmark: 'Invoice queue' },
  );
}

function invoiceDetail() {
  return shell(
    `
    ${pageHeader('Invoice INV-1042', 'Acme Office Supply', 'Received today · Due August 28', `<a class="button secondary" href="${url('ap', '/inbox')}">Back to inbox</a>`)}
    <div id="validation-result"></div>
    <div class="two-column">
      <form class="panel form-panel" id="invoice-form" aria-label="Invoice review form">
        <div class="section-heading"><div>${icon('invoice')}</div><div><h2>Invoice details</h2><p>Confirm the extracted fields against the source.</p></div></div>
        <div class="field-grid">
          <label>Invoice number<input name="invoice-number" value="INV-1042" /></label>
          <label>Invoice date<input name="invoice-date" type="date" value="2026-08-11" /></label>
          <label>Amount<input name="amount" inputmode="decimal" value="2840.00" /></label>
          <label>Cost center<select name="cost-center"><option>Choose cost center</option><option>Operations — 4100</option><option>Facilities — 4200</option></select></label>
          <label>Vendor email<input name="vendor-email" type="email" placeholder="Use the email sentinel" /></label>
          <label>Vendor phone<input name="vendor-phone" type="tel" placeholder="Use the phone sentinel" /></label>
          <label class="wide">Review notes<textarea name="notes" placeholder="Add fictional notes only"></textarea></label>
          <label class="wide upload-zone">Supporting document<input name="attachment" type="file" accept=".pdf,.csv,.docx" /><span id="upload-summary">Choose a synthetic PDF or spreadsheet</span></label>
        </div>
        <div class="form-actions"><button class="button primary" type="submit">Validate invoice</button><button class="button quiet" type="button" data-spa="/invoices/INV-1042?mode=duplicate-check">Check for duplicates</button></div>
      </form>
      <aside class="side-stack">
        <section class="panel"><p class="eyebrow">Cross-system check</p><h2>Vendor master record</h2><p>Confirm payment terms and active status in Atlas ERP.</p><a class="button system-link" href="${url('erp', '/vendors/ACME-42')}">Open vendor in Atlas ERP ${icon('arrow')}</a></section>
        <section class="panel"><p class="eyebrow">Observation cues</p><ul class="check-list"><li>${icon('check')} Change two input fields</li><li>${icon('check')} Upload a synthetic file</li><li>${icon('check')} Use the SPA duplicate check</li><li>${icon('check')} Continue to another system</li></ul></section>
      </aside>
    </div>
    ${testDataCard()}
  `,
    { title: 'Invoice INV-1042', landmark: 'Invoice review workspace' },
  );
}

function privatePortal() {
  return shell(
    `
    ${pageHeader('Privacy exclusion fixture', 'Private vendor portal', 'This entire /private path should be excluded from observation.')}
    <section class="panel compact-form">
      <div class="privacy-banner">This route is intentionally sensitive. Configure <code>/private</code> as a privacy exclusion.</div>
      <form id="private-form" aria-label="Private vendor login">
        <label>Vendor portal email<input type="email" autocomplete="username" /></label>
        <label>Password<input type="password" autocomplete="current-password" /></label>
        <button class="button primary" type="submit">Sign in to vendor portal</button>
      </form>
    </section>
  `,
    { title: 'Private vendor portal', landmark: 'Excluded private portal' },
  );
}

function erpHome() {
  return shell(
    `
    ${pageHeader('Atlas ERP', 'Procurement workspace', 'Manage vendors and purchasing controls.')}
    <section class="panel task-card"><div class="step-number">2</div><div><p class="eyebrow">Continue the walkthrough</p><h2>Review the Acme vendor record</h2><p>Confirm active status and payment terms before creating the payment.</p></div><a class="button primary" href="${url('erp', '/vendors/ACME-42')}">Open vendor ${icon('arrow')}</a></section>
  `,
    { title: 'ERP home', landmark: 'Procurement overview' },
  );
}

function vendorDetail() {
  return shell(
    `
    ${pageHeader('Vendor ACME-42', 'Acme Office Supply', 'Active vendor · Last reviewed July 18', `<a class="button secondary" href="${url('ap', '/invoices/INV-1042')}">Return to invoice</a>`)}
    <div class="two-column">
      <form class="panel form-panel" id="vendor-form" aria-label="Vendor master review">
        <div class="section-heading"><div class="company-mark">A</div><div><h2>Vendor master record</h2><p>Validate purchasing and remittance details.</p></div></div>
        <div class="field-grid">
          <label>Vendor status<select><option>Active</option><option>On hold</option></select></label>
          <label>Payment terms<select><option>Net 30</option><option>Net 45</option></select></label>
          <label>Tax identifier<input placeholder="Use the government ID sentinel" /></label>
          <label>Remittance email<input type="email" placeholder="Use the email sentinel" /></label>
          <label class="wide">Review comment<textarea placeholder="Add a fictional review note"></textarea></label>
        </div>
        <div class="form-actions"><button class="button primary" type="submit">Confirm vendor details</button><button class="button quiet" type="button" data-spa="/vendors/ACME-42/audit">View audit history</button></div>
      </form>
      <aside class="side-stack">
        <section class="panel"><p class="eyebrow">Next system</p><h2>Set up the payment</h2><p>The vendor is active and approved for electronic payment.</p><a class="button system-link" href="${url('bank', '/payments/new')}">Open Clearline Payments ${icon('arrow')}</a></section>
        <section class="panel"><p class="eyebrow">Deliberate detour</p><p>Use this link to create a measurable backtrack in the observed trace.</p><a href="${url('erp', '/purchase-orders')}" data-spa="/purchase-orders">Check purchase orders</a></section>
      </aside>
    </div>
  `,
    { title: 'Vendor ACME-42', landmark: 'Vendor master workspace' },
  );
}

function purchaseOrders() {
  return shell(
    `
    ${pageHeader('Procurement', 'Purchase orders', 'This detour is intentionally unnecessary for the invoice workflow.')}
    <section class="panel empty-state"><div class="step-number">↩</div><h2>No matching purchase order required</h2><p>Return to the vendor record to continue. Reflow should later recognize this as navigation churn.</p><a class="button primary" href="${url('erp', '/vendors/ACME-42')}" data-spa="/vendors/ACME-42">Return to vendor</a></section>
  `,
    { title: 'Purchase orders', landmark: 'Purchase order search' },
  );
}

function bankHome() {
  return shell(
    `
    ${pageHeader('Clearline Payments', 'Cash position', 'Operating accounts and upcoming disbursements.')}
    <section class="panel task-card"><div class="step-number">3</div><div><p class="eyebrow">Continue the walkthrough</p><h2>Create the Acme payment</h2><p>Enter the approved amount and send it for authorization.</p></div><a class="button primary" href="${url('bank', '/payments/new')}">New payment ${icon('arrow')}</a></section>
  `,
    { title: 'Cash position', landmark: 'Treasury overview' },
  );
}

function paymentForm() {
  return shell(
    `
    ${pageHeader('Payments', 'Create vendor payment', 'Set up an ACH payment for an approved invoice.')}
    <div class="two-column">
      <form class="panel form-panel" id="payment-form" aria-label="Payment setup form">
        <div class="section-heading"><div class="company-mark">$</div><div><h2>Payment instructions</h2><p>All values are synthetic and remain local.</p></div></div>
        <div class="field-grid">
          <label>Vendor<input value="Acme Office Supply" /></label>
          <label>Invoice reference<input value="INV-1042" /></label>
          <label>Payment amount<input inputmode="decimal" value="2840.00" /></label>
          <label>Execution date<input type="date" /></label>
          <label class="wide">Test account or card value<input inputmode="numeric" placeholder="Use the payment-card sentinel" /></label>
          <label class="wide">Payment memo<textarea placeholder="Use a fictional memo"></textarea></label>
        </div>
        <div class="form-actions"><button class="button primary" type="submit">Submit for approval</button><a class="button quiet" href="${url('ap', '/invoices/INV-1042')}">Cancel</a></div>
      </form>
      <aside class="side-stack">
        <section class="panel"><p class="eyebrow">Out-of-scope test</p><h2>Open an unapproved system</h2><p>This uses 127.0.0.1 instead of localhost. Reflow should retain only an anonymous gap.</p><a class="button secondary" href="${url('outside', '/')}">Open external portal ${icon('arrow')}</a></section>
        <section class="panel"><p class="eyebrow">Tab activation test</p><p>Open the external portal in a new tab, then switch between it and this payment.</p><a href="${url('outside', '/reference')}">External reference in this tab</a></section>
      </aside>
    </div>
  `,
    { title: 'New payment', landmark: 'Payment setup workspace' },
  );
}

function paymentComplete() {
  return shell(
    `
    ${pageHeader('Payment submitted', 'Approval request created', 'Payment PAY-8831 is waiting for authorization.')}
    <section class="panel success-card"><div class="success-mark">${icon('check')}</div><p class="eyebrow">Workflow complete</p><h2>$2,840.00 submitted</h2><p>Download the reconciliation report, then return to the Invoice Hub and stop observation.</p><div class="completion-actions"><a class="button primary" href="${url('bank', '/download/reconciliation.csv')}" download>Download reconciliation CSV</a><a class="button secondary" href="${url('ap', '/invoices/INV-1042')}">Return to Invoice Hub</a></div></section>
  `,
    { title: 'Payment submitted', landmark: 'Payment confirmation' },
  );
}

function outsidePage() {
  return shell(
    `
    ${pageHeader('Unapproved hostname', 'External Reference Portal', 'This page is served locally but intentionally falls outside the localhost allowlist.')}
    <section class="panel compact-form"><div class="privacy-banner neutral">While observing, Reflow should record only one anonymous out-of-scope gap—never this hostname, route, or DOM.</div><form id="outside-form" aria-label="Unapproved reference form"><label>Confidential reference<input value="This must never be observed" /></label><label>Private notes<textarea>Unapproved page content</textarea></label><button class="button primary" type="submit">Search reference</button></form><a class="button secondary" href="${url('bank', '/payments/new')}">Return to approved payment system</a></section>
  `,
    { title: 'External portal', landmark: 'Unapproved external portal' },
  );
}

function render() {
  const app = document.querySelector('#app');
  const key = currentSystemKey();
  const path = window.location.pathname;
  let content;
  if (key === 'outside') content = outsidePage();
  else if (key === 'ap' && path === '/inbox') content = invoiceInbox();
  else if (key === 'ap' && path.startsWith('/invoices/'))
    content = invoiceDetail();
  else if (key === 'ap' && path.startsWith('/private/'))
    content = privatePortal();
  else if (key === 'ap') content = apHome();
  else if (key === 'erp' && path.startsWith('/vendors/'))
    content = vendorDetail();
  else if (key === 'erp' && path.startsWith('/purchase-orders'))
    content = purchaseOrders();
  else if (key === 'erp') content = erpHome();
  else if (key === 'bank' && path === '/payments/new') content = paymentForm();
  else if (key === 'bank' && path === '/payments/complete')
    content = paymentComplete();
  else content = bankHome();
  app.innerHTML = content;
  bindPageBehavior();
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function bindPageBehavior() {
  document.querySelectorAll('[data-spa]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      window.history.pushState({}, '', control.dataset.spa);
      render();
    });
  });
  document.querySelectorAll('[data-hash]').forEach((control) => {
    control.addEventListener('click', () => {
      window.location.hash = control.dataset.hash;
      showToast('Hash-route filter state applied');
    });
  });
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (form.id === 'payment-form') {
        window.history.pushState({}, '', '/payments/complete');
        render();
        return;
      }
      if (form.id === 'invoice-form') {
        window.location.hash = 'validated';
        const result = document.querySelector('#validation-result');
        if (result)
          result.innerHTML =
            '<div class="success-banner">Invoice fields validated. Continue to the vendor master record.</div>';
      }
      showToast('Synthetic form submitted');
    });
  });
  const upload = document.querySelector('input[type="file"]');
  upload?.addEventListener('change', () => {
    const files = [...(upload.files ?? [])];
    const summary = document.querySelector('#upload-summary');
    if (summary) {
      summary.textContent =
        files.length === 0
          ? 'No synthetic file selected'
          : `${files.length} synthetic file · ${files[0].type || 'other'} · ${files[0].size < 100000 ? 'small' : files[0].size < 5000000 ? 'medium' : 'large'}`;
    }
  });
}

window.addEventListener('popstate', render);
render();
