/* ========================================
   Autowork Online Lead Finder — Application Logic
   ======================================== */

// ---- PRODUCT KNOWLEDGE (embedded from JSON) ----
const PRODUCT = {
  name: 'Autowork Online',
  company: 'Klipboard',
  type: 'Garage Management System (GMS)',
  tagline: 'Trusted cloud-based management solution for workshops and garages',
  stat: 'Over 34% of UK garages still haven\'t adopted digital management systems (IMI)',
  marketSize: '23,000+ MOT centres and 30,000+ independent garages in the UK',
  website: 'https://autowork.online',
  features: [
    'Workshop & MOT diary management',
    'VRM/catalogue lookup with repair times',
    'Automated SMS & email reminders',
    'Online MOT booking for customers',
    'Stock management & purchase orders',
    'Full sales & purchase ledger',
    'Comprehensive reporting suite',
    'Point of sale facilities',
    'Work in Progress tracking',
    'Deferred Work / CRM',
    'Technician timesheets & targets',
    'Fault code information access',
    'Service schedules & repair times',
    'Cloud-based — runs in browser, no installation'
  ]
};

const PERSONAS = {
  owner: {
    title: 'Garage Owner / Manager',
    painPoints: [
      "Running the workshop on paper job cards and spreadsheets",
      "No visibility into which jobs are profitable and which aren't",
      "Customers slipping through the cracks — no automated follow-ups"
    ],
    cares: 'Keeping the workshop busy, maximising revenue per bay, retaining customers',
    hook: 'spending less time on admin and more time turning spanners'
  },
  receptionist: {
    title: 'Service Advisor / Receptionist',
    painPoints: [
      "Manually booking MOTs and services by phone — double bookings happen",
      "Can't quickly see what parts are in stock or prices",
      "Chasing customers for approvals on additional work"
    ],
    cares: 'Smooth scheduling, quick quoting, happy customers',
    hook: 'giving customers a modern booking experience and instant quotes'
  },
  technician: {
    title: 'Technician / Mechanic',
    painPoints: [
      "Paper job cards that get lost or damaged",
      "No access to repair times or fault codes at the workstation",
      "Time tracking is manual and inaccurate"
    ],
    cares: 'Clear job instructions, accurate time recording, less paperwork',
    hook: 'digital job cards with fault codes and repair times right at your bay'
  }
};

const PAIN_POINTS = [
  { pain: 'Paper-based job management', solution: 'Digital job cards, Work in Progress tracking, technician timesheets' },
  { pain: 'No online booking', solution: 'Customer-facing MOT online booking, automated reminders' },
  { pain: 'Stock blindness', solution: 'Stock management, automatic purchase order suggestions, stocktake tools' },
  { pain: 'Revenue leakage', solution: 'Deferred work tracking, comprehensive reporting, CRM features' },
  { pain: 'Manual quoting', solution: 'Integrated parts catalogue with repair times for instant, accurate quotes' },
  { pain: 'No customer follow-up', solution: 'Automated SMS/email reminders for MOT, services, deferred work' }
];

const MESSAGING_PILLARS = [
  { pillar: 'Cloud-Native', detail: 'Runs in your browser. No installation, no servers, no IT headaches. Access from any device.' },
  { pillar: 'Built for Garages', detail: 'Purpose-built for workshops — not a generic business tool adapted for automotive.' },
  { pillar: 'Get Booked Up', detail: 'Online MOT booking, automated reminders, and a proper diary keep your bays full.' },
  { pillar: 'Know Your Numbers', detail: 'See which jobs are profitable, track technician productivity, and spot opportunities.' },
  { pillar: 'Trusted by Thousands', detail: 'Used by thousands of garages across the UK and Ireland — from single-bay to multi-site.' }
];

// ---- API & BDR STATE ----
const API_BASE = '';
let currentBdr = null;  // { name, email }
let allClaims = [];     // All claimed leads from server
let allEnrichments = {};  // place_id -> enrichment data

// ---- APP STATE (in-memory only) ----
let state = {
  leads: [],
  outreachList: [],
  currentLocation: null,
  currentCoords: null,
  searchPhase: 0,
  selectedChannel: 'email',
  theme: 'light'
};

// ---- API CONFIG ----
// API key removed — all Google API calls go through backend proxy

// Search queries for different phases — garage-focused
const SEARCH_QUERIES_PHASE1 = [
  'car garage', 'MOT centre', 'auto repair workshop',
  'tyre shop', 'car service centre', 'vehicle repair'
];

const SEARCH_QUERIES_PHASE2 = [
  'MOT testing station', 'independent garage', 'car mechanic',
  'automotive workshop', 'exhaust centre', 'brake specialist'
];

const VERTICAL_KEYWORDS = {
  all: '',
  garage: 'car garage auto repair',
  mot: 'MOT testing centre',
  tyres: 'tyre shop tyre fitting',
  service: 'car service centre maintenance',
  bodyshop: 'body shop panel beating spray'
};

// --- CHAIN / LARGE BUSINESS DETECTION ---
const CHAIN_KEYWORDS = [
  'halfords', 'kwik fit', 'kwik-fit', 'ats euromaster', 'national tyres',
  'mr clutch', 'formula one autocentres', 'green flag', 'aa ', ' aa',
  'rac ', ' rac', 'plc', 'ltd group', 'group ltd', 'holdings',
  'nationwide', 'uk wide', 'across the uk',
  '100+ branches', '200+ branches', '50+ branches'
];

// GMS brand signatures for scanning
const GMS_BRANDS = [
  'techman', 'dragon2000', 'garagehive', 'mam software', 'motasoft',
  'workshop software', 'garage manager', 'iautomate', 'gemini systems',
  'pinnacle', 'autowork'
];

const BOOKING_WIDGETS = [
  'bookingflow', 'simplybook', 'calendly', 'bookinglive',
  'online booking', 'book now', 'book your mot', 'book online', 'book a service'
];

const AUTOMOTIVE_INDICATORS = [
  'mot', 'service', 'repair', 'diagnostic', 'brake', 'exhaust',
  'tyre', 'clutch', 'gearbox', 'bodywork', 'spray', 'respray'
];

// ---- DOM ELEMENTS ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  // Hide app layout initially, show login
  document.querySelector('.app-layout').style.display = 'none';
  initLogin();
  initTheme();
  initNavigation();
  initSearch();
  initOutreach();
  initMobileNav();
});

// ---- BDR LOGIN ----
function initLogin() {
  const loginBtn = document.getElementById('loginBtn');
  const loginInput = document.getElementById('loginEmail');
  const loginError = document.getElementById('loginError');

  loginBtn.addEventListener('click', () => attemptLogin());
  loginInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });

  async function attemptLogin() {
    const email = loginInput.value.trim().toLowerCase();
    if (!email) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    loginError.style.display = 'none';

    try {
      const resp = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Login failed');
      }

      const data = await resp.json();
      currentBdr = { name: data.name, email: data.email };
      showApp();
      loadAllClaims();
      loadAllEnrichments();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = 'block';
    }

    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
}

function showApp() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.querySelector('.app-layout').style.display = 'grid';

  // Update user indicator
  const indicator = document.getElementById('userIndicator');
  indicator.style.display = 'flex';
  document.getElementById('userName').textContent = currentBdr.name;
  document.getElementById('userAvatar').textContent = currentBdr.name.split(' ').map(n => n[0]).join('');

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentBdr = null;
    allClaims = [];
    document.getElementById('loginOverlay').style.display = 'flex';
    document.querySelector('.app-layout').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('userIndicator').style.display = 'none';
  });
}

async function loadAllClaims() {
  try {
    const resp = await fetch(`${API_BASE}/api/claims`);
    if (resp.ok) {
      allClaims = await resp.json();
      updateMyLeadsBadge();
    }
  } catch (err) {
    console.warn('Failed to load claims:', err);
  }
}

async function loadAllEnrichments() {
  try {
    const resp = await fetch(`${API_BASE}/api/enrichments`);
    if (resp.ok) {
      const data = await resp.json();
      allEnrichments = {};
      data.forEach(e => { allEnrichments[e.place_id] = e; });
    }
  } catch (err) {
    console.warn('Failed to load enrichments:', err);
  }
}

function getEnrichmentForLead(placeId) {
  return allEnrichments[placeId] || null;
}

function updateMyLeadsBadge() {
  if (!currentBdr) return;
  const myCount = allClaims.filter(c => c.bdr_email === currentBdr.email).length;
  const badge = document.getElementById('myLeadsBadge');
  badge.textContent = myCount;
  badge.style.display = myCount > 0 ? 'inline' : 'none';
}

