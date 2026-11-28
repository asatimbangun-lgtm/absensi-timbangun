/* =========================================
   ABSENSI TIM BANGUN 3.0 — script.js
   ========================================= */

/* ---------- KONFIG ---------- */
const API_URL = 'https://script.google.com/macros/s/AKfycbyiopiu30K0YvWCoYBwYyb7RuK3F27Tczg9LmWwv9pJu2Q2naywG3t2XCqsM9P7tOMP/exec';
const STANDARD_MINUTES = 480; // 8 jam kerja
const GEO_TIMEOUT_MS = 20000;

/* ---------- STATE ---------- */
const state = {
  token: localStorage.getItem('att_token') || '',
  user: safeJson(localStorage.getItem('att_user')),
  branches: [],
  selectedBranchId: '',
  attendance: [],
  todayRecord: null,
  clockTimer: null,
  stream: null,
  mode: null,
  photoB64: null,
  geo: null,
  reasonRequired: false
};

/* ---------- UTILS ---------- */
function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function pad2(n) { return String(n).padStart(2, '0'); }

function extractHHMM(s) {
  if (!s) return '';
  const m = String(s).match(/(\d{1,2}):(\d{2})/);
  return m ? pad2(+m[1]) + ':' + m[2] : '';
}

function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function formatDateLong(iso) {
  if (!iso) return '—';
  const p = String(iso).split('-');
  if (p.length !== 3) return iso;
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso) {
  if (!iso) return { day: '—', month: '—' };
  const p = String(iso).split('-');
  if (p.length !== 3) return { day: '—', month: '—' };
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return { day: pad2(d.getDate()), month: d.toLocaleDateString('id-ID', { month: 'short' }) };
}

function formatMinutes(min) {
  if (!min || min < 1) return '0m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return m + 'm';
  if (m === 0) return h + 'j';
  return h + 'j ' + m + 'm';
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toast(msg, kind) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

/* ---------- API ---------- */
async function callApi(action, payload) {
  const body = { action, payload: payload || {} };
  if (state.token) body.token = state.token;

  let res, lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        cache: 'no-store'
      });
      break;
    } catch (e) {
      lastErr = e;
      const m = String((e && e.message) || e);
      if (!/CONNECTION_CLOSED|Failed to fetch|NetworkError|Load failed/i.test(m)) throw e;
      if (i < 2) await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  if (!res) throw lastErr || new Error('Tidak dapat menghubungi server.');

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('Respons server tidak valid.'); }

  if (json && json.ok === false) throw new Error(errMsg(json) || 'Gagal');
  if (json && json.success === false) throw new Error(errMsg(json) || 'Gagal');
  if (json && json.error) throw new Error(errMsg(json) || 'Gagal');
  if (json && json.code && String(json.code).toUpperCase() !== 'OK' && json.message) throw new Error(json.message);

  if (json && json.ok === true && 'data' in json) return json.data;
  if (json && json.success === true && 'data' in json) return json.data;
  if (json && json.data && typeof json.data === 'object' && !Array.isArray(json.data) && !('items' in json)) return json.data;
  return json;
}

function errMsg(j) {
  if (!j) return '';
  if (j.error && typeof j.error === 'object') return j.error.message || j.error.msg || '';
  if (typeof j.error === 'string') return j.error;
  return j.message || '';
}

/* ---------- AUTH ---------- */
function saveAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('att_token', token);
  localStorage.setItem('att_user', JSON.stringify(user));
}

function clearAuth() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('att_token');
  localStorage.removeItem('att_user');
}

function roleLabel(r) {
  switch ((r || '').toUpperCase()) {
    case 'SUPERADMIN': return 'Super Admin';
    case 'ADMIN': return 'Admin';
    case 'CEO': return 'CEO';
    case 'EMPLOYEE': return 'Karyawan';
    default: return r || '—';
  }
}

async function doLogin(username, password) {
  const res = await callApi('login', { username, password });
  const user = (res && (res.user || res)) || {};
  const token = (res && res.token) || user.token;
  if (!token) throw new Error('Login gagal: token tidak diterima.');
  saveAuth(token, {
    employeeId: user.employeeId || res.employeeId || '',
    employeeName: user.employeeName || res.employeeName || username,
    systemRole: user.systemRole || res.systemRole || 'EMPLOYEE',
    mustChangePassword: user.mustChangePassword === true || res.mustChangePassword === true
  });
  return state.user;
}

