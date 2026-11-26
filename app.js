(() => {
'use strict';
// ---------- structure ----------
const SECTIONS = [
  {key:'corporate',   n:1, title:'Corporate & Financial Governance',          short:'Corporate & Financial'},
  {key:'safety',      n:2, title:'Health, Safety & Workshop Compliance',      short:'Health & Safety'},
  {key:'people',      n:3, title:'People & Employment Compliance',            short:'People & Employment'},
  {key:'environment', n:4, title:'Environmental & Data Protection',           short:'Environment & Data'},
  {key:'insurance',   n:5, title:'Insurance',                                short:'Insurance'},
  {key:'management',  n:6, title:'Management & Shareholder Oversight',        short:'Management'},
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.key, s]));
const FREQS = [['1w','Weekly'],['1m','Monthly'],['3m','Quarterly'],['6m','Every 6 months'],['12m','Annually'],['24m','Every 2 years'],['36m','Every 3 years'],['60m','Every 5 years'],['once','One-off']];
const FREQ = Object.fromEntries(FREQS);
const STATUS = {red:'Red', amber:'Amber', green:'Green', none:'Not reviewed'};
const STATUS_ORDER = ['red','amber','green','none'];
const ROLES = {admin:'Admin', editor:'Editor', viewer:'Viewer'};
const ROLE_HELP = {admin:'Can change everything, including who has access', editor:'Can update checks, people and documents', viewer:'Can look but not change anything'};
const REMIND = [0,2,7,14,30,60,90];
const SOON = 30;
const MB = 1024*1024;
const MAX_FILE = 50*MB;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_L = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_L = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const VIEWS = ['board','upcoming','reminders','people','activity','users'];

const ICON = {
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  clip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.6 8.5a2 2 0 0 1-2.8-2.8L15.5 7"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
};

// ---------- state ----------
const S = {
  sb:null, session:null, email:'', role:null, started:false,
  loading:true, checks:[], people:[], activity:[], members:[], settings:null,
  view:'board', filter:{q:'', status:'all', owner:'all'},
  drawerOpen:false, openId:null, draft:null, base:null, baseUpdatedAt:'', dirty:false, saving:false, footMode:'', confirmDoc:null, opener:null,
  upMsgs:[], editingPerson:null, confirmPerson:null, personErr:'', confirmMember:null, memberErr:'', banners:{},
  openSecs: loadOpenSecs(),
};
// Which board sections are expanded: remembered per browser, all collapsed the first time.
function loadOpenSecs(){ try { const v = JSON.parse(localStorage.getItem('gb-open-sections') || '[]'); return new Set(Array.isArray(v) ? v : []); } catch (_) { return new Set(); } }
function saveOpenSecs(){ try { localStorage.setItem('gb-open-sections', JSON.stringify([...S.openSecs])); } catch (_) {} }