// ---- LEAD CLAIMING ----
async function claimLead(placeId) {
  if (!currentBdr) return;
  const lead = state.leads.find(l => l.id === placeId);
  if (!lead) return;

  try {
    const resp = await fetch(`${API_BASE}/api/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        place_id: lead.id,
        lead_name: lead.name,
        lead_address: lead.address,
        lead_phone: lead.phone,
        lead_website: lead.website,
        lead_score: lead.score,
        lead_category: lead.category,
        lead_size: lead.estimatedSize || '',
        bdr_email: currentBdr.email,
        bdr_name: currentBdr.name
      })
    });

    if (resp.status === 409) {
      const err = await resp.json();
      showToast(err.detail, 'error');
      return;
    }

    if (!resp.ok) throw new Error('Claim failed');

    showToast(`Claimed ${lead.name}`, 'success');
    await loadAllClaims();
    renderResults();
  } catch (err) {
    showToast('Failed to claim lead. Try again.', 'error');
  }
}

function getClaimForLead(placeId) {
  return allClaims.find(c => c.place_id === placeId);
}

// ---- COMPANIES HOUSE ENRICHMENT ----
async function enrichLead(placeId) {
  const claim = getClaimForLead(placeId);
  const lead = state.leads.find(l => l.id === placeId);
  const leadName = claim ? claim.lead_name : (lead ? lead.name : '');
  if (!leadName) return;

  // Update button state
  const btn = document.querySelector(`.btn-enrich[data-id="${placeId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="enrich-spinner"></span> Enriching...';
  }

  try {
    const resp = await fetch(`${API_BASE}/api/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: placeId, lead_name: leadName })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || 'Enrichment failed');
    }

    const data = await resp.json();
    allEnrichments[placeId] = data;

    const directorCount = data.directors ? data.directors.length : 0;
    showToast(`Enriched ${leadName} — ${directorCount} director${directorCount !== 1 ? 's' : ''} found`, 'success');
    renderResults();
    if (document.querySelector('#panel-myleads.active')) {
      renderMyLeads();
    }
  } catch (err) {
    showToast(err.message || 'Enrichment failed', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '\uD83C\uDFE2 Enrich';
    }
  }
}

function renderEnrichmentPanel(enrichment) {
  if (!enrichment) return '';

  const companyAge = enrichment.date_of_creation ? getCompanyAge(enrichment.date_of_creation) : 'Unknown';
  const statusClass = enrichment.company_status === 'active' ? 'enrichment-active' : 'enrichment-inactive';
  const statusLabel = (enrichment.company_status || 'unknown').charAt(0).toUpperCase() + (enrichment.company_status || 'unknown').slice(1);

  let html = '<div class="enrichment-panel">';
  html += '<div class="enrichment-header"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.87M19 21V10.87"/></svg> Companies House</div>';

  // Company info row
  html += '<div class="enrichment-company-row">';
  html += `<span class="enrichment-company-name">${escapeHtml(enrichment.company_name_ch)}</span>`;
  html += `<span class="enrichment-status ${statusClass}">${statusLabel}</span>`;
  html += '</div>';

  // Details grid
  html += '<div class="enrichment-details">';
  html += `<div class="enrichment-detail"><span class="enrichment-label">Company No.</span><span class="enrichment-value">${escapeHtml(enrichment.company_number)}</span></div>`;
  html += `<div class="enrichment-detail"><span class="enrichment-label">Founded</span><span class="enrichment-value">${escapeHtml(enrichment.date_of_creation)} (${companyAge})</span></div>`;

  // SIC codes
  if (enrichment.sic_codes && enrichment.sic_codes.length > 0) {
    const sicLabels = enrichment.sic_descriptions && enrichment.sic_descriptions.length > 0
      ? enrichment.sic_descriptions
      : enrichment.sic_codes.map(c => `SIC ${c}`);
    html += `<div class="enrichment-detail enrichment-detail-full"><span class="enrichment-label">Industry (SIC)</span><span class="enrichment-value">${sicLabels.map(s => escapeHtml(s)).join('; ')}</span></div>`;
  }

  html += '</div>';

  // Directors
  if (enrichment.directors && enrichment.directors.length > 0) {
    html += '<div class="enrichment-directors">';
    html += `<div class="enrichment-label">Directors (${enrichment.directors.length})</div>`;
    enrichment.directors.forEach(d => {
      const role = d.role ? d.role.replace('director', 'Director').replace('secretary', 'Secretary') : '';
      html += `<div class="enrichment-director">`;
      html += `<span class="director-name">${escapeHtml(formatDirectorName(d.name))}</span>`;
      html += `<span class="director-role">${escapeHtml(role)}</span>`;
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function formatDirectorName(name) {
  if (!name) return '';
  const parts = name.split(',').map(p => p.trim());
  if (parts.length === 2) {
    const surname = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const firstNames = parts[1].split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(' ');
    return `${firstNames} ${surname}`;
  }
  return name;
}

function getCompanyAge(dateStr) {
  if (!dateStr) return 'Unknown';
  const created = new Date(dateStr);
  const now = new Date();
  const years = Math.floor((now - created) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) return 'Under 1 year';
  return `${years} year${years !== 1 ? 's' : ''}`;
}

function getFirstDirectorName(placeId) {
  const enrichment = getEnrichmentForLead(placeId);
  if (enrichment && enrichment.directors && enrichment.directors.length > 0) {
    return formatDirectorName(enrichment.directors[0].name);
  }
  return null;
}

function getFirstDirectorFirstName(placeId) {
  const fullName = getFirstDirectorName(placeId);
  if (fullName) {
    return fullName.split(' ')[0];
  }
  return null;
}

async function updateHubspotStatus(placeId, newStatus) {
  if (!currentBdr) return;
  try {
    const resp = await fetch(`${API_BASE}/api/hubspot-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: placeId, hubspot_status: newStatus, bdr_email: currentBdr.email })
    });
    if (resp.ok) {
      await loadAllClaims();
      renderMyLeads();
      showToast('HubSpot status updated', 'success');
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

function showHubspotReminder(placeId) {
  const claim = getClaimForLead(placeId);
  if (!claim) return;

  const enrichment = getEnrichmentForLead(placeId);

  let enrichmentFields = '';
  if (enrichment) {
    const directors = enrichment.directors || [];
    const directorNames = directors.map(d => formatDirectorName(d.name)).join(', ');
    const sicDescs = (enrichment.sic_descriptions || []).join('; ');
    enrichmentFields = `
        <div class="modal-field" style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:2px solid var(--color-primary-highlight);">
          <strong style="color:var(--color-primary);">Companies House Data</strong>
        </div>
        <div class="modal-field"><strong>Registered Name:</strong> ${escapeHtml(enrichment.company_name_ch)}</div>
        <div class="modal-field"><strong>Company No.:</strong> ${escapeHtml(enrichment.company_number)}</div>
        <div class="modal-field"><strong>Status:</strong> ${escapeHtml(enrichment.company_status)}</div>
        <div class="modal-field"><strong>Founded:</strong> ${escapeHtml(enrichment.date_of_creation)}</div>
        ${sicDescs ? `<div class="modal-field"><strong>Industry (SIC):</strong> ${escapeHtml(sicDescs)}</div>` : ''}
        ${directorNames ? `<div class="modal-field"><strong>Directors:</strong> ${escapeHtml(directorNames)}</div>` : ''}
    `;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <h3 class="modal-title">Create Lead in HubSpot</h3>
      <p class="modal-desc">Copy the details below to create this lead in HubSpot:</p>
      <div class="modal-details">
        <div class="modal-field"><strong>Company:</strong> ${escapeHtml(claim.lead_name)}</div>
        <div class="modal-field"><strong>Address:</strong> ${escapeHtml(claim.lead_address)}</div>
        <div class="modal-field"><strong>Phone:</strong> ${escapeHtml(claim.lead_phone)}</div>
        <div class="modal-field"><strong>Website:</strong> ${escapeHtml(claim.lead_website)}</div>
        <div class="modal-field"><strong>Lead Score:</strong> ${claim.lead_score} (${escapeHtml(claim.lead_category)})</div>
        <div class="modal-field"><strong>Owner:</strong> ${escapeHtml(claim.bdr_name)}</div>
        ${enrichmentFields}
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary modal-copy-btn">Copy All Details</button>
        <button class="btn btn-secondary modal-done-btn">I've Created It</button>
        <button class="btn btn-ghost modal-close-btn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.modal-copy-btn').addEventListener('click', () => {
    let text = `Company: ${claim.lead_name}\nAddress: ${claim.lead_address}\nPhone: ${claim.lead_phone}\nWebsite: ${claim.lead_website}\nLead Score: ${claim.lead_score} (${claim.lead_category})\nOwner: ${claim.bdr_name}`;
    if (enrichment) {
      text += `\n\n--- Companies House ---\nRegistered Name: ${enrichment.company_name_ch}\nCompany No.: ${enrichment.company_number}\nStatus: ${enrichment.company_status}\nFounded: ${enrichment.date_of_creation}`;
      if (enrichment.sic_descriptions && enrichment.sic_descriptions.length > 0) {
        text += `\nIndustry: ${enrichment.sic_descriptions.join('; ')}`;
      }
      if (enrichment.directors && enrichment.directors.length > 0) {
        text += `\nDirectors: ${enrichment.directors.map(d => formatDirectorName(d.name)).join(', ')}`;
      }
    }
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
  });

  modal.querySelector('.modal-done-btn').addEventListener('click', () => {
    updateHubspotStatus(placeId, 'created');
    modal.remove();
  });

  modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ---- MY LEADS RENDERING ----
function renderMyLeads() {
  if (!currentBdr) return;
  const myClaims = allClaims.filter(c => c.bdr_email === currentBdr.email);
  const emptyEl = document.getElementById('myLeadsEmpty');
  const tableWrap = document.getElementById('myLeadsTableWrap');
  const tbody = document.getElementById('myLeadsTableBody');

  if (myClaims.length === 0) {
    emptyEl.style.display = 'flex';
    tableWrap.style.display = 'none';
    return;
  }
  emptyEl.style.display = 'none';
  tableWrap.style.display = 'block';

  const hubspotLabels = { 'not_created': '\u26A0\uFE0F Not Created', 'created': '\u2705 Created', 'synced': '\uD83D\uDD04 Synced' };

  tbody.innerHTML = myClaims.map(c => {
    const badgeClass = c.lead_category === 'hot' ? 'badge-hot' : c.lead_category === 'warm' ? 'badge-warm' : 'badge-cool';
    const claimedDate = new Date(c.claimed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const enrichment = getEnrichmentForLead(c.place_id);
    let enrichCol = '<span style="color:var(--color-text-faint);font-size:var(--text-xs);">Not enriched</span>';
    if (enrichment) {
      const dirCount = enrichment.directors ? enrichment.directors.length : 0;
      const firstDir = dirCount > 0 ? formatDirectorName(enrichment.directors[0].name) : '';
      enrichCol = `<div style="font-size:var(--text-xs);">`;
      enrichCol += `<div style="font-weight:500;color:var(--color-text);">${escapeHtml(enrichment.company_name_ch)}</div>`;
      enrichCol += `<div style="color:var(--color-text-muted);">${escapeHtml(enrichment.company_status)} &middot; ${escapeHtml(enrichment.date_of_creation)}</div>`;
      if (firstDir) {
        enrichCol += `<div style="color:var(--color-primary);">${escapeHtml(firstDir)}${dirCount > 1 ? ` +${dirCount - 1} more` : ''}</div>`;
      }
      enrichCol += '</div>';
    }
    return `<tr>
      <td><strong style="font-size:var(--text-sm);">${escapeHtml(c.lead_name)}</strong>
        ${c.lead_website ? `<br><a href="${escapeHtml(c.lead_website)}" target="_blank" rel="noopener noreferrer" style="font-size:var(--text-xs);color:var(--color-primary);text-decoration:none;">${truncateUrl(c.lead_website)}</a>` : ''}</td>
      <td>${escapeHtml(c.lead_address)}</td>
      <td style="font-variant-numeric:tabular-nums;">${escapeHtml(c.lead_phone)}</td>
      <td><span class="lead-score-badge ${badgeClass}">${c.lead_score}</span></td>
      <td>${enrichCol}</td>
      <td><button class="btn btn-sm ${c.hubspot_status === 'not_created' ? 'btn-hubspot-warn' : 'btn-hubspot-ok'} btn-hs-toggle" data-id="${c.place_id}" data-status="${c.hubspot_status}">${hubspotLabels[c.hubspot_status] || c.hubspot_status}</button></td>
      <td style="font-size:var(--text-xs);color:var(--color-text-muted);">${claimedDate}</td>
      <td class="td-actions">
        ${!enrichment ? `<button class="btn btn-ghost btn-sm btn-enrich-table" data-id="${c.place_id}" data-name="${escapeHtml(c.lead_name)}" title="Enrich via Companies House">\uD83C\uDFE2</button>` : ''}
        <button class="btn btn-ghost btn-sm btn-hs-create" data-id="${c.place_id}" title="HubSpot details">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-hs-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const currentStatus = btn.dataset.status;
      const nextStatus = currentStatus === 'not_created' ? 'created' : currentStatus === 'created' ? 'synced' : 'not_created';
      updateHubspotStatus(btn.dataset.id, nextStatus);
    });
  });

  tbody.querySelectorAll('.btn-hs-create').forEach(btn => {
    btn.addEventListener('click', () => showHubspotReminder(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-enrich-table').forEach(btn => {
    btn.addEventListener('click', async () => {
      const placeId = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const resp = await fetch(`${API_BASE}/api/enrich`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ place_id: placeId, lead_name: btn.dataset.name })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.detail || 'Enrichment failed');
        }
        const data = await resp.json();
        allEnrichments[placeId] = data;
        showToast(`Enriched ${btn.dataset.name}`, 'success');
        renderMyLeads();
      } catch (err) {
        showToast(err.message || 'Enrichment failed', 'error');
        btn.disabled = false;
        btn.textContent = '\uD83C\uDFE2';
      }
    });
  });
}

// ---- THEME ----
function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = prefersDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);

  $('[data-theme-toggle]').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
  });
}

// ---- NAVIGATION ----
function initNavigation() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('.nav-item').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');

      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      $(`#panel-${tab}`).classList.add('active');

      const titles = { finder: 'Lead Finder', outreach: 'Outreach Generator', list: 'Outreach List', myleads: 'My Leads', insights: 'Market Insights' };
      $('#pageTitle').textContent = titles[tab] || 'Lead Finder';

      if (tab === 'outreach') updateOutreachLeadSelect();
      if (tab === 'list') renderOutreachList();
      if (tab === 'myleads') renderMyLeads();

      // Close mobile nav
      $('#sidebar').classList.remove('open');
    });
  });
}

function initMobileNav() {
  $('#mobileNavToggle').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const sidebar = $('#sidebar');
    const toggle = $('#mobileNavToggle');
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ---- SEARCH ----
function initSearch() {
  $('#searchBtn').addEventListener('click', performSearch);
  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  $('#loadMoreBtn').addEventListener('click', loadMore);
  $('#scoreFilter').addEventListener('change', renderResults);
  $('#sizeFilter').addEventListener('change', renderResults);
}

async function performSearch() {
  const location = $('#searchInput').value.trim();
  if (!location) return;

  state.searchPhase = 0;
  state.leads = [];
  state.currentLocation = location;

  showSkeleton();
  hideEmpty();

  try {
    // Geocode the location
    const coords = await geocodeLocation(location);
    if (!coords) {
      showToast('Location not found. Try a different search.', 'error');
      hideSkeleton();
      showEmpty();
      return;
    }
    state.currentCoords = coords;

    // Run parallel queries
    const radius = parseInt($('#radiusSelect').value);
    const vertical = $('#verticalSelect').value;
    const results = await runSearchQueries(SEARCH_QUERIES_PHASE1, coords, radius, location, vertical);

    state.leads = deduplicateLeads(results);
    scoreLeads();

    hideSkeleton();
    renderResults();
    showStats();
    $('#loadMoreWrap').style.display = 'flex';
  } catch (err) {
    console.error('Search error:', err);
    showToast('Search failed. Please try again.', 'error');
    hideSkeleton();
    showEmpty();
  }
}

async function loadMore() {
  if (!state.currentCoords) return;

  const btn = $('#loadMoreBtn');
  btn.disabled = true;
  btn.textContent = 'Searching...';

  try {
    state.searchPhase++;
    const radius = parseInt($('#radiusSelect').value);
    const vertical = $('#verticalSelect').value;
    const queries = state.searchPhase === 1 ? SEARCH_QUERIES_PHASE2 : SEARCH_QUERIES_PHASE1.map(q => q + ' near me');

    const results = await runSearchQueries(queries, state.currentCoords, radius, state.currentLocation, vertical);
    const newLeads = deduplicateLeads([...state.leads, ...results]);
    const addedCount = newLeads.length - state.leads.length;

    state.leads = newLeads;
    scoreLeads();
    renderResults();
    showStats();

    showToast(`Found ${addedCount} additional lead${addedCount !== 1 ? 's' : ''}.`, addedCount > 0 ? 'success' : 'info');
  } catch (err) {
    console.error('Load more error:', err);
    showToast('Could not load more results.', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Load More Leads';
}

async function geocodeLocation(location) {
  const suffix = location.toLowerCase().includes('ireland') ? '' : ', UK';
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(location + suffix)}&key=${API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

async function runSearchQueries(queries, coords, radius, locationName, vertical) {
  const verticalKeyword = VERTICAL_KEYWORDS[vertical] || '';

  const promises = queries.map(query => {
    const fullQuery = verticalKeyword ? `${query} ${verticalKeyword} near ${locationName}` : `${query} near ${locationName}`;
    return searchPlaces(fullQuery, coords, radius);
  });

  const results = await Promise.allSettled(promises);
  const allPlaces = [];

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      allPlaces.push(...r.value);
    }
  });

  return allPlaces;
}

async function searchPlaces(textQuery, coords, radius) {
  try {
    const resp = await fetch(`${API_BASE}/api/places-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text_query: textQuery,
        latitude: coords.lat,
        longitude: coords.lng,
        radius: radius
      })
    });

    const data = await resp.json();
    if (data.places) {
      return data.places.map(p => ({
        id: p.id,
        name: p.displayName?.text || 'Unknown',
        address: p.formattedAddress || '',
        phone: p.nationalPhoneNumber || '',
        website: p.websiteUri || '',
        rating: p.rating || 0,
        reviewCount: p.userRatingCount || 0,
        types: p.types || [],
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        businessStatus: p.businessStatus || '',
        score: 0,
        category: 'cool',
        scanned: false,
        scanResults: null,
        inOutreachList: false,
        notes: ''
      }));
    }
    return [];
  } catch (err) {
    console.warn('Places query failed:', textQuery, err);
    return [];
  }
}

function deduplicateLeads(leads) {
  const seen = new Map();
  leads.forEach(lead => {
    if (!seen.has(lead.id)) {
      seen.set(lead.id, lead);
    }
  });
  return Array.from(seen.values());
}

// ---- BUSINESS SIZE ESTIMATION ----
function estimateBusinessSize(lead) {
  const name = lead.name.toLowerCase();
  const address = (lead.address || '').toLowerCase();
  const combined = name + ' ' + address;

  // Check against known large chains
  const isKnownChain = CHAIN_KEYWORDS.some(kw => combined.includes(kw));
  if (isKnownChain) return 'large';

  // High review count is a strong proxy for larger businesses
  if (lead.reviewCount > 200) return 'large';
  if (lead.reviewCount > 80) return 'medium-large';

  // Patterns suggesting large national businesses
  if (/\b(branch|branches|nationwide|national)\b/i.test(combined)) return 'large';
  if (/\b(head office|headquarters|hq)\b/i.test(combined)) return 'medium-large';

  // Low reviews = likely small, local garage (Autowork Online sweet spot)
  if (lead.reviewCount <= 15) return 'small';
  if (lead.reviewCount <= 50) return 'small-medium';

  return 'medium';
}

// ---- LEAD SCORING (garage-specific) ----
function scoreLeads() {
  state.leads.forEach(lead => {
    let score = 0;
    const size = estimateBusinessSize(lead);
    lead.estimatedSize = size;

    // === SIZE-BASED SCORING ===
    // Autowork Online targets small/growing independent garages
    switch (size) {
      case 'small':        score += 30; break;  // Small independent garage — prime target
      case 'small-medium': score += 25; break;  // Growing garage — ideal ICP
      case 'medium':       score += 15; break;  // Established but may still need GMS
      case 'medium-large': score += 0;  break;  // Borderline — may already have systems
      case 'large':        score -= 20; break;  // Too big — chain or franchise
    }

    // === DIGITAL PRESENCE SCORING ===
    // No website = paper-based garage, prime target
    if (!lead.website) {
      score += 20;
    } else {
      score += 5; // Has a website — neutral
    }

    // === BUSINESS TYPE SCORING ===
    const typeStr = (lead.types || []).join(' ').toLowerCase() + ' ' + lead.name.toLowerCase();
    if (typeStr.includes('car_repair') || typeStr.includes('garage') || typeStr.includes('mot')) score += 15;
    else if (typeStr.includes('auto') || typeStr.includes('mechanic') || typeStr.includes('workshop')) score += 10;

    // === RATING SCORING ===
    if (lead.rating >= 4.0 && lead.rating <= 5.0) score += 5;

    // === SCAN-BASED ADJUSTMENTS (after website deep scan) ===
    if (lead.scanned && lead.scanResults) {
      const sr = lead.scanResults;

      // Digital readiness adjustments
      if (sr.digitalReadiness === 'low')    score += 20;  // Very basic digital = needs Autowork Online
      if (sr.digitalReadiness === 'medium') score += 10;  // Some digital but gaps
      if (sr.digitalReadiness === 'high')   score -= 10;  // Already sophisticated

      // GMS detected = already has competitor!
      if (sr.gmsDetected) score -= 25;

      // Online booking detected = more digitally mature
      if (sr.onlineBookingDetected) score -= 10;

      // Automotive B2B indicators = good fit
      if (sr.automotiveIndicators && sr.automotiveIndicators.length > 0) score += 10;

      // Multiple locations = good sign, multi-site need
      if (sr.multipleLocations) score += 5;
    }

    score = Math.max(0, Math.min(100, score));
    lead.score = score;
    lead.category = score >= 65 ? 'hot' : score >= 40 ? 'warm' : 'cool';
  });

  // Sort by score descending
  state.leads.sort((a, b) => b.score - a.score);
}

// Re-score leads without re-sorting — used after scan to prevent card jumping
function scoreLeadsNoSort() {
  state.leads.forEach(lead => {
    let score = 0;
    const size = estimateBusinessSize(lead);
    lead.estimatedSize = size;

    switch (size) {
      case 'small':        score += 30; break;
      case 'small-medium': score += 25; break;
      case 'medium':       score += 15; break;
      case 'medium-large': score += 0;  break;
      case 'large':        score -= 20; break;
    }

    if (!lead.website) {
      score += 20;
    } else {
      score += 5;
    }

    const typeStr = (lead.types || []).join(' ').toLowerCase() + ' ' + lead.name.toLowerCase();
    if (typeStr.includes('car_repair') || typeStr.includes('garage') || typeStr.includes('mot')) score += 15;
    else if (typeStr.includes('auto') || typeStr.includes('mechanic') || typeStr.includes('workshop')) score += 10;

    if (lead.rating >= 4.0 && lead.rating <= 5.0) score += 5;

    if (lead.scanned && lead.scanResults) {
      const sr = lead.scanResults;
      if (sr.digitalReadiness === 'low')    score += 20;
      if (sr.digitalReadiness === 'medium') score += 10;
      if (sr.digitalReadiness === 'high')   score -= 10;
      if (sr.gmsDetected) score -= 25;
      if (sr.onlineBookingDetected) score -= 10;
      if (sr.automotiveIndicators && sr.automotiveIndicators.length > 0) score += 10;
      if (sr.multipleLocations) score += 5;
    }

    score = Math.max(0, Math.min(100, score));
    lead.score = score;
    lead.category = score >= 65 ? 'hot' : score >= 40 ? 'warm' : 'cool';
  });
  // Deliberately no sort — keeps cards in same position
}

function scrollToCard(placeId) {
  requestAnimationFrame(() => {
    const card = document.querySelector(`.lead-card[data-id="${placeId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight flash
      card.style.boxShadow = '0 0 0 3px var(--color-primary)';
      setTimeout(() => { card.style.boxShadow = ''; }, 1500);
    }
  });
}

// ---- RENDERING ----
function renderResults() {
  const grid = $('#resultsGrid');
  const filter = $('#scoreFilter').value;

  let filtered = state.leads;
  if (filter === 'hot') filtered = state.leads.filter(l => l.category === 'hot');
  else if (filter === 'warm') filtered = state.leads.filter(l => l.category === 'hot' || l.category === 'warm');

  // Apply size filter
  const sizeFilter = $('#sizeFilter') ? $('#sizeFilter').value : 'small';
  if (sizeFilter === 'small') {
    filtered = filtered.filter(l => ['small', 'small-medium'].includes(l.estimatedSize));
  } else if (sizeFilter === 'smallmed') {
    filtered = filtered.filter(l => ['small', 'small-medium', 'medium'].includes(l.estimatedSize));
  }
  // 'all' = no size filter

  if (filtered.length === 0 && state.leads.length > 0) {
    grid.innerHTML = '<div class="empty-state"><h3>No leads match these filters</h3><p>Try adjusting the size or score filters to see more results.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(lead => renderLeadCard(lead)).join('');

  // Attach event handlers
  grid.querySelectorAll('.btn-add-list').forEach(btn => {
    btn.addEventListener('click', () => addToOutreachList(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-scan').forEach(btn => {
    btn.addEventListener('click', () => scanWebsite(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-outreach').forEach(btn => {
    btn.addEventListener('click', () => goToOutreach(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-claim').forEach(btn => {
    btn.addEventListener('click', () => claimLead(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-hs-remind').forEach(btn => {
    btn.addEventListener('click', () => showHubspotReminder(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-enrich').forEach(btn => {
    btn.addEventListener('click', () => enrichLead(btn.dataset.id));
  });

  // Scan panel toggle (show more/less)
  grid.querySelectorAll('.scan-toggle-btn').forEach(btn => {
    const panel = btn.previousElementSibling;
    if (!panel || !panel.classList.contains('scan-panel')) {
      const scanPanel = btn.closest('.lead-card')?.querySelector('.scan-panel');
      if (scanPanel && scanPanel.scrollHeight <= scanPanel.clientHeight + 2) {
        btn.style.display = 'none';
      }
    } else if (panel.scrollHeight <= panel.clientHeight + 2) {
      btn.style.display = 'none';
    }
    btn.addEventListener('click', () => {
      const scanPanel = btn.closest('.lead-card')?.querySelector('.scan-panel');
      if (!scanPanel) return;
      scanPanel.classList.toggle('expanded');
      btn.textContent = scanPanel.classList.contains('expanded') ? 'Show less' : 'Show more';
    });
  });
}

function renderLeadCard(lead) {
  const badgeClass = lead.category === 'hot' ? 'badge-hot' : lead.category === 'warm' ? 'badge-warm' : 'badge-cool';
  const categoryLabel = lead.category === 'hot' ? 'Hot Lead' : lead.category === 'warm' ? 'Warm Lead' : 'Cool Lead';
  const inList = state.outreachList.some(l => l.id === lead.id);
  const typeLabel = inferBusinessType(lead);

  let scanHtml = '';
  if (lead.scanned && lead.scanResults) {
    scanHtml = renderScanPanel(lead.scanResults);
  }

  // Enrichment panel
  const enrichment = getEnrichmentForLead(lead.id);
  let enrichmentHtml = '';
  if (enrichment) {
    enrichmentHtml = renderEnrichmentPanel(enrichment);
  }

  // Ownership badge
  const claim = getClaimForLead(lead.id);
  let ownershipHtml = '';
  if (claim) {
    const isMine = currentBdr && claim.bdr_email === currentBdr.email;
    if (isMine) {
      ownershipHtml = '<div class="ownership-badge ownership-mine"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Claimed by you</div>';
    } else {
      ownershipHtml = `<div class="ownership-badge ownership-other"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Claimed by ${escapeHtml(claim.bdr_name)}</div>`;
    }
  }

  // Actions — claim-aware
  const isMine = claim && currentBdr && claim.bdr_email === currentBdr.email;
  const isOther = claim && !isMine;

  let actionsHtml = '';
  if (!claim) {
    actionsHtml += `<button class="btn btn-sm btn-primary btn-claim" data-id="${lead.id}">Claim Lead</button>`;
  }
  if (!isOther) {
    actionsHtml += `<button class="btn btn-sm ${inList ? 'btn-secondary' : 'btn-secondary'} btn-add-list" data-id="${lead.id}" ${inList ? 'disabled' : ''}>${inList ? '\u2713 In List' : '+ Add to List'}</button>`;
  }
  if (isMine && claim.hubspot_status === 'not_created') {
    actionsHtml += `<button class="btn btn-sm btn-hubspot-remind btn-hs-remind" data-id="${lead.id}" title="Click after creating in HubSpot">\uD83D\uDD14 Create in HubSpot</button>`;
  }
  if (lead.website && !lead.scanned) {
    actionsHtml += `<button class="btn btn-sm btn-secondary btn-scan" data-id="${lead.id}">Scan</button>`;
  }
  if (lead.scanned) {
    actionsHtml += '<span class="lead-tag" style="background:var(--color-success-bg);color:var(--color-success);">Scanned</span>';
  }
  // Enrich button (for claimed leads only, not yet enriched)
  if (isMine && !enrichment) {
    actionsHtml += `<button class="btn btn-sm btn-enrich" data-id="${lead.id}">\uD83C\uDFE2 Enrich</button>`;
  }
  if (enrichment) {
    actionsHtml += '<span class="lead-tag" style="background:var(--color-primary-highlight);color:var(--color-primary);">Enriched</span>';
  }
  if (!isOther && inList) {
    actionsHtml += `<button class="btn btn-sm btn-ghost btn-outreach" data-id="${lead.id}">Outreach</button>`;
  }

  return `
    <div class="lead-card" data-id="${lead.id}">
      <div class="lead-card-header">
        <div class="lead-name">${escapeHtml(lead.name)}</div>
        <span class="lead-score-badge ${badgeClass}">${categoryLabel} \u00B7 ${lead.score}</span>
      </div>
      ${ownershipHtml}
      <div class="lead-details">
        <div class="lead-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${escapeHtml(lead.address)}</span>
        </div>
        ${lead.phone ? `<div class="lead-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>${escapeHtml(lead.phone)}</span>
        </div>` : ''}
        ${lead.website ? `<div class="lead-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer">${truncateUrl(lead.website)}</a>
        </div>` : '<div class="lead-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg><span style="color:var(--color-warning);">No website \u2014 likely paper-based garage</span></div>'}
      <div class="lead-detail">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <span class="size-tag size-${lead.estimatedSize || 'unknown'}">${getSizeLabel(lead.estimatedSize)}</span>
      </div>
      </div>
      <div class="lead-meta">
        ${lead.rating > 0 ? `<span class="lead-tag">\u2605 ${lead.rating.toFixed(1)} (${lead.reviewCount})</span>` : ''}
        ${typeLabel ? `<span class="lead-tag">${escapeHtml(typeLabel)}</span>` : ''}
      </div>
      <div class="lead-actions">
        ${actionsHtml}
      </div>
      ${scanHtml}
      ${enrichmentHtml}
    </div>
  `;
}

function renderScanPanel(sr) {
  const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  const xIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // Readiness colours
  const readinessColors = {
    low: 'var(--color-success)',       // Low digital = good prospect for Autowork Online
    medium: 'var(--color-warning)',
    high: 'var(--color-error)',          // High digital = may not need Autowork Online
    unknown: 'var(--color-text-faint)'
  };
  const readinessLabels = {
    low: 'Low \u2014 Strong prospect',
    medium: 'Medium \u2014 Some digital tools',
    high: 'High \u2014 Already sophisticated',
    unknown: 'Unknown \u2014 Scan failed'
  };
  const readinessColor = readinessColors[sr.digitalReadiness] || readinessColors.unknown;
  const readinessLabel = readinessLabels[sr.digitalReadiness] || readinessLabels.unknown;

  let html = '<div class="scan-panel">';

  // Digital Readiness Gauge
  html += `<div class="scan-readiness-header">
    <div class="readiness-gauge">
      <div class="readiness-bar">
        <div class="readiness-fill" style="width:${sr.readinessScore}%;background:${readinessColor};"></div>
      </div>
      <div class="readiness-label" style="color:${readinessColor};">
        <strong>Digital Readiness: ${(sr.digitalReadiness || 'unknown').toUpperCase()}</strong>
        <span>${readinessLabel}</span>
      </div>
    </div>
  </div>`;

  // GMS Detection
  if (sr.gmsDetected) {
    html += `<div class="scan-row scan-warning">${xIcon} <strong>GMS Detected:</strong>&nbsp;${escapeHtml(sr.gmsName || 'Unknown GMS')} \u2014 competitor system in place!</div>`;
  } else {
    html += `<div class="scan-row scan-found">${checkIcon} <strong>No GMS detected</strong> \u2014 open opportunity</div>`;
  }

  // Online booking presence
  if (sr.onlineBookingDetected) {
    html += `<div class="scan-row scan-neutral">${xIcon} <strong>Online booking found</strong> \u2014 more digitally mature</div>`;
  } else {
    html += `<div class="scan-row scan-found">${checkIcon} <strong>No online booking</strong> \u2014 Autowork Online can fill this gap</div>`;
  }

  // Findings list
  if (sr.signals && sr.signals.length > 0) {
    html += '<div class="scan-findings">';
    sr.signals.forEach(signal => {
      const isPositiveForUs = signal.includes('Basic') || signal.includes('Could not');
      const icon = isPositiveForUs ? checkIcon : xIcon;
      const cls = isPositiveForUs ? 'scan-found' : 'scan-neutral';
      html += `<div class="scan-row ${cls}">${icon} ${escapeHtml(signal)}</div>`;
    });
    html += '</div>';
  }

  // Automotive indicators
  if (sr.automotiveIndicators && sr.automotiveIndicators.length > 0) {
    html += `<div class="scan-row scan-found">${checkIcon} <strong>Automotive signals:</strong>&nbsp;${escapeHtml(sr.automotiveIndicators.join(', '))}</div>`;
  }

  // Social media presence
  if (sr.socialMedia) {
    const socials = [];
    if (sr.socialMedia.facebook) socials.push('Facebook');
    if (sr.socialMedia.instagram) socials.push('Instagram');
    if (sr.socialMedia.linkedin) socials.push('LinkedIn');
    if (sr.socialMedia.twitter) socials.push('Twitter/X');
    if (socials.length > 0) {
      html += `<div class="scan-row scan-neutral">${checkIcon} <strong>Social:</strong>&nbsp;${socials.join(', ')}</div>`;
    }
  }

  // Multi-location
  if (sr.multipleLocations) {
    html += `<div class="scan-row scan-found">${checkIcon} Multiple locations \u2014 multi-site need</div>`;
  }

  // GMS disclaimer
  html += '<div class="scan-disclaimer">Based on homepage scan for known GMS signatures. Many systems are backend-only \u2014 always confirm during outreach.</div>';

  html += '</div>';

  // Add toggle button for long scan panels
  html += '<button class="scan-toggle-btn" data-action="toggle-scan">Show more</button>';

  return html;
}

function inferBusinessType(lead) {
  const name = lead.name.toLowerCase();
  const types = (lead.types || []).join(' ').toLowerCase();
  const combined = name + ' ' + types;

  if (combined.includes('mot')) return 'MOT Centre';
  if (combined.includes('tyre') || combined.includes('tire')) return 'Tyre & Fitting';
  if (combined.includes('body') || combined.includes('panel') || combined.includes('spray')) return 'Body Shop';
  if (combined.includes('service centre') || combined.includes('service center')) return 'Service Centre';
  if (combined.includes('exhaust')) return 'Exhaust Centre';
  if (combined.includes('brake')) return 'Brake Specialist';
  if (combined.includes('diagnostic')) return 'Diagnostics';
  if (combined.includes('mechanic')) return 'Mechanic';
  if (combined.includes('garage') || combined.includes('auto repair') || combined.includes('car_repair')) return 'Garage';
  if (combined.includes('workshop')) return 'Workshop';
  return '';
}

// ---- WEBSITE SCANNING (Digital Readiness) \u2014 via server-side endpoint ----
async function scanWebsite(placeId) {
  const lead = state.leads.find(l => l.id === placeId);
  if (!lead || !lead.website || lead.scanned) return;

  const btn = document.querySelector(`.btn-scan[data-id="${placeId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning...';
  }

  try {
    const resp = await fetch(`${API_BASE}/api/scan-website`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: lead.website }),
      signal: AbortSignal.timeout(20000)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.detail || `Server returned ${resp.status}`);
    }

    const scanResults = await resp.json();

    lead.scanned = true;
    lead.scanResults = scanResults;

    // Re-score without re-sorting (prevents card jumping)
    scoreLeadsNoSort();
    renderResults();
    showStats();
    scrollToCard(placeId);
    showToast(`Scanned ${lead.name} \u2014 Digital Readiness: ${scanResults.digitalReadiness.toUpperCase()}`, 'success');
  } catch (err) {
    console.warn('Scan failed:', err);
    lead.scanned = true;
    lead.scanResults = {
      digitalReadiness: 'unknown',
      readinessScore: 0,
      gmsDetected: false,
      gmsName: null,
      onlineBookingDetected: false,
      hasBasicSiteOnly: false,
      automotiveIndicators: [],
      techStack: [],
      socialMedia: { facebook: false, instagram: false, linkedin: false, twitter: false },
      socialCount: 0,
      multipleLocations: false,
      signals: ['Could not scan \u2014 ' + (err.message || 'site may be blocked or down')]
    };
    scoreLeadsNoSort();
    renderResults();
    showStats();
    scrollToCard(placeId);
    showToast(`Could not scan ${lead.name} \u2014 ${err.message || 'site may be blocked'}`, 'error');
  }
}

// ---- OUTREACH LIST ----
function addToOutreachList(placeId) {
  const lead = state.leads.find(l => l.id === placeId);
  if (!lead || state.outreachList.some(l => l.id === placeId)) return;

  state.outreachList.push({ ...lead, inOutreachList: true });
  lead.inOutreachList = true;

  updateListBadge();
  renderResults();
  showToast(`Added ${lead.name} to outreach list`, 'success');
}

function removeFromOutreachList(placeId) {
  state.outreachList = state.outreachList.filter(l => l.id !== placeId);
  const lead = state.leads.find(l => l.id === placeId);
  if (lead) lead.inOutreachList = false;

  updateListBadge();
  renderOutreachList();
  renderResults();
}

function updateListBadge() {
  const badge = $('#listBadge');
  const count = state.outreachList.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

function renderOutreachList() {
  const emptyState = $('#listEmptyState');
  const tableWrap = $('#listTableWrap');
  const tbody = $('#listTableBody');

  if (state.outreachList.length === 0) {
    emptyState.style.display = 'flex';
    tableWrap.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  tableWrap.style.display = 'block';

  tbody.innerHTML = state.outreachList.map(lead => {
    const badgeClass = lead.category === 'hot' ? 'badge-hot' : lead.category === 'warm' ? 'badge-warm' : 'badge-cool';
    return `
      <tr>
        <td>
          <strong style="font-size:var(--text-sm);">${escapeHtml(lead.name)}</strong>
          ${lead.website ? `<br><a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer" style="font-size:var(--text-xs);color:var(--color-primary);text-decoration:none;">${truncateUrl(lead.website)}</a>` : ''}
        </td>
        <td>${escapeHtml(lead.address)}</td>
        <td style="font-variant-numeric:tabular-nums;">${escapeHtml(lead.phone)}</td>
        <td><span class="lead-score-badge ${badgeClass}">${lead.score}</span></td>
        <td>${escapeHtml(inferBusinessType(lead))}</td>
        <td class="td-actions">
          <button class="btn btn-ghost btn-sm btn-outreach-from-list" data-id="${lead.id}" title="Generate outreach">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </button>
          <button class="btn btn-danger btn-sm btn-remove-list" data-id="${lead.id}" title="Remove from list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach handlers
  tbody.querySelectorAll('.btn-remove-list').forEach(btn => {
    btn.addEventListener('click', () => removeFromOutreachList(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-outreach-from-list').forEach(btn => {
    btn.addEventListener('click', () => goToOutreach(btn.dataset.id));
  });
}

// CSV Export
function initExportCsv() {
  $('#exportCsvBtn').addEventListener('click', exportCsv);
}

function exportCsv() {
  if (state.outreachList.length === 0) {
    showToast('No leads in outreach list to export.', 'error');
    return;
  }

  const headers = ['Business Name', 'Address', 'Phone', 'Website', 'Google Rating', 'Reviews', 'Type', 'Lead Score', 'Category', 'Estimated Size', 'Digital Readiness', 'GMS Detected', 'Notes'];
  const rows = state.outreachList.map(lead => {
    const sr = lead.scanResults;
    return [
      lead.name,
      lead.address,
      lead.phone,
      lead.website,
      lead.rating,
      lead.reviewCount,
      inferBusinessType(lead),
      lead.score,
      lead.category,
      getSizeLabel(lead.estimatedSize),
      sr ? (sr.digitalReadiness || 'Not scanned') : 'Not scanned',
      sr ? (sr.gmsDetected ? (sr.gmsName || 'Yes') : 'No') : 'Not scanned',
      lead.notes
    ];
  });

  const csvContent = [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autowork-online-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully', 'success');
}

// ---- OUTREACH GENERATOR ----
function initOutreach() {
  // Channel toggle
  $$('.channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.channel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedChannel = btn.dataset.channel;
    });
  });

  $('#generateBtn').addEventListener('click', generateOutreach);
  initExportCsv();
}

function updateOutreachLeadSelect() {
  const select = $('#outreachLeadSelect');
  select.innerHTML = '<option value="">Choose a lead...</option>';

  // Merge outreach list + claimed leads into one deduplicated list
  const seen = new Set();
  const allOutreachLeads = [];

  // 1. In-memory outreach list leads (from search results)
  state.outreachList.forEach(lead => {
    if (!seen.has(lead.id)) {
      seen.add(lead.id);
      allOutreachLeads.push({ id: lead.id, name: lead.name, address: lead.address, source: 'list' });
    }
  });

  // 2. My claimed leads (from server)
  if (currentBdr) {
    allClaims
      .filter(c => c.bdr_email === currentBdr.email)
      .forEach(c => {
        if (!seen.has(c.place_id)) {
          seen.add(c.place_id);
          allOutreachLeads.push({ id: c.place_id, name: c.lead_name, address: c.lead_address, source: 'claimed' });
        }
      });
  }

  if (allOutreachLeads.length === 0) {
    select.innerHTML = '<option value="">No leads yet \u2014 claim or add leads first</option>';
    return;
  }

  allOutreachLeads.forEach(lead => {
    const badge = lead.source === 'claimed' ? ' (Claimed)' : '';
    select.innerHTML += `<option value="${lead.id}">${escapeHtml(lead.name)} \u2014 ${escapeHtml(lead.address)}${badge}</option>`;
  });
}

function goToOutreach(placeId) {
  // Ensure lead is in outreach list
  if (!state.outreachList.some(l => l.id === placeId)) {
    const lead = state.leads.find(l => l.id === placeId);
    if (lead) addToOutreachList(placeId);
  }

  // Switch to outreach tab
  $$('.nav-item').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
  document.querySelector('[data-tab="outreach"]').classList.add('active');
  document.querySelector('[data-tab="outreach"]').setAttribute('aria-current', 'page');

  $$('.tab-panel').forEach(p => p.classList.remove('active'));
  $('#panel-outreach').classList.add('active');
  $('#pageTitle').textContent = 'Outreach Generator';

  updateOutreachLeadSelect();
  $('#outreachLeadSelect').value = placeId;
}

function generateOutreach() {
  const leadId = $('#outreachLeadSelect').value;
  const personaKey = $('#personaSelect').value;
  const industry = $('#industrySelect').value;
  const channel = state.selectedChannel;

  if (!leadId) {
    showToast('Please select a lead first.', 'error');
    return;
  }

  let lead = state.outreachList.find(l => l.id === leadId) || state.leads.find(l => l.id === leadId);
  // If not in memory, build from claimed lead data
  if (!lead) {
    const claim = allClaims.find(c => c.place_id === leadId);
    if (claim) {
      lead = {
        id: claim.place_id,
        name: claim.lead_name,
        address: claim.lead_address,
        phone: claim.lead_phone,
        website: claim.lead_website,
        score: claim.lead_score,
        category: claim.lead_category,
        estimatedSize: claim.lead_size,
        types: [],
        rating: 0,
        reviewCount: 0,
        scanned: false,
        scanResults: null
      };
    }
  }
  if (!lead) return;

  const persona = PERSONAS[personaKey];
  const output = $('#outreachOutput');

  if (channel === 'email') {
    output.innerHTML = generateEmailSequence(lead, persona, industry);
  } else if (channel === 'call') {
    output.innerHTML = generateCallScript(lead, persona, industry);
  } else if (channel === 'linkedin') {
    output.innerHTML = generateLinkedInMessage(lead, persona, industry);
  }

  // Attach copy handlers
  output.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.closest('.script-section').querySelector('.script-body').textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '\u2713 Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }).catch(() => {
        showToast('Could not copy to clipboard', 'error');
      });
    });
  });
}

function generateEmailSequence(lead, persona, industry) {
  const name = lead.name;
  const painPoint1 = persona.painPoints[0];
  const painPoint2 = persona.painPoints[1] || persona.painPoints[0];
  const pillar1 = MESSAGING_PILLARS[0];
  const pillar2 = MESSAGING_PILLARS[1];

  // Auto-fill director name if enriched
  const directorFirstName = getFirstDirectorFirstName(lead.id);
  const directorFullName = getFirstDirectorName(lead.id);
  const greeting = directorFirstName ? `Hi ${directorFirstName},` : 'Hi there,';
  const greetingFollowup = directorFirstName ? `Hi ${directorFirstName},` : 'Hi again,';
  const greetingBreakup = directorFirstName ? `Hi ${directorFirstName},` : 'Hi,';

  // Enrichment context for email
  const enrichment = getEnrichmentForLead(lead.id);
  let enrichmentNote = '';
  if (enrichment && enrichment.sic_descriptions && enrichment.sic_descriptions.length > 0) {
    enrichmentNote = `\n\n<em style="font-size:var(--text-xs);color:var(--color-text-faint);">\uD83C\uDFE2 Companies House: ${escapeHtml(enrichment.company_name_ch)} (${escapeHtml(enrichment.company_number)}) &middot; ${escapeHtml(enrichment.sic_descriptions[0])} &middot; Founded ${escapeHtml(enrichment.date_of_creation)}${directorFullName ? ' &middot; Director: ' + escapeHtml(directorFullName) : ''}</em>`;
  }

  // Email 1 \u2014 Introduction
  const email1 = `
    <div class="script-section">
      <div class="script-label">Email 1 \u2014 Introduction</div>
      <div class="script-subject">Subject options:</div>
      <div class="script-body">1. "${name} \u2014 still using paper job cards?"
2. "Quick question about how ${name} manages workshop bookings"
3. "For ${name}: a better way to run your workshop"</div>
      <br>
      <div class="script-body">${greeting}

I came across ${name} and noticed you're likely dealing with a challenge we hear from a lot of ${persona.title.toLowerCase()}s in the ${getIndustryLabel(industry)} space:

<strong>"${painPoint1}"</strong>

That's exactly why we built Autowork Online \u2014 a cloud-based garage management system designed specifically for workshops and garages like yours. It brings your diary, job cards, stock, and customer reminders into one place, so you can ${persona.hook}.

${lead.scanResults && lead.scanResults.gmsDetected ? `I noticed you may already be using a system \u2014 but many garages we speak to are looking for a modern, cloud-based alternative that runs in the browser with no installation needed.` : lead.scanResults && lead.scanResults.digitalReadiness === 'low' ? `From what I can see online, ${name} may still be running on fairly manual processes \u2014 which is actually a great position to be in. Autowork Online is specifically built for garages at your stage, with VRM lookup, repair times, and online MOT booking built in.` : `It also includes VRM/catalogue lookup, repair times, automated customer reminders, and online MOT booking \u2014 everything a modern workshop needs.`}

Would you be open to a quick 15-minute demo? I think you'd find it interesting.

Best regards,
${currentBdr ? currentBdr.name : '[Your Name]'}
Klipboard | Autowork Online
autowork.online</div>${enrichmentNote}
      <div class="script-tip">Tip: Keep email under 150 words. Personalise the opening line based on your research.${directorFirstName ? ` Director name auto-filled from Companies House: ${directorFullName}` : ''}</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;

  // Email 2 \u2014 Follow-up
  const email2 = `
    <div class="script-section">
      <div class="script-label">Email 2 \u2014 Follow-up (send 3 days later)</div>
      <div class="script-subject">Subject: Re: ${name} \u2014 a quick stat that might surprise you</div>
      <div class="script-body">${greetingFollowup}

I wanted to follow up on my last note with a stat that often catches people's attention:

<strong>34% of UK garages still haven't gone digital.</strong> (IMI)

That means a third of workshops are still running on paper job cards, phone bookings, and manual reminders. The garages that move to a proper system are the ones filling their bays and keeping customers coming back.

I bring this up because another common challenge we hear \u2014 especially from ${persona.title.toLowerCase()}s \u2014 is:

<strong>"${painPoint2}"</strong>

One of our customers, a workshop similar to ${name}, was managing everything with paper and spreadsheets. Within weeks of switching to Autowork Online, they had a proper MOT diary, automated reminders bringing customers back, and repair times at every bay.

${pillar2.detail}

Worth a quick chat? I'm flexible on timing.

Best,
${currentBdr ? currentBdr.name : '[Your Name]'}
Klipboard | Autowork Online
autowork.online</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;

  // Email 3 \u2014 Breakup
  const email3 = `
    <div class="script-section">
      <div class="script-label">Email 3 \u2014 Breakup (send 5 days after Email 2)</div>
      <div class="script-subject">Subject: Closing the loop, ${name}</div>
      <div class="script-body">${greetingBreakup}

I don't want to be a pest, so this will be my last note for now.

I genuinely believe Autowork Online could help ${name} get better control over the workshop \u2014 from job cards and diary management to stock and customer follow-ups \u2014 without the complexity (or cost) of old-school systems.

Here's what makes us different: <strong>${pillar1.detail}</strong> No installation, no servers, access from any device.

If the timing isn't right, no hard feelings at all. I'm happy to reconnect whenever it makes sense.

If you'd like to see a quick demo, just reply to this email or visit: autowork.online

All the best,
${currentBdr ? currentBdr.name : '[Your Name]'}
Klipboard | Autowork Online</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;

  return email1 + email2 + email3;
}

function generateCallScript(lead, persona, industry) {
  const name = lead.name;
  const directorFirstName = getFirstDirectorFirstName(lead.id);
  const contactName = directorFirstName || '[name]';

  return `
    <div class="script-section">
      <div class="script-label">Opening${directorFirstName ? ` <span style="color:var(--color-success);">(Director: ${escapeHtml(directorFirstName)} \u2014 auto-filled)</span>` : ''}</div>
      <div class="script-body"><strong>Pattern interrupt opener:</strong>

"Hi ${contactName}, this is ${currentBdr ? currentBdr.name : '[Your Name]'} from Klipboard. I know I've called completely out of the blue, so I'll be brief \u2014 would you give me 30 seconds to explain why I'm calling, and then you can tell me if it's worth continuing?"

<strong>[Wait for response \u2014 most people will say yes]</strong>

"Thanks. I work with garages and workshops like ${name} who are often managing their diary, job cards, and customer reminders across paper, spreadsheets, and maybe a basic system. We've built a cloud-based garage management system called Autowork Online that brings all of that into one place \u2014 and I wanted to see if that's something you'd find useful."</div>
    </div>

    <div class="script-section">
      <div class="script-label">Discovery Questions</div>
      <div class="script-body">1. "How are you currently managing your workshop diary and job cards at ${name}? Is it paper, a whiteboard, or do you have a system?"

2. "When a customer rings up for an MOT or service, what does the booking process look like? Is that all done by phone?"

3. "What's your biggest headache right now when it comes to ${persona.cares.toLowerCase()}?"

4. "If you could wave a magic wand and fix one thing about how ${name} runs day-to-day, what would it be?"

5. "How are you handling customer reminders \u2014 for MOTs coming up, services due, deferred work? Is that manual?"</div>
    </div>

    <div class="script-section">
      <div class="script-label">Objection Handling</div>
      <div class="script-body"><strong>"We already have a system" (TechMan, Dragon2000, etc.)</strong>
\u2192 "That's great to hear. Out of curiosity, what are you using? [Listen] Many garages we speak to are running older, on-premise systems that need a PC in the office. Autowork Online is fully cloud-based \u2014 it runs in your browser, updates automatically, and you can access it from any device. It might be worth seeing the difference."

<strong>"We're too small / it's just me in the workshop"</strong>
\u2192 "That's actually exactly who we built this for. Autowork Online isn't a big corporate system \u2014 it's designed for independent garages, even single-bay workshops. No six-month implementation. You can be up and running in days, and it handles your diary, reminders, and job cards so you can focus on the work."

<strong>"We manage fine with paper / spreadsheets"</strong>
\u2192 "I hear that a lot, and honestly, you've done brilliantly to get this far. The question is \u2014 how many customers are slipping through the cracks? How many MOT reminders are you missing? 34% of UK garages still haven't gone digital. The ones that do are filling their bays and keeping customers coming back. Would 15 minutes be worth seeing if there's a fit?"

<strong>"Not interested / bad timing"</strong>
\u2192 "Totally understand, ${contactName}. Quick question before I go though \u2014 how are you currently handling MOT reminders and service bookings? [Listen] The reason I ask is that most garages I speak to don't realise how much revenue they're losing to missed follow-ups. Would it be worth a quick look?"</div>
    </div>

    <div class="script-section">
      <div class="script-label">Close</div>
      <div class="script-body">"Look, I don't want to take up more of your time. Based on what you've told me, I think Autowork Online could genuinely help ${name} get better control over [restate their pain point \u2014 diary, job cards, reminders, stock]. Would you be open to a 15-minute demo this week? I can show you exactly how it would work for your workshop."

<strong>Book the demo at autowork.online. Confirm the time. Send a calendar invite immediately.</strong></div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;
}

function generateLinkedInMessage(lead, persona, industry) {
  const name = lead.name;
  const directorFirstName = getFirstDirectorFirstName(lead.id);
  const contactName = directorFirstName || '[Name]';

  return `
    <div class="script-section">
      <div class="script-label">Connection Request (300 chars max)${directorFirstName ? ` <span style="color:var(--color-success);">(Director: ${escapeHtml(directorFirstName)})</span>` : ''}</div>
      <div class="script-body">Hi ${contactName}, I noticed you're at ${name} \u2014 we work with garages and workshops across the UK helping them go digital with diary management, job cards, and automated reminders. Would love to connect and share some ideas.</div>
      <div class="script-tip">Keep it short. No pitch in the connection request \u2014 just establish relevance.</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>

    <div class="script-section">
      <div class="script-label">Follow-up InMail (after acceptance)</div>
      <div class="script-body">Hi ${contactName},

Thanks for connecting! I wanted to reach out because we've been working with a number of ${getIndustryLabel(industry)} businesses in the UK who were facing similar challenges to what I imagine ${name} deals with \u2014 specifically around ${persona.cares.toLowerCase()}.

We built Autowork Online (by Klipboard) specifically for independent garages and workshops who've outgrown paper job cards and basic tools but don't need (or want) the complexity of old-school on-premise systems.

${lead.scanResults && lead.scanResults.gmsDetected ? `I noticed you may already be using a GMS \u2014 but many garages we speak to are looking to upgrade to a cloud-native system. Autowork Online runs in the browser, with automatic updates and no installation needed.` : lead.scanResults && lead.scanResults.digitalReadiness === 'low' ? `From what I can see, ${name} might still be managing some processes manually \u2014 Autowork Online is built exactly for that transition, with VRM lookup, repair times, and online MOT booking all built in.` : `It includes everything a modern workshop needs: workshop diary, VRM lookup, repair times, automated reminders, online MOT booking, and stock management.`}

Here's a stat that often resonates: <strong>34% of UK garages still haven't gone digital. The ones that do are filling their bays.</strong>

Would you be open to a quick chat? No pressure \u2014 happy to share some insights either way.

Best,
${currentBdr ? currentBdr.name : '[Your Name]'}
autowork.online</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;
}

function getIndustryLabel(key) {
  const labels = {
    garage: 'Garage / Auto Repair',
    mot: 'MOT Centre',
    tyres: 'Tyre & Fitting',
    service: 'Service Centre',
    bodyshop: 'Body Shop'
  };
  return labels[key] || 'automotive';
}

// ---- SIZE LABEL HELPER ----
function getSizeLabel(size) {
  const labels = {
    'small': 'Small Business',
    'small-medium': 'Small\u2013Medium',
    'medium': 'Medium Business',
    'medium-large': 'Medium\u2013Large',
    'large': 'Large / Chain'
  };
  return labels[size] || 'Unknown';
}

// ---- UI HELPERS ----
function showSkeleton() {
  $('#skeletonContainer').style.display = 'grid';
  $('#resultsGrid').innerHTML = '';
  $('#loadMoreWrap').style.display = 'none';
  $('#statsBar').style.display = 'none';
}

function hideSkeleton() {
  $('#skeletonContainer').style.display = 'none';
}

function showEmpty() {
  $('#emptyState').style.display = 'flex';
}

function hideEmpty() {
  $('#emptyState').style.display = 'none';
}

function showStats() {
  const bar = $('#statsBar');
  bar.style.display = 'flex';

  const hot = state.leads.filter(l => l.category === 'hot').length;
  const warm = state.leads.filter(l => l.category === 'warm').length;
  const cool = state.leads.filter(l => l.category === 'cool').length;

  $('#totalLeads').textContent = state.leads.length;
  $('#hotCount').textContent = hot;
  $('#warmCount').textContent = warm;
  $('#coolCount').textContent = cool;
}

// Toast system
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    toast.style.transition = 'all 300ms ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Utilities
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url.substring(0, 40);
  }
}