/* ---------- DATA LOADERS ---------- */
async function loadBranches() {
  let listAssign = [], listMaster = [];
  try {
    const [a, b] = await Promise.all([
      callApi('listEmployeeBranches', {}),
      callApi('listBranches', { status: 'ACTIVE' })
    ]);
    listAssign = Array.isArray(a) ? a : (a?.items || []);
    listMaster = Array.isArray(b) ? b : (b?.items || []);
  } catch (e) {
    console.warn('loadBranches fallback:', e.message);
    const onlyA = await callApi('listEmployeeBranches', {}).catch(() => []);
    const onlyB = await callApi('listBranches', {}).catch(() => ({ items: [] }));
    listAssign = Array.isArray(onlyA) ? onlyA : (onlyA?.items || []);
    listMaster = Array.isArray(onlyB) ? onlyB : (onlyB?.items || []);
  }
  const map = {};
  listMaster.forEach(m => { map[m.branchId] = m; });
  state.branches = listAssign.map(a => {
    const m = map[a.branchId] || {};
    return {
      id: a.id,
      branchId: a.branchId,
      branchName: a.branchName || m.branchName || '—',
      isPrimary: !!a.isPrimary,
      latitude: Number(m.latitude ?? 0),
      longitude: Number(m.longitude ?? 0),
      radiusMeters: Number(m.radiusMeters ?? 100),
      address: m.address || ''
    };
  });
  const primary = state.branches.find(b => b.isPrimary) || state.branches[0];
  state.selectedBranchId = primary ? primary.branchId : '';
}

async function loadAttendance() {
  let res;
  try { res = await callApi('listMyAttendance', { page: 1, pageSize: 60 }); }
  catch { res = await callApi('listMyAttendance', {}); }
  const items = Array.isArray(res) ? res : ((res && res.items) || []);
  state.attendance = items;
  const today = todayIso();
  state.todayRecord = items.find(x => String(x.attendanceDate) === today) || null;
}

/* ---------- RENDER ---------- */
function renderHeader() {
  const u = state.user || {};
  document.getElementById('user-name').textContent = u.employeeName || '—';
  document.getElementById('user-role').textContent = roleLabel(u.systemRole);
  document.getElementById('pw-notice').hidden = !u.mustChangePassword;
  document.getElementById('date-text').textContent = formatDateLong(todayIso());
}

function startClock() {
  if (state.clockTimer) clearInterval(state.clockTimer);
  const tick = () => {
    const d = new Date();
    document.getElementById('clock-text').textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  tick();
  state.clockTimer = setInterval(tick, 15000);
}

function renderBranches() {
  const cont = document.getElementById('branch-list');
  const count = document.getElementById('branch-count');
  if (!state.branches.length) {
    cont.innerHTML = '<div class="empty-note" style="min-width:100%">Belum ada lokasi ditugaskan.</div>';
    count.textContent = '0 lokasi';
    return;
  }
  count.textContent = state.branches.length + ' lokasi';
  cont.innerHTML = state.branches.map(b => {
    const sel = b.branchId === state.selectedBranchId ? ' selected' : '';
    const prim = b.isPrimary ? '<span class="primary-badge">Utama</span>' : '';
    return `<button class="branch-card${sel}" data-branch="${esc(b.branchId)}">
      <span class="emoji">📍</span>
      <div class="info">
        <div class="name">${esc(b.branchName)}</div>
        <div class="meta">${prim}<span>Radius ${b.radiusMeters}m</span></div>
      </div>
    </button>`;
  }).join('');
  cont.querySelectorAll('[data-branch]').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedBranchId = el.getAttribute('data-branch');
      renderBranches();
    });
  });
}