// ---------- utils ----------
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const str = v => typeof v === 'string' ? v : '';
const nowISO = () => new Date().toISOString();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const today = () => ymd(new Date());
const daysUntil = s => { const d = parse(s); if (!d) return null; return Math.round((d - parse(today())) / 86400000); };
function addFreq(s, f){
  const d = parse(s); if (!d || !f || f === 'once') return '';
  if (f.endsWith('w')) { d.setDate(d.getDate() + 7*parseInt(f, 10)); return ymd(d); }
  const m = parseInt(f, 10), day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth()+m, 1);
  const last = new Date(t.getFullYear(), t.getMonth()+1, 0).getDate();
  t.setDate(Math.min(day, last)); return ymd(t);
}
const fmt = s => { const d = parse(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ''; };
function fmtDT(iso){ const d = new Date(iso); if (!iso || isNaN(d)) return ''; return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function rel(s){
  const n = daysUntil(s); if (n === null) return '';
  if (n === 0) return 'Due today'; if (n === 1) return 'Due tomorrow';
  if (n < 0) return `Overdue by ${-n} day${n === -1 ? '' : 's'}`;
  if (n < 60) return `In ${n} days`;
  return `In ${Math.round(n/30.44)} months`;
}
function dueState(c){ const n = daysUntil(c.nextDue); if (n === null) return 'nodate'; if (n < 0) return 'overdue'; if (n <= SOON) return 'soon'; return 'later'; }
const dueClass = c => ({overdue:'d-overdue', soon:'d-soon'}[dueState(c)] || '');
function reminderState(c){
  const n = daysUntil(c.nextDue); if (n === null) return null;
  const r = c.remindDays;
  if (n < 0) return {kind:'overdue', n};
  if (r > 0 && n <= r) return {kind:'due', n};
  if (r <= 0) return {kind:'off', n};
  const d = parse(c.nextDue); d.setDate(d.getDate() - r);
  return {kind:'sched', n, sendOn:ymd(d)};
}
const extOf = name => { const m = /\.([A-Za-z0-9]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
const fmtSize = b => b >= MB ? (b/MB).toFixed(1)+' MB' : Math.max(1, Math.round(b/1024))+' KB';
const pill = s => `<span class="pill s-${s}"><i></i>${STATUS[s]}</span>`;
const byId = id => S.checks.find(c => c.id === id) || null;
const personById = id => (id && S.people.find(p => p.id === id)) || null;
// A check can have up to two responsible people.
const ownersOf = c => [c.ownerId, c.owner2Id].filter((id, i, a) => id && a.indexOf(id) === i).map(personById).filter(Boolean);
const ownerName = c => ownersOf(c).map(p => p.name).join(' & ');
const hasOwner = (c, id) => c.ownerId === id || c.owner2Id === id;
const readOnly = () => !(S.role === 'admin' || S.role === 'editor');
const isAdmin = () => S.role === 'admin';
const sortChecks = list => list.slice().sort((a,b) => (a.order - b.order) || a.title.localeCompare(b.title));
const checksIn = key => sortChecks(S.checks.filter(c => c.section === key));
function nameFor(email){
  if (!email) return 'Someone';
  const e = email.toLowerCase();
  const m = S.members.find(x => x.email === e);
  const base = (m && m.full_name) || (S.people.find(p => p.email.toLowerCase() === e) || {}).name || email;
  return e === S.email ? `${base} (you)` : base;
}
const safeName = n => n.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-120) || 'file';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));

function normCheck(r, docsBy){
  const rd = Number(r.remind_days);
  return {
    id: r.id, section: SEC[r.section] ? r.section : 'management',
    title: str(r.title) || 'Untitled check', detail: str(r.detail), status: STATUS[r.status] ? r.status : 'none',
    lastCompleted: str(r.last_completed), nextDue: str(r.next_due), frequency: FREQ[r.frequency] ? r.frequency : '12m',
    ownerId: str(r.owner_id), owner2Id: str(r.owner2_id), remindDays: Number.isFinite(rd) ? rd : 30, comment: str(r.comment),
    docs: docsBy[r.id] || [], order: Number(r.sort_order) || 0,
    updatedAt: str(r.updated_at), updatedBy: str(r.updated_by), lastReminderSent: str(r.last_reminder_sent),
  };
}
const toRow = d => Object.assign({
  section: d.section, title: d.title, detail: d.detail, status: d.status,
  last_completed: d.lastCompleted || null, next_due: d.nextDue || null, frequency: d.frequency,
  owner_id: d.ownerId || null, remind_days: d.remindDays, comment: d.comment,
}, S.hasOwner2 ? {owner2_id: d.owner2Id || null} : {}); // owner2_id exists once 002-second-responsible-person.sql has been run
const ROW_KEY = {section:'section', title:'title', detail:'detail', status:'status', lastCompleted:'last_completed', nextDue:'next_due', frequency:'frequency', ownerId:'owner_id', owner2Id:'owner2_id', remindDays:'remind_days', comment:'comment'};

// ---------- feedback ----------
let toastT;
function toast(msg, kind){ const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (kind === 'err' ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, kind === 'err' ? 6000 : 2600); }
function banner(key, msg, tone){ if (msg) S.banners[key] = {msg, tone}; else delete S.banners[key]; renderBanners(); }
function renderBanners(){ $('#banners').innerHTML = Object.values(S.banners).map(b => `<div class="banner ${b.tone || 'info'}">${ICON.warn}<span>${esc(b.msg)}</span></div>`).join(''); }
function fail(e, what){
  const msg = (e && (e.message || e.error_description)) || 'unknown error';
  if (/row-level security|permission denied/i.test(msg)) toast(`You don't have permission to ${what || 'do that'}. Ask an admin.`, 'err');
  else toast(`Could not ${what || 'save'}: ${msg}`, 'err');
}
async function q(promise){ const {data, error} = await promise; if (error) throw error; return data; }
function log(o){
  if (readOnly()) return;
  const c = byId(o.checkId);
  S.sb.from('activity').insert({
    check_id: o.checkId || null, check_title: o.title || (c ? c.title : ''), section: o.section || (c ? c.section : ''),
    action: o.action, detail: String(o.detail || '').slice(0, 300), by_email: S.email,
  }).then(() => {}, () => {});
}

// ---------- data ----------
async function loadAll(){
  try {
    const [checks, docs, people, activity, members, settings] = await Promise.all([
      q(S.sb.from('checks').select('*')),
      q(S.sb.from('documents').select('*').order('uploaded_at')),
      q(S.sb.from('people').select('*')),
      q(S.sb.from('activity').select('*').order('at', {ascending:false}).limit(150)),
      q(S.sb.from('members').select('*').order('email')),
      q(S.sb.from('settings').select('*').eq('key', 'reminders').maybeSingle()),
    ]);
    const docsBy = {};
    docs.forEach(d => (docsBy[d.check_id] = docsBy[d.check_id] || []).push({id:d.id, name:str(d.name) || 'document', size:Number(d.size) || 0, type:str(d.mime), path:str(d.path), at:str(d.uploaded_at), by:str(d.uploaded_by)}));
    if (checks.length) S.hasOwner2 = Object.prototype.hasOwnProperty.call(checks[0], 'owner2_id');
    S.checks = checks.map(r => normCheck(r, docsBy));
    S.people = people.map(p => ({id:p.id, name:str(p.name) || 'Unnamed', email:str(p.email), role:str(p.role_title)})).sort((a,b) => a.name.localeCompare(b.name));
    S.activity = activity.map(a => ({id:a.id, checkId:str(a.check_id), checkTitle:str(a.check_title), section:str(a.section), action:str(a.action), detail:str(a.detail), by:str(a.by_email), at:str(a.at)}));
    S.members = members.map(m => ({email:str(m.email), full_name:str(m.full_name), role:str(m.role), created_at:str(m.created_at)}));
    S.settings = settings ? settings.value : null;
    const me = S.members.find(m => m.email === S.email);
    const newRole = me ? me.role : null;
    if (!newRole) { showNoAccess(); return; }
    if (newRole !== S.role) { S.role = newRole; applyRole(); }
    S.loading = false; banner('conn', null);
    onData();
    maybeShowAlert();
  } catch (e) {
    S.loading = false;
    banner('conn', 'The register could not be loaded: ' + ((e && e.message) || 'unknown error') + '. Check your connection and reload.', 'warn');
    scheduleRender();
  }
}
let reloadT;
function reloadSoon(){ clearTimeout(reloadT); reloadT = setTimeout(loadAll, 250); }
function subscribe(){
  S.sb.channel('gb-changes')
    .on('postgres_changes', {event:'*', schema:'public'}, reloadSoon)
    .subscribe();
  window.addEventListener('focus', reloadSoon);
}

// ---------- render: summary ----------
function renderSummary(){
  const cs = S.checks;
  const cnt = {red:0, amber:0, green:0, none:0}; cs.forEach(c => cnt[c.status]++);
  const overdue = cs.filter(c => dueState(c) === 'overdue').length;
  const soon = cs.filter(c => dueState(c) === 'soon').length;
  const tiles = [['overdue','t-red', overdue, 'Overdue'], ['soon','t-amber', soon, `Due in next ${SOON} days`], ['red','t-red', cnt.red, 'Red status'], ['none','t-none', cnt.none, 'Not reviewed']];
  $('#tiles').innerHTML = tiles.map(([f, cls, n, l]) => `<button type="button" class="tile ${cls}${n ? '' : ' zero'}" data-act="tile" data-f="${f}"><span class="n">${S.loading ? '–' : n}</span><span class="l">${l}</span></button>`).join('');
  const total = cs.length;
  const segs = STATUS_ORDER.filter(k => cnt[k]).map(k => `<span class="seg-${k}" style="width:${(cnt[k]/total*100).toFixed(2)}%" title="${STATUS[k]}: ${cnt[k]}"></span>`).join('');
  $('#ragline').innerHTML = `<div class="cap"><span><b>${total}</b> checks across 6 sections</span><span>${cnt.green} of ${total} green</span></div>
    <div class="ragbar" role="img" aria-label="${STATUS_ORDER.map(k => `${STATUS[k]} ${cnt[k]}`).join(', ')}">${segs}</div>
    <div class="legend">${STATUS_ORDER.map(k => `<span><i class="seg-${k}"></i>${STATUS[k]} ${cnt[k]}</span>`).join('')}</div>`;
  const rank = c => { const ds = dueState(c); return ds === 'overdue' ? 0 : c.status === 'red' ? 1 : ds === 'soon' ? 2 : c.status === 'amber' ? 3 : 9; };
  const att = cs.filter(c => rank(c) < 9).sort((a,b) => rank(a) - rank(b) || (a.nextDue || '9').localeCompare(b.nextDue || '9')).slice(0, 6);
  $('#attention').innerHTML = att.length ? att.map(c => {
    const why = c.nextDue ? `<span class="${dueClass(c)}">${rel(c.nextDue)}</span>` : 'No due date';
    return `<li><button type="button" class="att-item" data-act="open" data-id="${esc(c.id)}"><span class="dot s-${c.status}"></span><span><span class="t">${esc(c.title)}</span><span class="sub">${esc(SEC[c.section].short)} · ${why}</span></span><span class="plate sm" aria-hidden="true">${SEC[c.section].n}</span></button></li>`;
  }).join('') : `<li class="hint" style="padding:8px 2px">${S.loading ? 'Loading…' : total ? 'Nothing overdue, red or due in the next 30 days.' : 'Checks that are overdue, red or due soon will be listed here.'}</li>`;
  const remDue = cs.filter(c => { const r = reminderState(c); return r && (r.kind === 'overdue' || r.kind === 'due'); }).length;
  const b = $('#rem-badge'); b.hidden = !remDue; b.textContent = remDue;
}

// ---------- first-landing pop-up: overdue and due soon ----------
// Shown once per browser session (and at most once a day per session) after the board first loads.
function maybeShowAlert(){
  if (S.alertChecked) return; S.alertChecked = true;
  let seen = null; try { seen = sessionStorage.getItem('gb-alert-seen'); } catch (_) {}
  if (seen === today()) return;
  const byDue = (a, b) => a.nextDue.localeCompare(b.nextDue);
  const od = S.checks.filter(c => dueState(c) === 'overdue').sort(byDue);
  const soon = S.checks.filter(c => dueState(c) === 'soon').sort(byDue);
  if (!od.length && !soon.length) return;
  try { sessionStorage.setItem('gb-alert-seen', today()); } catch (_) {}
  const MAX = 8;
  const item = c => { const owner = ownerName(c); return `<li><button type="button" class="alert-item" data-act="alert-open" data-id="${esc(c.id)}">
      <span class="dot s-${c.status}"></span>
      <span class="ai-main"><span class="t">${esc(c.title)}</span><span class="sub">${SEC[c.section].n} · ${esc(SEC[c.section].short)} · ${owner ? esc(owner) : 'Unassigned'}</span></span>
      <span class="ai-due"><span class="mono">${fmt(c.nextDue)}</span><span class="due-rel ${dueClass(c)}">${rel(c.nextDue)}</span></span></button></li>`; };
  const group = (list, label, cls, f) => !list.length ? '' : `<div class="alert-group"><h3 class="${cls}">${label} · ${list.length}</h3><ul>${list.slice(0, MAX).map(item).join('')}</ul>${list.length > MAX ? `<button type="button" class="linkish more" data-act="alert-show" data-f="${f}">Show all ${list.length} on the board</button>` : ''}</div>`;
  const summary = [od.length ? `${od.length} overdue` : '', soon.length ? `${soon.length} due in the next ${SOON} days` : ''].filter(Boolean).join(' and ');
  $('#alert').innerHTML = `
    <div class="alert-head"><span class="alert-icon${od.length ? '' : ' soon'}" aria-hidden="true">${ICON.warn}</span>
      <div><h2 id="alert-title">${od.length ? 'Overdue checks need attention' : 'Checks coming due'}</h2><p>${summary}. Open a check to update it.</p></div>
      <button type="button" class="icon-btn" data-act="alert-close" aria-label="Close">${ICON.x}</button></div>
    <div class="alert-body">${group(od, 'Overdue', 'od', 'overdue')}${group(soon, `Due in the next ${SOON} days`, 'soon', 'soon')}</div>
    <div class="alert-foot"><button type="button" class="btn" data-act="alert-close">Dismiss</button><button type="button" class="btn primary" data-act="alert-show" data-f="${od.length ? 'overdue' : 'soon'}">Show ${od.length ? 'overdue' : 'due soon'} on the board</button></div>`;
  S.alertOpener = document.activeElement;
  $('#alert-scrim').hidden = false; $('#alert').hidden = false;
  document.body.classList.add('locked');
  const f = $('#alert .alert-foot .btn.primary'); if (f) f.focus();
}
function closeAlert(){
  $('#alert').hidden = true; $('#alert-scrim').hidden = true;
  if (!S.drawerOpen) document.body.classList.remove('locked');
  if (S.alertOpener && document.contains(S.alertOpener)) S.alertOpener.focus();
}

// ---------- render: board ----------
function matches(c){
  const f = S.filter, qq = f.q.trim().toLowerCase();
  if (f.status === 'overdue' && dueState(c) !== 'overdue') return false;
  if (f.status === 'soon' && dueState(c) !== 'soon') return false;
  if (STATUS[f.status] && c.status !== f.status) return false;
  if (f.owner === 'none' && ownersOf(c).length) return false;
  if (f.owner !== 'all' && f.owner !== 'none' && !hasOwner(c, f.owner)) return false;
  if (qq && !(c.title + ' ' + c.detail + ' ' + c.comment + ' ' + ownerName(c)).toLowerCase().includes(qq)) return false;
  return true;
}
function renderFilters(){
  const opts = [['all','All'],['red','Red'],['amber','Amber'],['green','Green'],['none','Not reviewed'],['overdue','Overdue'],['soon','Due soon']];
  $('#status-chips').innerHTML = opts.map(([k, l]) => `<button type="button" class="chip" data-act="status" data-k="${k}" aria-pressed="${S.filter.status === k}">${STATUS[k] ? `<i class="seg-${k}"></i>` : ''}${l}</button>`).join('');
  const sel = $('#owner-filter');
  if (!S.people.some(p => p.id === S.filter.owner) && !['all','none'].includes(S.filter.owner)) S.filter.owner = 'all';
  sel.innerHTML = `<option value="all">Everyone</option><option value="none">Unassigned</option>` + S.people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  sel.value = S.filter.owner;
  $('#jump').innerHTML = SECTIONS.map(s => `<button type="button" data-act="jump" data-sec="${s.key}"><span class="plate sm" aria-hidden="true">${s.n}</span>${esc(s.short)}</button>`).join('')
    + `<span class="jump-all"><button type="button" data-act="expand-all">Expand all</button><button type="button" data-act="collapse-all">Collapse all</button></span>`;
}
function rowHTML(c){
  const owner = ownerName(c);
  const sub = [FREQ[c.frequency], c.comment].filter(Boolean).join(' · ');
  return `<button type="button" class="row item" data-act="open" data-id="${esc(c.id)}">
    <span class="c-title"><span class="t">${esc(c.title)}</span><span class="sub">${esc(sub)}</span></span>
    <span class="c-status">${pill(c.status)}</span>
    <span class="c-last"><span class="lbl">Last completed</span>${c.lastCompleted ? `<span class="mono">${fmt(c.lastCompleted)}</span>` : '<span class="dash">Not recorded</span>'}</span>
    <span class="c-due">${c.nextDue ? `<span class="mono">${fmt(c.nextDue)}</span><span class="due-rel ${dueClass(c)}">${rel(c.nextDue)}</span>` : '<span class="dash">No due date</span>'}</span>
    <span class="c-owner${owner ? '' : ' un'}">${owner ? esc(owner) : 'Unassigned'}</span>
    <span class="c-docs${c.docs.length ? ' has' : ''}" aria-label="${c.docs.length} documents">${ICON.clip}${c.docs.length || ''}</span>
  </button>`;
}
function renderBoard(){
  renderFilters();
  const ro = readOnly();
  const filtered = S.filter.status !== 'all' || S.filter.owner !== 'all' || S.filter.q.trim();
  $('#sections').innerHTML = SECTIONS.map(sec => {
    const all = checksIn(sec.key), shown = all.filter(matches);
    const cnt = {red:0, amber:0, green:0, none:0}; all.forEach(c => cnt[c.status]++);
    const od = all.filter(c => dueState(c) === 'overdue').length;
    const segs = all.length ? STATUS_ORDER.filter(k => cnt[k]).map(k => `<span class="seg-${k}" style="width:${(cnt[k]/all.length*100).toFixed(2)}%"></span>`).join('') : '';
    let body;
    if (S.loading) body = `<p class="empty">Loading checks…</p>`;
    else if (!all.length) body = `<p class="empty">No checks in this section yet.${ro ? '' : ' Use <b>Add check</b> to create the first one.'}</p>`;
    else if (!shown.length) body = `<p class="empty">No checks here match the current filter.</p>`;
    else body = `<div class="row head" aria-hidden="true"><span>Check</span><span>Status</span><span>Last completed</span><span>Next due</span><span>Responsible</span><span>Docs</span></div>` + shown.map(rowHTML).join('');
    // A filter or search opens every section that has matches, without changing what's remembered.
    const open = S.openSecs.has(sec.key) || Boolean(filtered && shown.length > 0);
    const meta = [`${all.length} check${all.length === 1 ? '' : 's'}`];
    if (filtered && all.length) meta.push(`${shown.length} shown`);
    if (od) meta.push(`<span class="od">${od} overdue</span>`);
    if (cnt.red) meta.push(`<span class="od">${cnt.red} red</span>`);
    if (cnt.amber) meta.push(`${cnt.amber} amber`);
    return `<section class="sec" id="sec-${sec.key}" data-open="${open}">
      <header class="sec-head">
        <button type="button" class="sec-toggle" data-act="toggle-sec" data-sec="${sec.key}" aria-expanded="${open}" aria-controls="rows-${sec.key}">
          <span class="plate" aria-hidden="true">${sec.n}</span>
          <span class="sec-titles"><span class="sec-h" id="h-${sec.key}" role="heading" aria-level="2">${esc(sec.title)}</span>
            <span class="sec-meta">${meta.join(' · ')}</span></span>
          ${all.length ? `<span class="ragbar mini" aria-hidden="true">${segs}</span>` : ''}
          <span class="chev" aria-hidden="true">${ICON.chev}</span>
        </button>
        ${ro ? '' : `<button type="button" class="btn ghost" data-act="add" data-sec="${sec.key}">${ICON.plus}Add check</button>`}
      </header>
      <div class="rows" id="rows-${sec.key}"${open ? '' : ' hidden'}>${body}</div>
    </section>`;
  }).join('');
}

// ---------- render: upcoming ----------
function upItem(c){
  const d = parse(c.nextDue); const owner = ownerName(c);
  return `<li><button type="button" class="up-item" data-act="open" data-id="${esc(c.id)}">
    <span class="cal" aria-hidden="true"><span class="m">${d ? MONTHS[d.getMonth()].toUpperCase() : '—'}</span><span class="d">${d ? d.getDate() : '?'}</span></span>
    <span class="up-main"><span class="t">${esc(c.title)}</span><span class="sub">${SEC[c.section].n} · ${esc(SEC[c.section].short)} · ${owner ? esc(owner) : 'Unassigned'}</span></span>
    ${pill(c.status)}
    <span class="due-rel ${dueClass(c)}">${c.nextDue ? rel(c.nextDue) : ''}</span>
  </button></li>`;
}
function renderUpcoming(){
  const dated = S.checks.filter(c => c.nextDue).sort((a,b) => a.nextDue.localeCompare(b.nextDue));
  const overdue = dated.filter(c => daysUntil(c.nextDue) < 0);
  const future = dated.filter(c => daysUntil(c.nextDue) >= 0);
  const nodate = sortChecks(S.checks.filter(c => !c.nextDue));
  const groups = {};
  future.forEach(c => { const k = c.nextDue.slice(0, 7); (groups[k] = groups[k] || []).push(c); });
  let h = `<div class="view-intro"><div><h2>Upcoming</h2><p>Every dated check in due-date order, with overdue items first.</p></div></div>`;
  if (S.loading) h += `<p class="hint">Loading…</p>`;
  else if (!S.checks.length) h += `<p class="hint">Due dates will appear here once checks are added.</p>`;
  if (overdue.length) h += `<div class="month"><h3 class="od">Overdue · ${overdue.length}</h3><ul class="up-list">${overdue.map(upItem).join('')}</ul></div>`;
  Object.keys(groups).forEach(k => { const [y, m] = k.split('-').map(Number); h += `<div class="month"><h3>${MONTHS_L[m-1]} ${y}</h3><ul class="up-list">${groups[k].map(upItem).join('')}</ul></div>`; });
  if (nodate.length) h += `<div class="month"><h3>No due date set · ${nodate.length}</h3><ul class="up-list">${nodate.map(upItem).join('')}</ul></div>`;
  $('#view-upcoming').innerHTML = h;
}

// ---------- render: reminders ----------
function reminderText(p, items){
  const first = (p ? p.name : '').split(/\s+/)[0] || 'there';
  const od = items.filter(x => x.r.kind === 'overdue'), due = items.filter(x => x.r.kind === 'due');
  const line = x => `- ${x.c.title} (${SEC[x.c.section].title}): due ${fmt(x.c.nextDue)}, ${rel(x.c.nextDue).toLowerCase()}`;
  let t = `Subject: Governance reminders for ${p ? p.name : 'unassigned checks'}, ${fmt(today())}\n\nHi ${first},\n\nThese governance checks you are responsible for need attention:\n`;
  if (od.length) t += `\nOVERDUE\n${od.map(line).join('\n')}\n`;
  if (due.length) t += `\nDUE SOON\n${due.map(line).join('\n')}\n`;
  t += `\nWhen each one is done, mark it completed on the Directors' Governance Board (${location.origin}${location.pathname}) and attach any certificates or records.\n`;
  return t;
}
function remGroups(){
  const map = new Map();
  S.checks.forEach(c => {
    const r = reminderState(c); if (!r || r.kind === 'off') return;
    const owners = ownersOf(c); // each responsible person gets the check in their own list
    (owners.length ? owners : [null]).forEach(p => {
      const k = p ? p.id : '';
      if (!map.has(k)) map.set(k, {p, now:[], later:[]});
      (r.kind === 'sched' ? map.get(k).later : map.get(k).now).push({c, r});
    });
  });
  map.forEach(g => { g.now.sort((a,b) => a.c.nextDue.localeCompare(b.c.nextDue)); g.later.sort((a,b) => a.r.sendOn.localeCompare(b.r.sendOn)); });
  return [...map.values()].sort((a,b) => (!a.p) - (!b.p) || b.now.length - a.now.length || (a.p ? a.p.name : '').localeCompare(b.p ? b.p.name : ''));
}
function renderReminders(){
  const st = S.settings;
  const lastRun = st && str(st.lastRun);
  let h = `<div class="view-intro"><div><h2>Reminders</h2><p>Each check emails its responsible person when its reminder window opens, then again while it is overdue. Set the window on each check.</p></div></div>
  <div class="panel mail-status">${ICON.mail}<div><h3>${lastRun ? 'Automatic reminder emails are on' : 'Automatic reminder emails are not switched on yet'}</h3>
  <p>${lastRun ? `Last daily run ${esc(fmtDT(lastRun))}${Number.isFinite(Number(st.sentCount)) ? `, ${Number(st.sentCount)} email${Number(st.sentCount) === 1 ? '' : 's'} sent` : ''}.` : 'Until they are, use <b>Copy reminder email</b> below to send each person their list from your own mailbox.'}</p></div></div>`;
  const groups = remGroups();
  if (S.loading) h += `<p class="hint">Loading…</p>`;
  else if (!groups.length) h += `<p class="hint">No reminders yet. Give checks a next due date and a responsible person, and their reminders will be listed here.</p>`;
  h += `<div class="pc-grid">` + groups.map((g, i) => {
    const p = g.p;
    const head = p
      ? `<div class="pc-who"><div class="nm">${esc(p.name)}${p.role ? ` <span class="hint">· ${esc(p.role)}</span>` : ''}</div>${p.email ? `<div class="em">${esc(p.email)}</div>` : `<div class="em missing">No email address. Add one on the People tab.</div>`}</div>`
      : `<div class="pc-who"><div class="nm">No responsible person</div><div class="em missing">These checks have due dates but nobody will be reminded. Assign someone to each.</div></div>`;
    const acts = p && g.now.length ? `<button type="button" class="btn" data-act="copy-mail" data-i="${i}">${ICON.copy}Copy reminder email</button>` : '';
    const nowList = g.now.length ? `<ul class="rem-list">${g.now.map(x => `<li><span class="tag ${x.r.kind}">${x.r.kind === 'overdue' ? 'Overdue' : 'Due soon'}</span><span class="t"><button type="button" class="linkish" data-act="open" data-id="${esc(x.c.id)}">${esc(x.c.title)}</button> <span class="hint">· due ${fmt(x.c.nextDue)}</span></span><span class="due-rel ${dueClass(x.c)}">${rel(x.c.nextDue)}</span></li>`).join('')}</ul>` : `<p class="empty" style="padding:10px 14px">Nothing needs a reminder today.</p>`;
    const later = g.later.length ? `<details class="sched"><summary>${g.later.length} scheduled reminder${g.later.length === 1 ? '' : 's'}</summary><ul class="rem-list">${g.later.map(x => `<li><span class="tag sched">${fmt(x.r.sendOn)}</span><span class="t"><button type="button" class="linkish" data-act="open" data-id="${esc(x.c.id)}">${esc(x.c.title)}</button> <span class="hint">· due ${fmt(x.c.nextDue)}</span></span><span class="due-rel">${x.c.remindDays} days before</span></li>`).join('')}</ul></details>` : '';
    return `<div class="panel person-card"><div class="pc-head">${head}${acts}</div>${nowList}${later}</div>`;
  }).join('') + `</div>`;
  S._remGroups = groups;
  $('#view-reminders').innerHTML = h;
}

// ---------- render: people ----------
function renderPeople(){
  const ro = readOnly();
  const ed = S.editingPerson ? S.people.find(p => p.id === S.editingPerson) : null;
  if (S.editingPerson && !ed) S.editingPerson = null;
  const count = id => S.checks.filter(c => hasOwner(c, id)).length;
  let h = `<div class="view-intro"><div><h2>People</h2><p>Directors and staff who can be made responsible for a check. Reminder emails go to the address shown here. This list is separate from who can sign in, which admins manage on the Users tab.</p></div></div><div class="people-wrap">`;
  if (!ro) h += `<form class="panel pform" id="pform" novalidate>
      <h3>${ed ? 'Edit person' : 'Add a person'}</h3>
      <div class="field"><label for="p-name">Name</label><input type="text" id="p-name" maxlength="80" required value="${esc(ed ? ed.name : '')}"></div>
      <div class="field"><label for="p-email">Email</label><input type="email" id="p-email" maxlength="160" value="${esc(ed ? ed.email : '')}" placeholder="name@company.co.uk"></div>
      <div class="field"><label for="p-role">Role</label><input type="text" id="p-role" maxlength="80" value="${esc(ed ? ed.role : '')}" placeholder="e.g. Director, Workshop Manager"></div>
      ${S.personErr ? `<p class="err-text">${esc(S.personErr)}</p>` : ''}
      <div style="display:flex; gap:8px; flex-wrap:wrap"><button class="btn primary" type="submit">${ed ? 'Save changes' : 'Add person'}</button>${ed ? '<button class="btn" type="button" data-act="person-cancel">Cancel</button>' : ''}</div>
    </form>`;
  h += `<div class="panel">` + (S.people.length ? `<ul class="plist">${S.people.map(p => {
    const n = count(p.id);
    const acts = ro ? '' : S.confirmPerson === p.id
      ? `<div class="confirm-line"><span>Remove ${esc(p.name)}?${n ? ` ${n} check${n === 1 ? '' : 's'} will become unassigned.` : ''}</span><button type="button" class="btn sm" data-act="person-keep">Cancel</button><button type="button" class="btn sm danger solid" data-act="person-remove" data-id="${esc(p.id)}">Remove</button></div>`
      : `<div class="acts"><button type="button" class="btn sm ghost" data-act="person-edit" data-id="${esc(p.id)}">Edit</button><button type="button" class="btn sm ghost danger" data-act="person-ask" data-id="${esc(p.id)}">Remove</button></div>`;
    return `<li><div><div class="nm">${esc(p.name)}${p.role ? ` <span class="hint">· ${esc(p.role)}</span>` : ''}</div><div class="sub">${p.email ? esc(p.email) : '<span class="err-text">No email address</span>'} · responsible for ${n} check${n === 1 ? '' : 's'}</div></div>${acts}</li>`;
  }).join('')}</ul>` : `<p class="empty">${S.loading ? 'Loading…' : 'No people yet. Add each director and any staff who own checks, with the email address their reminders should go to.'}</p>`) + `</div></div>`;
  $('#view-people').innerHTML = h;
}

// ---------- render: users (admin) ----------
function renderUsers(){
  if (!isAdmin()) { $('#view-users').innerHTML = `<p class="hint">Only admins can manage who has access.</p>`; return; }
  let h = `<div class="view-intro"><div><h2>Users</h2><p>Who can sign in to this board, and what they can do. People sign in with a link emailed to the address listed here, so no Claude account or password is needed.</p></div></div><div class="people-wrap">
    <form class="panel pform" id="mform" novalidate>
      <h3>Give someone access</h3>
      <div class="field"><label for="m-email">Email</label><input type="email" id="m-email" maxlength="160" required placeholder="name@company.co.uk"></div>
      <div class="field"><label for="m-name">Name</label><input type="text" id="m-name" maxlength="80" placeholder="Shown in the activity log"></div>
      <div class="field"><label for="m-role">Access</label><select id="m-role">${Object.keys(ROLES).map(r => `<option value="${r}"${r === 'viewer' ? ' selected' : ''}>${ROLES[r]}: ${ROLE_HELP[r]}</option>`).join('')}</select></div>
      ${S.memberErr ? `<p class="err-text">${esc(S.memberErr)}</p>` : ''}
      <div><button class="btn primary" type="submit">Give access</button></div>
      <p class="hint">Then send them the board's address. They enter their email on the sign-in page and click the link they're sent.</p>
    </form>
    <div class="panel"><ul class="plist ulist">${S.members.map(m => {
      const me = m.email === S.email;
      const acts = S.confirmMember === m.email
        ? `<div class="confirm-line"><span>Remove access for ${esc(m.full_name || m.email)}?</span><button type="button" class="btn sm" data-act="member-keep">Cancel</button><button type="button" class="btn sm danger solid" data-act="member-remove" data-email="${esc(m.email)}">Remove</button></div>`
        : `<div class="acts"><select data-member-role="${esc(m.email)}" aria-label="Access for ${esc(m.email)}">${Object.keys(ROLES).map(r => `<option value="${r}"${m.role === r ? ' selected' : ''}>${ROLES[r]}</option>`).join('')}</select>${me ? '' : `<button type="button" class="btn sm ghost danger" data-act="member-ask" data-email="${esc(m.email)}">Remove</button>`}</div>`;
      return `<li><div><div class="nm">${esc(m.full_name || m.email)}${me ? ' <span class="you">(you)</span>' : ''}</div><div class="sub">${esc(m.email)} · ${esc(ROLE_HELP[m.role] || '')}</div></div>${acts}</li>`;
    }).join('')}</ul></div></div>`;
  $('#view-users').innerHTML = h;
}

// ---------- render: activity ----------
const VERB = {created:'added', updated:'updated', completed:'marked complete', deleted:'deleted', docadd:'attached a document to', docremove:'removed a document from'};
function renderActivity(){
  let h = `<div class="view-intro"><div><h2>Activity</h2><p>Who changed what, newest first. The last 150 changes are shown.</p></div></div>`;
  h += `<div class="panel">` + (S.activity.length ? `<ul class="act-list">${S.activity.map(a => {
    const title = byId(a.checkId) ? `<button type="button" class="linkish" data-act="open" data-id="${esc(a.checkId)}">${esc(a.checkTitle || 'a check')}</button>` : `<b>${esc(a.checkTitle || 'a check')}</b>`;
    return `<li><span class="what"><span class="who">${esc(nameFor(a.by))}</span> ${esc(VERB[a.action] || a.action)} ${title}</span><time class="mono" datetime="${esc(a.at)}">${esc(fmtDT(a.at))}</time>${a.detail ? `<span class="detail">${esc(a.detail)}</span>` : ''}</li>`;
  }).join('')}</ul>` : `<p class="empty">${S.loading ? 'Loading…' : 'Changes to checks, completions and document uploads will be recorded here.'}</p>`) + `</div>`;
  $('#view-activity').innerHTML = h;
}

function renderView(){
  ({board:renderBoard, upcoming:renderUpcoming, reminders:renderReminders, people:renderPeople, activity:renderActivity, users:renderUsers})[S.view]();
}
let rafPending = false;
function scheduleRender(){
  if (rafPending) return; rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const a = document.activeElement;
    const keep = a && a.id && !$('#drawer').contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA') ? {id:a.id, val:a.value} : null;
    if (keep && (keep.id.startsWith('p-') || keep.id.startsWith('m-'))) return; // don't wipe a form someone is typing in
    renderSummary(); renderView();
    if (keep) { const el = $('#' + keep.id); if (el && document.activeElement !== el) el.focus(); }
  });
}
function route(){
  const h = location.hash.slice(1);
  S.view = VIEWS.includes(h) && (h !== 'users' || isAdmin()) ? h : 'board';
  $$('.view').forEach(v => v.hidden = v.dataset.view !== S.view);
  $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.view === S.view ? 'page' : 'false'));
  renderView();
}