function renderCheckStatus() {
  const tr = state.todayRecord;
  const cin = tr ? extractHHMM(tr.checkInTime) : '';
  const cout = tr ? extractHHMM(tr.checkOutTime) : '';
  document.getElementById('checkin-display').textContent = cin || '--:--';
  document.getElementById('checkout-display').textContent = cout || '--:--';

  const btn = document.getElementById('btn-attend');
  const label = document.getElementById('attend-label');

  if (!state.branches.length) {
    btn.disabled = true;
    label.textContent = 'Belum ada lokasi';
    btn.dataset.mode = '';
    return;
  }
  if (!cin) {
    btn.disabled = false;
    label.textContent = 'Absen Masuk';
    btn.dataset.mode = 'checkIn';
  } else if (!cout) {
    btn.disabled = false;
    label.textContent = 'Absen Pulang';
    btn.dataset.mode = 'checkOut';
  } else {
    btn.disabled = true;
    label.textContent = 'Absensi Hari Ini Selesai';
    btn.dataset.mode = '';
  }
}

function renderStats() {
  const month = todayIso().slice(0, 7);
  const items = state.attendance.filter(x => String(x.attendanceDate || '').slice(0, 7) === month);
  const totalMasuk = items.filter(x => x.checkInTime).length;
  const totalLembur = items.reduce((a, x) => a + (Number(x.overtimeMinutes) || 0), 0);
  const totalTelat = items.reduce((a, x) => a + (Number(x.lateMinutes) || 0), 0);
  const totalIzin = items.filter(x => {
    const s = String(x.attendanceStatus || '').toUpperCase();
    return /IZIN|CUTI|SAKIT|LEAVE|PERMISSION|SICK/i.test(s);
  }).length;

  document.getElementById('stat-masuk').textContent = totalMasuk;
  document.getElementById('stat-lembur').textContent = formatMinutes(totalLembur);
  document.getElementById('stat-telat').textContent = formatMinutes(totalTelat);
  document.getElementById('stat-izin').textContent = totalIzin;
}

function statusBadges(rec) {
  const s = String(rec.attendanceStatus || '').toUpperCase();
  const out = [];
  if (s.includes('LATE_AND_EARLY_LEAVE')) out.push('<span class="badge b-warn">Telat · Plg Cepat</span>');
  else {
    if (s.includes('LATE')) out.push('<span class="badge b-warn">Terlambat</span>');
    if (s.includes('EARLY_LEAVE')) out.push('<span class="badge b-warn">Pulang Cepat</span>');
  }
  if (s.includes('PRESENT') || (!s.includes('LATE') && !s.includes('EARLY') && rec.checkInTime && rec.checkOutTime)) {
    out.push('<span class="badge b-ok">Hadir</span>');
  }
  if (s.includes('ABSENT') || s === 'ALFA') out.push('<span class="badge b-danger">Absen</span>');
  if (/IZIN|LEAVE|PERMISSION/.test(s)) out.push('<span class="badge b-info">Izin</span>');
  if (/SAKIT|SICK/.test(s)) out.push('<span class="badge b-info">Sakit</span>');
  if (rec.reviewStatus && String(rec.reviewStatus).toUpperCase() === 'PENDING') out.push('<span class="badge b-muted">Review</span>');
  if (rec.reviewStatus && String(rec.reviewStatus).toUpperCase() === 'REJECTED') out.push('<span class="badge b-danger">Ditolak</span>');
  if (!out.length) out.push('<span class="badge b-muted">—</span>');
  return out.slice(0, 2).join('');
}

function renderHistory() {
  const cont = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');

  if (!state.attendance.length) {
    cont.innerHTML = '<div class="empty-note">Belum ada riwayat absensi.</div>';
    countEl.textContent = '';
    return;
  }
  const month = todayIso().slice(0, 7);
  const items = state.attendance
    .filter(x => String(x.attendanceDate || '').slice(0, 7) === month)
    .sort((a, b) => String(b.attendanceDate).localeCompare(String(a.attendanceDate)))
    .slice(0, 8);
  countEl.textContent = items.length + ' hari';

  cont.innerHTML = items.map(rec => {
    const dt = formatDateShort(rec.attendanceDate);
    const cin = extractHHMM(rec.checkInTime) || '--:--';
    const cout = extractHHMM(rec.checkOutTime) || '--:--';
    return `<button class="attendance-item" data-att="${esc(rec.attendanceId)}">
      <div class="date-block">
        <div class="day">${dt.day}</div>
        <div class="month">${esc(dt.month)}</div>
      </div>
      <div class="times">
        <span>Masuk <strong>${cin}</strong></span>
        <span>Pulang <strong>${cout}</strong></span>
      </div>
      <div class="badges">${statusBadges(rec)}</div>
    </button>`;
  }).join('');

  cont.querySelectorAll('[data-att]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-att');
      const rec = state.attendance.find(x => x.attendanceId === id);
      if (rec) showDetail(rec);
    });
  });
}

/* ---------- DETAIL MODAL ---------- */
async function showDetail(rec) {
  const title = document.getElementById('detail-title');
  const content = document.getElementById('detail-content');

  title.textContent = 'Absensi ' + (rec.attendanceDate ? formatDateLong(rec.attendanceDate) : '');
  const cin = extractHHMM(rec.checkInTime) || '--:--';
  const cout = extractHHMM(rec.checkOutTime) || '--:--';
  const inBranch = rec.checkInBranchName || '—';
  const outBranch = rec.checkOutBranchName || '—';
  const inDist = rec.checkInDistanceMeters != null ? Number(rec.checkInDistanceMeters).toFixed(0) + ' m' : '—';
  const outDist = rec.checkOutDistanceMeters != null ? Number(rec.checkOutDistanceMeters).toFixed(0) + ' m' : '—';

  content.innerHTML = `
    <div class="detail-times">
      <div class="detail-time-card"><div class="l">Masuk</div><div class="v">${cin}</div></div>
      <div class="detail-time-card"><div class="l">Pulang</div><div class="v">${cout}</div></div>
    </div>
    <div class="detail-photos">
      <div class="photo-box" id="photo-in"><span class="photo-label">Foto Masuk</span><span>Memuat…</span></div>
      <div class="photo-box" id="photo-out"><span class="photo-label">Foto Pulang</span><span>Memuat…</span></div>
    </div>
    <div class="detail-meta">
      <div class="row"><span>Lokasi masuk</span><b>${esc(inBranch)}${rec.checkInDistanceMeters != null ? ' · ' + inDist : ''}</b></div>
      <div class="row"><span>Lokasi pulang</span><b>${esc(outBranch)}${rec.checkOutDistanceMeters != null ? ' · ' + outDist : ''}</b></div>
      <div class="row"><span>Telat</span><b>${formatMinutes(Number(rec.lateMinutes) || 0)}</b></div>
      <div class="row"><span>Pulang cepat</span><b>${formatMinutes(Number(rec.earlyLeaveMinutes) || 0)}</b></div>
      <div class="row"><span>Lembur</span><b>${formatMinutes(Number(rec.overtimeMinutes) || 0)}</b></div>
      <div class="row"><span>Status</span><b>${esc(String(rec.attendanceStatus || '—'))}</b></div>
      ${rec.checkInReason ? `<div class="row"><span>Alasan masuk</span><b>${esc(rec.checkInReason)}</b></div>` : ''}
      ${rec.checkOutReason ? `<div class="row"><span>Alasan pulang</span><b>${esc(rec.checkOutReason)}</b></div>` : ''}
      ${rec.reviewStatus ? `<div class="row"><span>Review</span><b>${esc(rec.reviewStatus)}</b></div>` : ''}
    </div>
  `;

  openModal('modal-detail');

  loadPhotoInto('photo-in', rec.checkInPhotoFileId);
  loadPhotoInto('photo-out', rec.checkOutPhotoFileId);
}

async function loadPhotoInto(boxId, fileId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const labelHtml = box.querySelector('.photo-label').outerHTML;
  if (!fileId) {
    box.innerHTML = labelHtml + '<span>Tidak ada foto</span>';
    return;
  }
  try {
    const blobUrl = await fetchPhoto(fileId);
    box.innerHTML = labelHtml + `<img src="${blobUrl}" alt="">`;
  } catch (e) {
    console.warn('fetchPhoto gagal:', e);
    box.innerHTML = labelHtml + '<span>Gagal muat foto</span>';
  }
}