// ---------- drawer ----------
function blankDraft(section){ return {section, title:'', detail:'', status:'none', lastCompleted:'', nextDue:'', frequency:'12m', ownerId:'', owner2Id:'', remindDays:30, comment:''}; }
const FIELDS = ['section','title','detail','status','lastCompleted','nextDue','frequency','ownerId','owner2Id','remindDays','comment'];
function openDrawer(id, section, opener){
  S.opener = opener || document.activeElement;
  const c = id ? byId(id) : null;
  if (id && !c) return;
  S.openId = id || null;
  S.base = c ? Object.fromEntries(FIELDS.map(f => [f, c[f]])) : blankDraft(section || 'corporate');
  S.baseUpdatedAt = c ? c.updatedAt : '';
  S.draft = {...S.base};
  S.dirty = false; S.footMode = ''; S.confirmDoc = null; S.upMsgs = [];
  S.drawerOpen = true;
  renderDrawer();
  document.body.classList.add('locked');
  const f = $('#f-title'); if (f && !id) f.focus(); else { const x = $('#drawer [data-act="close"]'); if (x) x.focus(); }
}
function closeDrawer(force){
  if (S.dirty && !force) { S.footMode = 'discard'; renderFoot(); return; }
  S.drawerOpen = false; S.openId = null; S.dirty = false;
  $('#drawer').hidden = true; $('#scrim').hidden = true; $('#drawer').innerHTML = '';
  document.body.classList.remove('locked');
  if (S.opener && document.contains(S.opener)) S.opener.focus();
}
function readForm(){
  const d = S.draft; if (!$('#f-title')) return;
  d.title = $('#f-title').value; d.detail = $('#f-detail').value; d.section = $('#f-section').value;
  const st = $('input[name="f-status"]:checked'); d.status = st ? st.value : d.status;
  d.lastCompleted = $('#f-last').value; d.nextDue = $('#f-next').value; d.frequency = $('#f-freq').value;
  d.ownerId = $('#f-owner').value; d.remindDays = Number($('#f-remind').value); d.comment = $('#f-comment').value;
  if ($('#f-owner2')) d.owner2Id = $('#f-owner2').value;
  if (d.owner2Id && d.owner2Id === d.ownerId) d.owner2Id = '';
  if (!d.ownerId && d.owner2Id) { d.ownerId = d.owner2Id; d.owner2Id = ''; }
}
function docsHTML(){
  const c = S.openId ? byId(S.openId) : null; const docs = c ? c.docs : [];
  const ro = readOnly();
  let h = `<div class="docs-head"><span class="label">Documents</span><span class="count">${docs.length}</span></div>`;
  if (docs.length) h += `<ul class="docs">` + docs.map(doc => {
    const ext = extOf(doc.name).toUpperCase() || 'FILE';
    const acts = S.confirmDoc === doc.id
      ? `<span class="confirm-line">Remove this file?<button type="button" class="btn sm" data-act="doc-keep">Cancel</button><button type="button" class="btn sm danger solid" data-act="doc-remove" data-doc="${esc(doc.id)}">Remove</button></span>`
      : `<button type="button" class="btn sm ghost" data-act="doc-view" data-doc="${esc(doc.id)}">View</button><button type="button" class="btn sm ghost" data-act="doc-download" data-doc="${esc(doc.id)}">Download</button>${ro ? '' : `<button type="button" class="btn sm ghost danger" data-act="doc-ask" data-doc="${esc(doc.id)}">Remove</button>`}`;
    return `<li class="doc"><span class="ext">${esc(ext.slice(0, 4))}</span>
      <div class="doc-main"><span class="doc-name">${esc(doc.name)}</span><span class="doc-sub">${fmtSize(doc.size)}${doc.at ? ` · added ${fmt(doc.at.slice(0, 10))}` : ''}${doc.by ? ` by ${esc(nameFor(doc.by))}` : ''}</span></div>
      <div class="doc-acts">${acts}</div></li>`;
  }).join('') + `</ul>`;
  else h += `<p class="hint">No documents attached yet.</p>`;
  if (!S.openId) { if (!ro) h += `<p class="hint">Save the check first, then attach certificates, policies or records.</p>`; }
  else if (!ro) h += `<label class="drop" id="drop" for="f-file"><input id="f-file" type="file" multiple><span><strong>Upload documents</strong> or drop files here</span><small>Any file type · up to 50 MB each</small></label>`;
  if (S.upMsgs.length) h += `<div class="up-status" aria-live="polite">${S.upMsgs.map(m => `<span class="${m.kind || ''}">${esc(m.text)}</span>`).join('')}</div>`;
  return h;
}
function metaHTML(){
  const c = S.openId ? byId(S.openId) : null; if (!c) return '';
  let h = '';
  if (c.updatedAt) h += `<span>Last changed ${esc(fmtDT(c.updatedAt))}${c.updatedBy ? ` by ${esc(nameFor(c.updatedBy))}` : ''}</span>`;
  if (c.lastReminderSent) h += `<span>Last reminder email ${esc(fmtDT(c.lastReminderSent))}</span>`;
  const acts = S.activity.filter(a => a.checkId === c.id).slice(0, 5);
  if (acts.length) h += `<div class="label" style="margin-top:10px">Recent changes</div><ul class="mini-act">${acts.map(a => `<li><span class="who">${esc(nameFor(a.by))}</span> ${esc(VERB[a.action] || a.action)} this check · ${esc(fmtDT(a.at))}${a.detail ? `<br>${esc(a.detail)}` : ''}</li>`).join('')}</ul>`;
  return h;
}
function footHTML(){
  if (readOnly()) return `<span class="msg">View only</span><span class="spacer"></span><button type="button" class="btn" data-act="close">Close</button>`;
  if (S.footMode === 'delete') {
    const c = byId(S.openId); const n = c ? c.docs.length : 0;
    return `<span class="msg warn">Delete this check${n ? ` and its ${n} document${n === 1 ? '' : 's'}` : ''}? This can't be undone.</span><span class="spacer"></span><button type="button" class="btn" data-act="foot-reset">Cancel</button><button type="button" class="btn danger solid" data-act="delete">Delete check</button>`;
  }
  if (S.footMode === 'discard') return `<span class="msg warn">Discard unsaved changes?</span><span class="spacer"></span><button type="button" class="btn" data-act="foot-reset">Keep editing</button><button type="button" class="btn danger solid" data-act="discard">Discard</button>`;
  return `${S.openId ? '<button type="button" class="btn ghost danger" data-act="delete-ask">Delete</button>' : ''}<span class="spacer"></span><span class="msg${S.dirty ? ' warn' : ''}">${S.dirty ? 'Unsaved changes' : ''}</span><button type="button" class="btn" data-act="close">Close</button><button type="button" class="btn primary" data-act="save"${S.saving ? ' disabled' : ''}>${S.openId ? 'Save changes' : 'Add check'}</button>`;
}
function renderFoot(){ const f = $('#dr-foot'); if (f) f.innerHTML = footHTML(); }
function renderLive(){
  const d = $('#dr-docs'); if (d) d.innerHTML = docsHTML();
  const m = $('#dr-meta'); if (m) m.innerHTML = metaHTML();
}
function nextHint(){ const n = S.draft.nextDue; return n ? rel(n) : (S.draft.frequency === 'once' ? 'One-off check' : 'Set a last completed date to work this out'); }
function renderDrawer(){
  const dr = $('#drawer');
  if (!S.drawerOpen) return;
  const d = S.draft, sec = SEC[d.section], ro = readOnly(), dis = ro ? ' disabled' : '';
  const ownerSelect = (id, val, emptyLabel) => {
    const known = !val || S.people.some(p => p.id === val);
    return `<select id="${id}"${dis}><option value="">${emptyLabel}</option>${S.people.map(p => `<option value="${esc(p.id)}"${val === p.id ? ' selected' : ''}>${esc(p.name)}${p.role ? ' · ' + esc(p.role) : ''}</option>`).join('')}${known ? '' : `<option value="${esc(val)}" selected>Removed person</option>`}</select>`;
  };
  dr.innerHTML = `
  <div class="dr-head"><span class="plate" aria-hidden="true">${sec.n}</span>
    <div class="dr-titles"><div class="eyebrow">${esc(sec.title)}</div><h2 id="dr-title">${S.openId ? esc(d.title || 'Untitled check') : 'New check'}</h2></div>
    <button type="button" class="icon-btn" data-act="close" aria-label="Close">${ICON.x}</button></div>
  <div class="dr-body">
    ${ro ? '<p class="note">You have view-only access. Ask an admin if you need to make changes.</p>' : ''}
    <div class="field"><label for="f-title">Check</label><input type="text" id="f-title" maxlength="160" value="${esc(d.title)}" placeholder="e.g. Fire risk assessment"${dis}></div>
    <div class="field"><label for="f-detail">What's required</label><textarea id="f-detail" rows="3" maxlength="2000" placeholder="What has to be in place, and what evidence to keep"${dis}>${esc(d.detail)}</textarea></div>
    <fieldset class="field"><legend>Current status</legend><div class="rag-pick">${STATUS_ORDER.map(k => `<label class="rag-opt s-${k}"><input type="radio" name="f-status" value="${k}"${d.status === k ? ' checked' : ''}${dis}><span><i></i>${STATUS[k]}</span></label>`).join('')}</div></fieldset>
    <div class="grid2">
      <div class="field"><label for="f-last">Last completed</label><input type="date" id="f-last" value="${esc(d.lastCompleted)}"${dis}></div>
      <div class="field"><label for="f-freq">Repeats</label><select id="f-freq"${dis}>${FREQS.map(([k, l]) => `<option value="${k}"${d.frequency === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="f-next">Next due</label><input type="date" id="f-next" value="${esc(d.nextDue)}"${dis}><p class="hint" id="f-next-hint">${esc(nextHint())}</p></div>
      <div class="field"><label for="f-remind">Email reminder</label><select id="f-remind"${dis}>${REMIND.map(n => `<option value="${n}"${d.remindDays === n ? ' selected' : ''}>${n ? n + ' days before due' : 'No reminder'}</option>`).join('')}${REMIND.includes(d.remindDays) ? '' : `<option value="${d.remindDays}" selected>${d.remindDays} days before due</option>`}</select></div>
    </div>
    ${S.hasOwner2
      ? `<div class="grid2">
          <div class="field"><label for="f-owner">Responsible person</label>${ownerSelect('f-owner', d.ownerId, 'Unassigned')}</div>
          <div class="field"><label for="f-owner2">Second person (optional)</label>${ownerSelect('f-owner2', d.owner2Id, 'None')}</div>
        </div>
        <p class="hint" style="margin-top:-8px">${S.people.length ? 'Reminder emails go to everyone responsible.' : 'Add people on the People tab, then assign them here.'}</p>`
      : `<div class="field"><label for="f-owner">Responsible person</label>${ownerSelect('f-owner', d.ownerId, 'Unassigned')}
          <p class="hint">${S.people.length ? 'Reminder emails go to this person.' : 'Add people on the People tab, then assign them here.'}</p></div>`}
    <div class="field"><label for="f-section">Section</label><select id="f-section"${dis}>${SECTIONS.map(s => `<option value="${s.key}"${d.section === s.key ? ' selected' : ''}>${s.n}. ${esc(s.title)}</option>`).join('')}</select></div>
    <div class="field"><label for="f-comment">Comment</label><textarea id="f-comment" rows="4" maxlength="4000" placeholder="Notes, findings, actions agreed, supplier or broker contacts"${dis}>${esc(d.comment)}</textarea></div>
    ${S.openId && !ro ? `<div class="complete-box"><div class="txt"><strong>Mark as completed</strong><span>Sets status to Green, records the date and rolls the next due date forward.</span></div><input type="date" id="f-done" value="${today()}" aria-label="Date completed"><button type="button" class="btn" data-act="complete">Mark completed</button></div>` : ''}
    <div class="field" id="dr-docs">${docsHTML()}</div>
    <div class="meta" id="dr-meta">${metaHTML()}</div>
  </div>
  <div class="dr-foot" id="dr-foot">${footHTML()}</div>`;
  dr.hidden = false; $('#scrim').hidden = false;
}
function onDrawerInput(e){
  const id = e.target.id;
  if (!S.drawerOpen || id === 'f-file' || id === 'f-done') return;
  readForm();
  if ((id === 'f-last' || id === 'f-freq') && S.draft.lastCompleted && S.draft.frequency !== 'once') {
    S.draft.nextDue = addFreq(S.draft.lastCompleted, S.draft.frequency); $('#f-next').value = S.draft.nextDue;
  }
  $('#f-next-hint').textContent = nextHint();
  S.dirty = FIELDS.some(f => String(S.draft[f]) !== String(S.base[f]));
  if (S.footMode === 'discard' && !S.dirty) S.footMode = '';
  renderFoot();
}
function describe(prev, next){
  const out = [];
  if (prev.status !== next.status) out.push(`Status ${STATUS[prev.status]} → ${STATUS[next.status]}`);
  if (prev.lastCompleted !== next.lastCompleted) out.push(`Last completed ${fmt(next.lastCompleted) || 'cleared'}`);
  if (prev.nextDue !== next.nextDue) out.push(`Next due ${fmt(next.nextDue) || 'cleared'}`);
  if (prev.ownerId !== next.ownerId || (prev.owner2Id || '') !== (next.owner2Id || '')) out.push(`Responsible: ${ownerName(next) || 'unassigned'}`);
  if (prev.frequency !== next.frequency) out.push(`Repeats ${FREQ[next.frequency].toLowerCase()}`);
  if (prev.section !== next.section) out.push(`Moved to ${SEC[next.section].title}`);
  if (prev.title !== next.title) out.push('Renamed');
  if (prev.comment !== next.comment) out.push('Comment updated');
  if (prev.detail !== next.detail) out.push('Requirement text updated');
  if (prev.remindDays !== next.remindDays) out.push(next.remindDays ? `Reminder ${next.remindDays} days before` : 'Reminder off');
  return out.join('; ');
}
async function saveDraft(action){
  if (readOnly() || S.saving) return;
  readForm();
  const d = S.draft;
  d.title = d.title.trim();
  if (!d.title) { toast('Give the check a name before saving.', 'err'); $('#f-title').focus(); return; }
  if (d.nextDue && !parse(d.nextDue)) { toast('Next due date is not a valid date.', 'err'); return; }
  const stamp = {updated_at: nowISO(), updated_by: S.email};
  S.saving = true; renderFoot();
  try {
    if (!S.openId) {
      const order = Math.max(0, ...checksIn(d.section).map(c => c.order)) + 10;
      const row = await q(S.sb.from('checks').insert({...toRow(d), sort_order: order, ...stamp}).select().single());
      S.openId = row.id;
      S.checks.push(normCheck(row, {}));
      log({checkId: row.id, title: d.title, section: d.section, action:'created', detail: SEC[d.section].title});
      toast('Check added');
    } else {
      const full = toRow(d), changed = {};
      FIELDS.forEach(f => { if (String(d[f]) !== String(S.base[f])) changed[ROW_KEY[f]] = full[ROW_KEY[f]]; });
      if (action !== 'completed' && !Object.keys(changed).length) { toast('No changes to save'); return; }
      const row = await q(S.sb.from('checks').update({...changed, ...stamp}).eq('id', S.openId).select().single());
      const i = S.checks.findIndex(c => c.id === row.id);
      if (i >= 0) S.checks[i] = normCheck(row, {[row.id]: S.checks[i].docs});
      log({checkId: S.openId, title: d.title, section: d.section, action: action || 'updated', detail: describe(S.base, d)});
      toast(action === 'completed' ? 'Marked completed' : 'Saved');
    }
    S.base = {...d}; S.baseUpdatedAt = stamp.updated_at; S.dirty = false; S.footMode = '';
    const c = byId(S.openId); if (c) S.baseUpdatedAt = c.updatedAt;
    renderDrawer(); scheduleRender();
  } catch (e) { fail(e, 'save this check'); }
  finally { S.saving = false; renderFoot(); }
}
function markComplete(){
  readForm();
  const done = $('#f-done').value || today();
  if (!parse(done)) { toast('Choose the date it was completed.', 'err'); return; }
  S.draft.lastCompleted = done; S.draft.status = 'green';
  S.draft.nextDue = S.draft.frequency === 'once' ? '' : addFreq(done, S.draft.frequency);
  $('#f-last').value = S.draft.lastCompleted; $('#f-next').value = S.draft.nextDue;
  const r = $('input[name="f-status"][value="green"]'); if (r) r.checked = true;
  saveDraft('completed');
}
async function deleteCheck(){
  const c = byId(S.openId); if (!c) return;
  try {
    if (c.docs.length) { const {error} = await S.sb.storage.from('documents').remove(c.docs.map(d => d.path)); if (error) throw error; }
    await q(S.sb.from('checks').delete().eq('id', c.id));
    log({checkId: c.id, title: c.title, section: c.section, action:'deleted', detail: c.docs.length ? `${c.docs.length} document${c.docs.length === 1 ? '' : 's'} removed` : ''});
    S.checks = S.checks.filter(x => x.id !== c.id);
    toast('Check deleted');
    closeDrawer(true); scheduleRender();
  } catch (e) { fail(e, 'delete this check'); }
}

// ---------- documents ----------
function upMsg(text, kind){ S.upMsgs.push({text, kind}); S.upMsgs = S.upMsgs.slice(-6); renderLive(); }
async function uploadFiles(files){
  if (!S.openId || readOnly()) return;
  const checkId = S.openId;
  S.upMsgs = [];
  for (const file of files) {
    if (!file.size) { upMsg(`${file.name} is empty.`, 'err'); continue; }
    if (file.size > MAX_FILE) { upMsg(`${file.name} is ${fmtSize(file.size)}. The limit is 50 MB.`, 'err'); continue; }
    upMsg(`Uploading ${file.name}…`);
    const path = `${checkId}/${uuid()}-${safeName(file.name)}`;
    try {
      const {error} = await S.sb.storage.from('documents').upload(path, file, {contentType: file.type || 'application/octet-stream', upsert:false});
      if (error) throw error;
      try {
        const row = await q(S.sb.from('documents').insert({check_id: checkId, name: file.name.slice(0, 200), path, size: file.size, mime: file.type || '', uploaded_by: S.email}).select().single());
        const c = byId(checkId); if (c) c.docs.push({id:row.id, name:row.name, size:row.size, type:row.mime, path:row.path, at:row.uploaded_at, by:row.uploaded_by});
      } catch (e) { await S.sb.storage.from('documents').remove([path]); throw e; }
      log({checkId, action:'docadd', detail:file.name});
      upMsg(`${file.name} uploaded.`, 'ok');
    } catch (e) { upMsg(`${file.name}: ${(e && e.message) || 'upload failed'}`, 'err'); }
  }
  scheduleRender();
}
function findDoc(docId){ const c = byId(S.openId); return c && c.docs.find(x => x.id === docId); }
async function viewDoc(docId){
  const doc = findDoc(docId); if (!doc) return;
  const w = window.open('', '_blank');
  const {data, error} = await S.sb.storage.from('documents').createSignedUrl(doc.path, 300);
  if (error || !data) { if (w) w.close(); fail(error, 'open this file'); return; }
  if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
}
async function downloadDoc(docId){
  const doc = findDoc(docId); if (!doc) return;
  const {data, error} = await S.sb.storage.from('documents').createSignedUrl(doc.path, 300, {download: doc.name});
  if (error || !data) { fail(error, 'download this file'); return; }
  const a = document.createElement('a'); a.href = data.signedUrl; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}
async function removeDoc(docId){
  const c = byId(S.openId); const doc = findDoc(docId); if (!c || !doc) return;
  try {
    await q(S.sb.from('documents').delete().eq('id', docId));
    await S.sb.storage.from('documents').remove([doc.path]);
    c.docs = c.docs.filter(x => x.id !== docId);
    S.confirmDoc = null;
    log({checkId: c.id, action:'docremove', detail: doc.name});
    toast('Document removed'); renderLive(); scheduleRender();
  } catch (e) { fail(e, 'remove this file'); }
}

// ---------- people & users ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function savePerson(e){
  e.preventDefault(); if (readOnly()) return;
  const name = $('#p-name').value.trim(), email = $('#p-email').value.trim(), role = $('#p-role').value.trim();
  S.personErr = '';
  if (!name) S.personErr = 'Enter a name.';
  else if (email && !EMAIL_RE.test(email)) S.personErr = 'That email address does not look right.';
  if (S.personErr) { renderPeople(); return; }
  try {
    if (S.editingPerson) await q(S.sb.from('people').update({name, email, role_title: role, updated_at: nowISO()}).eq('id', S.editingPerson));
    else await q(S.sb.from('people').insert({name, email, role_title: role}));
    toast(S.editingPerson ? 'Saved' : `${name} added`);
    S.editingPerson = null; $('#pform') && $('#pform').reset(); await loadAll(); renderPeople();
  } catch (err) { fail(err, 'save this person'); }
}
async function removePerson(id){
  try {
    await q(S.sb.from('people').delete().eq('id', id)); // checks become unassigned automatically
    S.confirmPerson = null; toast('Person removed'); await loadAll();
  } catch (e) { fail(e, 'remove this person'); }
}
async function saveMember(e){
  e.preventDefault(); if (!isAdmin()) return;
  const email = $('#m-email').value.trim().toLowerCase(), full_name = $('#m-name').value.trim(), role = $('#m-role').value;
  S.memberErr = '';
  if (!EMAIL_RE.test(email)) S.memberErr = 'Enter a valid email address.';
  else if (S.members.some(m => m.email === email)) S.memberErr = 'That person already has access. Change their access in the list instead.';
  if (S.memberErr) { renderUsers(); return; }
  try {
    await q(S.sb.from('members').insert({email, full_name, role, added_by: S.email}));
    toast(`Access given to ${full_name || email}`); await loadAll(); renderUsers();
  } catch (err) { fail(err, 'give access'); }
}
async function changeRole(email, role){
  try { await q(S.sb.from('members').update({role}).eq('email', email)); toast('Access updated'); await loadAll(); }
  catch (e) { fail(e, 'change access'); await loadAll(); }
}
async function removeMember(email){
  try { await q(S.sb.from('members').delete().eq('email', email)); S.confirmMember = null; toast('Access removed'); await loadAll(); }
  catch (e) { fail(e, 'remove access'); }
}

// ---------- export & copy ----------
function csvCell(v){ v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function exportCSV(){
  const head = ['Section','Check',"What's required",'Status','Last completed','Next due','Due state','Repeats','Responsible','Responsible email','Reminder (days before)','Comment','Documents'];
  const rows = SECTIONS.flatMap(s => checksIn(s.key).map(c => { const ps = ownersOf(c); return [`${s.n}. ${s.title}`, c.title, c.detail, STATUS[c.status], c.lastCompleted, c.nextDue, c.nextDue ? rel(c.nextDue) : 'No due date', FREQ[c.frequency], ps.map(p => p.name).join(' & '), ps.map(p => p.email).filter(Boolean).join('; '), c.remindDays, c.comment, c.docs.map(d => d.name).join('; ')]; }));
  const csv = '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = `governance-register-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function copyText(text, label){
  let p;
  try { p = navigator.clipboard.writeText(text); } catch (_) { p = Promise.reject(); }
  p.then(() => toast(label + ' copied'), () => { $('#copytext').value = text; $('#copybox').hidden = false; $('#copytext').focus(); $('#copytext').select(); });
}

// ---------- events ----------
const ACTS = {
  open: t => openDrawer(t.dataset.id, null, t),
  add: t => { if (!readOnly()) openDrawer(null, t.dataset.sec, t); },
  close: () => closeDrawer(false),
  discard: () => closeDrawer(true),
  'foot-reset': () => { S.footMode = ''; renderFoot(); },
  'delete-ask': () => { S.footMode = 'delete'; renderFoot(); },
  delete: () => deleteCheck(),
  save: () => saveDraft(),
  complete: () => markComplete(),
  'doc-view': t => viewDoc(t.dataset.doc),
  'doc-download': t => downloadDoc(t.dataset.doc),
  'doc-ask': t => { S.confirmDoc = t.dataset.doc; renderLive(); },
  'doc-keep': () => { S.confirmDoc = null; renderLive(); },
  'doc-remove': t => removeDoc(t.dataset.doc),
  status: t => { S.filter.status = t.dataset.k; renderBoard(); },
  tile: t => { S.filter = {q:'', status:t.dataset.f, owner:'all'}; $('#q').value = ''; if (S.view !== 'board') location.hash = 'board'; else renderBoard(); $('#view-board').scrollIntoView({behavior:'smooth', block:'start'}); },
  jump: t => { S.openSecs.add(t.dataset.sec); saveOpenSecs(); renderBoard(); const el = $('#sec-' + t.dataset.sec); if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); },
  'toggle-sec': t => { const k = t.dataset.sec; const isOpen = t.getAttribute('aria-expanded') === 'true'; if (isOpen) S.openSecs.delete(k); else S.openSecs.add(k); saveOpenSecs(); renderBoard(); const b = $(`[data-act="toggle-sec"][data-sec="${k}"]`); if (b) b.focus(); },
  'expand-all': () => { SECTIONS.forEach(s => S.openSecs.add(s.key)); saveOpenSecs(); renderBoard(); },
  'collapse-all': () => { S.openSecs.clear(); saveOpenSecs(); renderBoard(); },
  export: () => exportCSV(),
  signout: async () => { await S.sb.auth.signOut(); location.hash = ''; location.reload(); },
  'copy-mail': t => { const g = (S._remGroups || [])[Number(t.dataset.i)]; if (g) copyText(reminderText(g.p, g.now), 'Reminder email'); },
  'copybox-close': () => { $('#copybox').hidden = true; },
  'alert-close': () => closeAlert(),
  'pw-open': () => openPw(),
  'pw-close': () => closePw(),
  'alert-open': t => { closeAlert(); openDrawer(t.dataset.id); },
  'alert-show': t => { closeAlert(); S.filter = {q:'', status:t.dataset.f, owner:'all'}; $('#q').value = ''; if (S.view !== 'board') location.hash = 'board'; else renderBoard(); $('#view-board').scrollIntoView({behavior:'smooth', block:'start'}); },
  'person-edit': t => { S.editingPerson = t.dataset.id; S.personErr = ''; renderPeople(); const n = $('#p-name'); if (n) n.focus(); },
  'person-cancel': () => { S.editingPerson = null; S.personErr = ''; renderPeople(); },
  'person-ask': t => { S.confirmPerson = t.dataset.id; renderPeople(); },
  'person-keep': () => { S.confirmPerson = null; renderPeople(); },
  'person-remove': t => removePerson(t.dataset.id),
  'member-ask': t => { S.confirmMember = t.dataset.email; renderUsers(); },
  'member-keep': () => { S.confirmMember = null; renderUsers(); },
  'member-remove': t => removeMember(t.dataset.email),
};
function bindAppEvents(){
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const fn = ACTS[t.dataset.act]; if (fn) { e.preventDefault(); fn(t, e); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'q') { S.filter.q = e.target.value; renderBoard(); return; }
    if (e.target.closest('#drawer')) onDrawerInput(e);
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'owner-filter') { S.filter.owner = e.target.value; renderBoard(); return; }
    if (e.target.id === 'f-file') { const files = Array.from(e.target.files || []); e.target.value = ''; uploadFiles(files); return; }
    if (e.target.dataset.memberRole) { changeRole(e.target.dataset.memberRole, e.target.value); return; }
    if (e.target.closest('#drawer')) onDrawerInput(e);
  });
  document.addEventListener('submit', e => { if (e.target.id === 'pform') savePerson(e); if (e.target.id === 'mform') saveMember(e); });
  document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.remove('over'); uploadFiles(Array.from(e.dataTransfer.files || [])); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#pw-modal').hidden) { closePw(); return; } if (!$('#alert').hidden) { closeAlert(); return; } if (!$('#copybox').hidden) { $('#copybox').hidden = true; return; } if (S.drawerOpen) closeDrawer(false); }
  });
  window.addEventListener('hashchange', route);
}