async function fetchPhoto(fileId) {
  const body = { action: 'getPhoto', token: state.token, payload: { fileId: fileId } };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('Foto tidak dapat diambil');
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (ct.includes('application/json')) {
    const j = await res.json();
    const b64 = j?.data?.base64 || j?.base64 || j?.data;
    if (typeof b64 === 'string') {
      return 'data:' + (j?.mimeType || 'image/jpeg') + ';base64,' + b64;
    }
    throw new Error('Format foto tidak dikenal');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/* ---------- CAMERA ---------- */
async function openCamera(mode) {
  state.mode = mode;
  state.photoB64 = null;
  state.geo = null;
  state.reasonRequired = false;

  document.getElementById('camera-title').textContent = mode === 'checkIn' ? 'Absen Masuk' : 'Absen Pulang';
  document.getElementById('cam-preview').hidden = true;
  document.getElementById('cam-video').hidden = false;
  document.getElementById('cam-actions-capture').hidden = false;
  document.getElementById('cam-actions-submit').hidden = true;
  document.getElementById('btn-capture').disabled = true;
  document.getElementById('cam-error').hidden = true;
  document.getElementById('reason-input').value = '';
  document.getElementById('reason-field').hidden = true;

  openModal('modal-camera');

  if (mode === 'checkIn') {
    const now = new Date();
    const isLate = (now.getHours() * 60 + now.getMinutes()) > (8 * 60 + 15);
    if (isLate) state.reasonRequired = true;
  } else if (mode === 'checkOut') {
    const tr = state.todayRecord;
    if (tr) {
      const cinH = extractHHMM(tr.checkInTime);
      if (cinH) {
        const [h, m] = cinH.split(':').map(Number);
        const inMinutes = h * 60 + m;
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        if ((nowMin - inMinutes) < STANDARD_MINUTES) state.reasonRequired = true;
      }
    }
  }

  await startCamera();
  const branch = state.branches.find(b => b.branchId === state.selectedBranchId);
  captureGeo(branch);
}

async function startCamera() {
  const video = document.getElementById('cam-video');
  const err = document.getElementById('cam-error');
  const msg = document.getElementById('cam-error-msg');

  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    state.stream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});
    document.getElementById('btn-capture').disabled = false;
    err.hidden = true;
  } catch (e) {
    err.hidden = false;
    msg.textContent = String(e.message || e);
    document.getElementById('btn-capture').disabled = true;
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
}

function capturePhoto() {
  const video = document.getElementById('cam-video');
  const preview = document.getElementById('cam-preview');
  const canvas = document.createElement('canvas');
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 960;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  state.photoB64 = dataUrl.split(',')[1];

  preview.src = dataUrl;
  preview.hidden = false;
  video.hidden = true;

  document.getElementById('cam-actions-capture').hidden = true;
  document.getElementById('cam-actions-submit').hidden = false;
  document.getElementById('reason-field').hidden = !state.reasonRequired;
  if (state.reasonRequired) {
    document.getElementById('reason-input').focus();
  }
}

async function retakePhoto() {
  state.photoB64 = null;
  document.getElementById('cam-preview').hidden = true;
  document.getElementById('cam-video').hidden = false;
  document.getElementById('cam-actions-capture').hidden = false;
  document.getElementById('cam-actions-submit').hidden = true;
  document.getElementById('reason-field').hidden = true;
  await startCamera();
}

function captureGeo(branch) {
  const box = document.getElementById('gps-status');
  const text = document.getElementById('gps-text');
  box.className = 'gps-status';
  text.textContent = 'Mengambil lokasi…';

  if (!navigator.geolocation) {
    box.classList.add('err');
    text.textContent = 'GPS tidak didukung browser';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      state.geo = { lat: latitude, lng: longitude, accuracy };
      let extra = '';
      if (branch) {
        const d = haversine(latitude, longitude, branch.latitude, branch.longitude);
        const inRadius = d <= branch.radiusMeters;
        extra = ` · ${d.toFixed(0)}m ${inRadius ? 'dari' : 'di luar'} radius`;
        if (!inRadius) state.reasonRequired = true;
      }
      box.classList.add('ok');
      text.innerHTML = `<b>${latitude.toFixed(6)}, ${longitude.toFixed(6)}</b> ±${accuracy.toFixed(0)}m${esc(extra)}`;
    },
    (err) => {
      box.classList.add('err');
      const msg = (err.code === 1) ? 'Izin lokasi ditolak' :
                  (err.code === 2) ? 'Lokasi tidak tersedia' :
                  (err.code === 3) ? 'Timeout mengambil lokasi' : 'Gagal mengambil lokasi';
      text.textContent = msg;
    },
    { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 0 }
  );
}

/* ---------- SUBMIT ---------- */
async function submitAttendance() {
  const btn = document.getElementById('btn-submit');
  const reason = document.getElementById('reason-input').value.trim();

  if (!state.photoB64) { toast('Ambil foto dulu', 'err'); return; }
  if (!state.geo) { toast('Lokasi belum tersedia, tunggu sebentar', 'err'); return; }
  if (!state.selectedBranchId) { toast('Pilih lokasi proyek dulu', 'err'); return; }
  if (state.reasonRequired && !reason) { toast('Alasan wajib diisi', 'err'); return; }

  btn.disabled = true;
  const origText = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> Mengirim…';

  try {
    const payload = {
      branchId: state.selectedBranchId,
      latitude: state.geo.lat,
      longitude: state.geo.lng,
      photoBase64: state.photoB64
    };
    if (reason) payload.reason = reason;

    if (state.mode === 'checkIn') {
      await callApi('checkIn', payload);
      toast('Absen masuk berhasil', 'ok');
    } else {
      await callApi('checkOut', payload);
      toast('Absen pulang berhasil', 'ok');
    }

    closeModal('modal-camera');
    stopCamera();
    await refreshData();
  } catch (e) {
    console.error('submit error:', e);
    toast(e.message || 'Gagal kirim absen', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

/* ---------- REFRESH ---------- */
async function refreshData() {
  try {
    await Promise.all([loadBranches(), loadAttendance()]);
    renderBranches();
    renderCheckStatus();
    renderStats();
    renderHistory();
  } catch (e) {
    console.error('refresh error:', e);
    toast('Gagal memuat data: ' + e.message, 'err');
  }
}

/* ---------- ENTER HOME ---------- */
async function enterHome() {
  renderHeader();
  startClock();
  showScreen('screen-home');
  document.getElementById('history-list').innerHTML =
    '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  await refreshData();
}

/* ---------- EVENTS ---------- */
function bindEvents() {
  document.getElementById('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = document.getElementById('login-btn');
    const errBox = document.getElementById('login-error');
    errBox.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Memproses…';
    try {
      await doLogin(
        document.getElementById('login-username').value.trim(),
        document.getElementById('login-password').value
      );
      await enterHome();
    } catch (e) {
      errBox.hidden = false;
      errBox.textContent = e.message || 'Login gagal';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    if (!confirm('Keluar dari akun?')) return;
    clearAuth();
    showScreen('screen-login');
    document.getElementById('login-password').value = '';
    if (state.clockTimer) clearInterval(state.clockTimer);
  });

  document.getElementById('btn-attend').addEventListener('click', () => {
    const mode = document.getElementById('btn-attend').dataset.mode;
    if (!mode) return;
    openCamera(mode);
  });

  document.getElementById('btn-capture').addEventListener('click', capturePhoto);
  document.getElementById('btn-retake').addEventListener('click', retakePhoto);
  document.getElementById('btn-submit').addEventListener('click', submitAttendance);

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-close');
      if (id === 'modal-camera') stopCamera();
      closeModal(id);
    });
  });

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (ev) => {
      if (ev.target === m) {
        if (m.id === 'modal-camera') stopCamera();
        closeModal(m.id);
      }
    });
  });
}

/* ---------- INIT ---------- */
async function init() {
  bindEvents();
  if (state.token && state.user) {
    try {
      await enterHome();
    } catch (e) {
      console.warn('Auto-login gagal:', e.message);
      clearAuth();
      showScreen('screen-login');
    }
  } else {
    showScreen('screen-login');
  }
}

document.addEventListener('DOMContentLoaded', init);