function onData(){
  scheduleRender();
  if (S.drawerOpen) {
    if (S.openId && !byId(S.openId)) { toast('This check was deleted by someone else.'); closeDrawer(true); return; }
    const c = S.openId ? byId(S.openId) : null;
    if (c && !S.dirty && c.updatedAt !== S.baseUpdatedAt && !S.saving) {
      S.base = Object.fromEntries(FIELDS.map(f => [f, c[f]])); S.draft = {...S.base}; S.baseUpdatedAt = c.updatedAt; renderDrawer();
    } else renderLive();
  }
}
function applyRole(){
  $('#users-tab').hidden = !isAdmin();
  const me = $('#me'); me.textContent = '';
  const init = document.createElement('span'); init.className = 'initial'; init.textContent = (nameFor(S.email).replace(' (you)', '')[0] || '?').toUpperCase();
  const nm = document.createElement('span'); nm.textContent = nameFor(S.email).replace(' (you)', '');
  const chip = document.createElement('span'); chip.className = 'role-chip'; chip.textContent = ROLES[S.role] || '';
  me.append(init, nm, chip);
  if (S.role === 'viewer') banner('ro', 'You have view-only access to this board. Ask an admin if you need to make changes.', 'info'); else banner('ro', null);
  route();
}

// ---------- sign-in ----------
function showScreen(which){
  $('#auth').hidden = which !== 'auth'; $('#setup').hidden = which !== 'setup'; $('#app-root').hidden = which !== 'app';
}
function authMsg(text, err){ const m = $('#auth-msg'); m.textContent = text; m.className = 'msg' + (err ? ' err' : ''); m.hidden = !text; }
// Two ways in: an emailed link (default, works for everyone) or email + password (once someone has set one).
let authMode = (() => { try { return localStorage.getItem('gb-auth-mode') === 'password' ? 'password' : 'link'; } catch (_) { return 'link'; } })();
function setAuthMode(mode){
  authMode = mode; try { localStorage.setItem('gb-auth-mode', mode); } catch (_) {}
  const pw = mode === 'password';
  $('#auth-sub').textContent = pw ? 'Sign in with your work email and the password you set on the board.' : "Enter your work email and we'll send you a sign-in link. No password needed.";
  $('#auth-pw-field').hidden = !pw;
  $('#auth-go').textContent = pw ? 'Sign in' : 'Email me a sign-in link';
  $('#auth-mode').textContent = pw ? 'Forgotten it, or not set one? Email me a link' : 'Sign in with a password instead';
}
function showSignIn(){
  showScreen('auth');
  $('#auth-title').textContent = 'Sign in';
  $('#auth-fields').hidden = false; $('#auth-go').hidden = false; $('#auth-mode').hidden = false; $('#auth-alt').hidden = true; $('#auth-go').disabled = false;
  setAuthMode(authMode);
  const err = new URLSearchParams(location.hash.slice(1)).get('error_description');
  authMsg(err ? `That sign-in link didn't work (${err}). Request a new one.` : '', !!err);
}
function showNoAccess(){
  showScreen('auth');
  $('#auth-title').textContent = 'No access yet';
  $('#auth-sub').textContent = '';
  authMsg(`You're signed in as ${S.email}, but this email isn't on the board's access list. Ask a director to add you on the Users tab, then sign in again.`, true);
  $('#auth-fields').hidden = true; $('#auth-pw-field').hidden = true; $('#auth-go').hidden = true; $('#auth-mode').hidden = true;
  const alt = $('#auth-alt'); alt.hidden = false; alt.textContent = 'Sign out';
  alt.onclick = async () => { await S.sb.auth.signOut(); location.reload(); };
}
function bindAuth(){
  $('#auth-mode').addEventListener('click', () => { authMsg(''); setAuthMode(authMode === 'password' ? 'link' : 'password'); ($('#auth-email').value ? (authMode === 'password' ? $('#auth-password') : $('#auth-go')) : $('#auth-email')).focus(); });
  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#auth-email').value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { authMsg('Enter a valid email address.', true); return; }
    const go = $('#auth-go');
    if (authMode === 'password') {
      const password = $('#auth-password').value;
      if (!password) { authMsg('Enter your password.', true); return; }
      go.disabled = true; go.textContent = 'Signing in…';
      const {error} = await S.sb.auth.signInWithPassword({email, password});
      go.disabled = false; go.textContent = 'Sign in';
      if (error) {
        if (/invalid login credentials/i.test(error.message)) authMsg("That email and password don't match. If you haven't set a password yet, use \"Email me a link\" below, then set one from the board.", true);
        else if (/rate limit|too many/i.test(error.message)) authMsg('Too many attempts. Wait a few minutes and try again.', true);
        else authMsg(`Could not sign in: ${error.message}`, true);
        return;
      }
      $('#auth-password').value = '';
      return; // the sign-in listener opens the board
    }
    go.disabled = true; go.textContent = 'Sending…';
    const {error} = await S.sb.auth.signInWithOtp({email, options:{emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true}});
    go.disabled = false; go.textContent = 'Email me a sign-in link';
    if (error) { authMsg(/rate limit/i.test(error.message) ? 'Too many sign-in emails were requested. Wait a few minutes and try again.' : `Could not send the link: ${error.message}`, true); return; }
    $('#auth-title').textContent = 'Check your email';
    $('#auth-sub').textContent = '';
    authMsg(`We've sent a sign-in link to ${email}. Open it on this device to continue. It expires in one hour.`);
    $('#auth-fields').hidden = true; go.hidden = true; $('#auth-mode').hidden = true;
    const alt = $('#auth-alt'); alt.hidden = false; alt.textContent = 'Use a different email'; alt.onclick = showSignIn;
  });
}

// ---------- set / change password (on the board) ----------
function openPw(){
  S.pwOpener = document.activeElement;
  $('#pw-form').reset(); $('#pw-username').value = S.email; $('#pw-err').hidden = true;
  $('#pw-scrim').hidden = false; $('#pw-modal').hidden = false; document.body.classList.add('locked');
  $('#pw-new').focus();
}
function closePw(){
  $('#pw-modal').hidden = true; $('#pw-scrim').hidden = true;
  if (!S.drawerOpen) document.body.classList.remove('locked');
  if (S.pwOpener && document.contains(S.pwOpener)) S.pwOpener.focus();
}
function bindPw(){
  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const a = $('#pw-new').value, b = $('#pw-confirm').value, err = $('#pw-err');
    const show = m => { err.textContent = m; err.hidden = false; };
    if (a.length < 8) return show('Use at least 8 characters.');
    if (a !== b) return show("The two passwords don't match.");
    const btn = $('#pw-save'); btn.disabled = true; btn.textContent = 'Saving…';
    const {error} = await S.sb.auth.updateUser({password: a});
    btn.disabled = false; btn.textContent = 'Save password';
    if (error) {
      if (/different from the old/i.test(error.message)) return show('That is already your password. Choose a different one.');
      if (/reauthenticat/i.test(error.message)) return show('For security, sign out, sign back in with an emailed link, then set your password straight away.');
      return show(`Could not save the password: ${error.message}`);
    }
    try { localStorage.setItem('gb-auth-mode', 'password'); } catch (_) {}
    closePw(); toast('Password saved. You can now sign in with it on any device.');
  });
}
async function startApp(session){
  S.session = session; S.email = String(session.user.email || '').toLowerCase();
  if (!S.started) { S.started = true; bindAppEvents(); bindPw(); subscribe(); }
  showScreen('app');
  if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  const t = new Date(); $('#today').textContent = `${DAYS_L[t.getDay()]} ${t.getDate()} ${MONTHS_L[t.getMonth()]} ${t.getFullYear()}`;
  renderSummary(); route();
  await loadAll();
}

async function init(){
  const cfg = window.GB_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl || /YOUR-PROJECT/.test(cfg.supabaseUrl) || !cfg.supabaseAnonKey || /YOUR-ANON/.test(cfg.supabaseAnonKey)) { showScreen('setup'); return; }
  S.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  bindAuth();
  S.sb.auth.onAuthStateChange((event, session) => {
    if (session && !S.session) startApp(session);
    if (event === 'SIGNED_OUT') { S.session = null; showSignIn(); }
  });
  const {data} = await S.sb.auth.getSession();
  if (data.session) { if (!S.session) startApp(data.session); }
  else showSignIn();
}
init();
})();
