// ============ CONFIG ============
const CONFIG = {
  API_URL: 'PASTE_URL_ANDA_DISINI',
  STORAGE_TOKEN: 'tb_token',
  STORAGE_USER: 'tb_user',
};
CONFIG.DEMO = !CONFIG.API_URL || CONFIG.API_URL.indexOf('PASTE') === 0;

const $ = (id) => document.getElementById(id);
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ============ SESSION ============
const Session = {
  get() { try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_USER)); } catch { return null; } },
  set(token, user) {
    localStorage.setItem(CONFIG.STORAGE_TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_USER, JSON.stringify(user));
  },
  clear() { localStorage.removeItem(CONFIG.STORAGE_TOKEN); localStorage.removeItem(CONFIG.STORAGE_USER); },
  token() { return localStorage.getItem(CONFIG.STORAGE_TOKEN) || ''; },
};

// ============ API ============
async function api(action, payload = {}) {
  if (CONFIG.DEMO) return demoApi(action, payload);
  const body = { action, payload };
  const token = Session.token();
  if (token) body.token = token;
  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
  } catch (e) {
    const err = new Error('Tidak bisa menghubungi server. Cek koneksi.');
    err.code = 'NETWORK';
    throw err;
  }
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status);
    err.code = 'HTTP';
    throw err;
  }
  let data;
  try { data = await res.json(); }
  catch { throw Object.assign(new Error('Respon tidak valid'), { code: 'PARSE' }); }
  if (!data.ok) {
    const err = new Error((data.error && data.error.message) || 'Terjadi kesalahan');
    err.code = (data.error && data.error.code) || 'ERROR';
    throw err;
  }
  return data.data;
}

function demoApi(action, p) {
  return new Promise((resolve, reject) => setTimeout(() => {
    if (action === 'login') {
      const map = {
        superadmin: { name: 'Asat Bangun', role: 'SUPERADMIN' },
        ceo: { name: 'Direktur Utama', role: 'CEO' },
        demo: { name: 'Budi Santoso', role: 'EMPLOYEE' },
      };
      const u = map[p.username];
      if (u && (p.password === 'demo12345')) {
        resolve({ token: 'DEMO_' + Date.now(), employeeId: 'EMP_' + p.username, employeeName: u.name, systemRole: u.role, mustChangePassword: false });
      } else reject(new Error('Username atau password salah'));
    } else if (action === 'getLeaveBalance') {
      resolve({ year: new Date().getFullYear(), annualQuotaDays: 12, usedDays: 4, remainingDays: 8, exists: true });
    } else if (action === 'getDashboardSummary') {
      resolve({
        date: new Date().toISOString().slice(0, 10), scope: 'ALL',
        totalActiveUsers: 47, expectedToday: 45, presentToday: 38, lateToday: 3,
        checkedOutToday: 12, notYetCheckIn: 7, pendingLeaves: 2, pendingPermissions: 3,
        recentActivity: [
          { employeeName: 'Budi Santoso', type: 'CHECK_IN', at: '08:02', note: 'Proyek Cibubur' },
          { employeeName: 'Ahmad Hidayat', type: 'CHECK_IN', at: '08:05', note: 'Proyek Bekasi' },
          { employeeName: 'Siti Rahayu', type: 'LEAVE', at: '07:58', note: 'Izin sakit' },
        ],
      });
    } else if (action === 'listHolidays') {
      resolve({ items: [
        { date: '2026-01-01', name: 'Tahun Baru', createdByName: 'Admin' },
        { date: '2026-12-25', name: 'Natal', createdByName: 'Admin' },
      ]});
    } else if (action === 'listEmployeePositions') {
      resolve({ items: [
        { positionCode: 'MGR', positionName: 'Manajer', isOperational: false },
        { positionCode: 'SPR', positionName: 'Supir', isOperational: true },
      ]});
    } else if (action === 'listUsers') {
      resolve({ items: [
        { employeeName: 'Budi Santoso', username: 'budi', systemRole: 'EMPLOYEE', accountStatus: 'ACTIVE' },
        { employeeName: 'Asat Bangun', username: 'superadmin', systemRole: 'SUPERADMIN', accountStatus: 'ACTIVE' },
      ]});
    } else {
      resolve({});
    }
  }, 500));
}

// ============ BANNER ============
const Banner = {
  idx: 0, total: 3, timer: null,
  init() {
    const dots = $('banner-dots');
    if (!dots) return;
    for (let i = 0; i < this.total; i++) {
      const d = document.createElement('i');
      if (i === 0) d.className = 'on';
      dots.appendChild(d);
    }
    this.start();
    const track = $('banner-track');
    if (!track) return;
    let x0 = null;
    track.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; this.stop(); }, { passive: true });
    track.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (dx < -40) this.go(this.idx + 1);
      else if (dx > 40) this.go(this.idx - 1);
      else this.start();
      x0 = null;
    });
  },
  start() { this.stop(); this.timer = setInterval(() => this.go(this.idx + 1), 4000); },
  stop() { if (this.timer) clearInterval(this.timer); },
  go(i) {
    this.idx = ((i % this.total) + this.total) % this.total;
    const tr = $('banner-track');
    const dt = $('banner-dots');
    if (tr) tr.style.transform = 'translateX(-' + (this.idx * 100) + '%)';
    if (dt) dt.querySelectorAll('i').forEach((d, n) => d.classList.toggle('on', n === this.idx));
  },
};

// ============ CLOCK ============
function tickClock() {
  const d = new Date(), p = n => (n < 10 ? '0' : '') + n;
  const el = $('clock');
  if (el) el.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

// ============ TABBAR PER ROLE ============
const ROLE_TABS = {
  EMPLOYEE:   ['home','rekap','ajukan','profil'],
  CEO:        ['home','monitoring','profil'],
  ADMIN:      ['home','monitoring','kelola','profil'],
  SUPERADMIN: ['home','monitoring','kelola','profil'],
};
const TAB_META = {
  home:       { label: 'Beranda', icon: '<path d="M3 12l9-9 9 9M5 10v10h14V10"/>' },
  monitoring: { label: 'Monitoring', icon: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>' },
  kelola:     { label: 'Kelola', icon: '<path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z"/>' },
  rekap:      { label: 'Rekap', icon: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>' },
  ajukan:     { label: 'Ajukan', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>' },
  profil:     { label: 'Profil', icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>' },
};

function renderTabbar(role) {
  const tabs = ROLE_TABS[role] || ROLE_TABS.EMPLOYEE;
  const bar = $('tabbar');
  bar.innerHTML = '';
  tabs.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.dataset.t = t;
    if (i === 0) btn.className = 'on';
    btn.innerHTML = '<svg viewBox="0 0 24 24">' + TAB_META[t].icon + '</svg><span>' + TAB_META[t].label + '</span>';
    bar.appendChild(btn);
  });
  bar.onclick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    bar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    $('tab-' + btn.dataset.t).classList.add('on');
  };
}

// ============ LOGIN ============
function initLogin() {
  $('btn-eye').onclick = () => {
    const p = $('in-pass');
    p.type = p.type === 'password' ? 'text' : 'password';
  };
  $('btn-login').onclick = doLogin;
  $('in-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

async function doLogin() {
  const username = $('in-user').value.trim();
  const password = $('in-pass').value;
  const err = $('login-err');
  err.classList.add('hidden'); err.textContent = '';
  if (!username || !password) {
    err.textContent = 'Username dan password wajib diisi.';
    err.classList.remove('hidden'); return;
  }
  const btn = $('btn-login');
  btn.disabled = true; btn.textContent = 'Memverifikasi...';
  try {
    const data = await api('login', { username, password });
    Session.set(data.token, {
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      systemRole: data.systemRole,
    });
    enterApp();
  } catch (e) {
    err.textContent = e.message + '. Periksa kembali, atau hubungi HR.';
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

function initLogout() {
  $('btn-logout').onclick = async () => {
    try { await api('logout'); } catch {}
    Session.clear();
    $('view-app').classList.remove('on');
    $('view-login').classList.add('on');
    $('in-pass').value = '';
  };
}

// ============ APP ENTRY ============
async function enterApp() {
  const u = Session.get();
  if (!u) return;
  $('view-login').classList.remove('on');
  $('view-app').classList.add('on');
  $('greet').textContent = 'Hallo, ' + u.employeeName.split(' ')[0];
  $('today').textContent = DAYS[new Date().getDay()] + ', ' + new Date().getDate() + ' ' + MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear();
  $('role-badge').textContent = u.systemRole;
  $('p-name').textContent = u.employeeName;
  $('p-role').textContent = u.systemRole;
  $('p-id').textContent = u.employeeId;
  $('avatar').textContent = u.employeeName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  renderTabbar(u.systemRole);

  const isManager = ['SUPERADMIN','ADMIN','CEO'].includes(u.systemRole);
  $('home-employee').classList.toggle('hidden', isManager);
  $('home-manager').classList.toggle('hidden', !isManager);

  if (isManager) {
    loadDashboard('mgr-stats', 'mgr-activity');
    if (u.systemRole !== 'CEO') loadDashboard('mon-stats', 'mon-activity');
    else loadDashboard('mon-stats', 'mon-activity');
  } else {
    Banner.init();
    loadLeaveBalance();
    restoreAttendanceState();
  }
}

// ============ EMPLOYEE: LEAVE BALANCE ============
async function loadLeaveBalance() {
  try {
    const b = await api('getLeaveBalance', {});
    $('cuti-sisa').textContent = b.remainingDays;
    $('cuti-kuota').textContent = b.annualQuotaDays;
  } catch {}
}

// ============ MANAGER: DASHBOARD ============
async function loadDashboard(statsId, activityId) {
  try {
    const d = await api('getDashboardSummary', {});
    const el = $(statsId);
    if (el) {
      el.innerHTML = `
        <div class="stat s-blue"><strong>${safe(d.totalActiveUsers)}</strong><span>Total Aktif</span></div>
        <div class="stat s-green"><strong>${safe(d.presentToday)}</strong><span>Sudah Masuk</span></div>
        <div class="stat s-blue"><strong>${safe(d.checkedOutToday)}</strong><span>Sudah Pulang</span></div>
        <div class="stat s-amber"><strong>${safe(d.lateToday)}</strong><span>Terlambat</span></div>
        <div class="stat s-red"><strong>${safe(d.notYetCheckIn)}</strong><span>Belum Absen</span></div>
        <div class="stat s-amber"><strong>${safe((d.pendingLeaves||0)+(d.pendingPermissions||0))}</strong><span>Pending</span></div>
      `;
    }
    const act = $(activityId);
    if (act) {
      act.innerHTML = renderActivity(d.recentActivity);
    }
    const md = $('mon-date');
    if (md) md.textContent = d.date ? formatDate(d.date) : '—';
  } catch (e) {
    const el = $(statsId);
    if (el) el.innerHTML = '<div class="stat s-red" style="grid-column:1/-1"><strong>!</strong><span>' + (e.message || 'Gagal memuat') + '</span></div>';
    const act = $(activityId);
    if (act) act.innerHTML = '<p class="list-empty">Gagal memuat data: ' + (e.message || 'error') + '</p>';
  }
}

function renderActivity(list) {
  if (!Array.isArray(list) || !list.length) {
    return '<p class="list-empty">Belum ada aktivitas hari ini.</p>';
  }
  return list.map(it => {
    const name = it.employeeName || it.name || '—';
    const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const type = it.type || '';
    const badge = mapBadge(type);
    return `<div class="act-row">
      <div class="act-av">${escapeHtml(initials)}</div>
      <div class="act-info">
        <b>${escapeHtml(name)}</b>
        <small>${escapeHtml(it.note||type||'Aktivitas')}</small>
      </div>
      <span class="badge badge-${badge.col}">${badge.label}</span>
      <span class="act-time">${escapeHtml(it.at||'')}</span>
    </div>`;
  }).join('');
}

function mapBadge(type) {
  const T = String(type).toUpperCase();
  if (T.includes('IN') || T.includes('CHECK_IN')) return { col: 'green', label: 'Masuk' };
  if (T.includes('OUT') || T.includes('CHECK_OUT')) return { label: 'Pulang', col: 'blue' };
  if (T.includes('LEAVE') || T.includes('CUTI')) return { col: 'amber', label: 'Izin' };
  if (T.includes('LATE')) return { col: 'amber', label: 'Telat' };
  return { col: 'gray', label: 'Aktivitas' };
}

// ============ KELOLA ============
const KELOLA_TITLES = { users: 'Akun Karyawan', positions: 'Jabatan', holidays: 'Hari Libur' };

document.addEventListener('click', e => {
  const row = e.target.closest('#kelola-menu .menu-row');
  if (row) openKelola(row.dataset.sub);
});

async function openKelola(sub) {
  $('kelola-menu').classList.add('hidden');
  $('kelola-sub').classList.remove('hidden');
  $('kelola-title').textContent = KELOLA_TITLES[sub] || sub;
  const box = $('kelola-list');
  box.innerHTML = '<p class="list-empty">Memuat...</p>';
  try {
    let items = [];
    if (sub === 'users') items = (await api('listUsers', {})).items || [];
    else if (sub === 'positions') items = (await api('listEmployeePositions', {})).items || [];
    else if (sub === 'holidays') items = (await api('listHolidays', {})).items || [];
    if (!items.length) { box.innerHTML = '<p class="list-empty">Belum ada data.</p>'; return; }
    box.innerHTML = items.map(renderKelolaRow).join('');
  } catch (e) {
    box.innerHTML = '<p class="list-empty">Gagal: ' + escapeHtml(e.message) + '</p>';
  }
}

function kelolaBack() {
  $('kelola-menu').classList.remove('hidden');
  $('kelola-sub').classList.add('hidden');
}

function renderKelolaRow(it) {
  if (it.employeeName !== undefined) {
    const ini = it.employeeName.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const badge = it.accountStatus === 'ACTIVE' ? 'green' : 'gray';
    return `<div class="act-row">
      <div class="act-av">${escapeHtml(ini)}</div>
      <div class="act-info"><b>${escapeHtml(it.employeeName)}</b><small>${escapeHtml(it.username)} · ${escapeHtml(it.systemRole||'—')}</small></div>
      <span class="badge badge-${badge}">${escapeHtml(it.accountStatus||'—')}</span>
    </div>`;
  }
  if (it.positionName !== undefined) {
    return `<div class="act-row">
      <div class="act-av">${escapeHtml((it.positionCode||'?').slice(0,2).toUpperCase())}</div>
      <div class="act-info"><b>${escapeHtml(it.positionName)}</b><small>${escapeHtml(it.positionCode||'')}</small></div>
      <span class="badge badge-${it.isOperational?'blue':'gray'}">${it.isOperational?'Operasional':'Staff'}</span>
    </div>`;
  }
  if (it.date !== undefined && it.name !== undefined) {
    return `<div class="act-row">
      <div class="act-av">${escapeHtml(it.date.slice(8,10)||'')}</div>
      <div class="act-info"><b>${escapeHtml(it.name)}</b><small>${escapeHtml(it.date)}</small></div>
    </div>`;
  }
  return '';
}

// ============ SEG PENGAJUAN ============
document.addEventListener('click', e => {
  const btn = e.target.closest('#seg button');
  if (!btn) return;
  $('seg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
  const isCuti = btn.dataset.t === 'cuti';
  $('f-type').classList.toggle('hidden', isCuti);
  $('f-lampiran').classList.toggle('hidden', isCuti);
});

// ============ CAMERA + GPS + CHECKIN ============
const todayKey = 'attendance_' + new Date().toISOString().slice(0,10);
const Cam = {
  stream: null, blob: null, gps: null, submitting: false, mode: 'IN',
  async open(mode) {
    this.mode = mode;
    this.blob = null;
    this.gps = null;
    $('cam-title').textContent = mode === 'IN' ? 'Absen Masuk' : 'Absen Keluar';
    $('cam-status').classList.add('hidden');
    $('cam-preview').classList.add('hidden');
    $('cam-video').classList.remove('hidden');
    $('cam-retake').classList.add('hidden');
    $('cam-submit').classList.add('hidden');
    $('cam-capture').classList.remove('hidden');
    $('cam-modal').classList.add('on');
    this.setGps('Mengambil lokasi...', 'warn');
    this.getGps();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      $('cam-video').srcObject = this.stream;
    } catch (e) {
      this.setGps('Kamera tidak bisa dibuka: ' + (e.message||''), 'err');
    }
  },
  close() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    $('cam-modal').classList.remove('on');
  },
  getGps() {
    if (!navigator.geolocation) { this.setGps('GPS tidak tersedia di browser ini', 'err'); return; }
    navigator.geolocation.getCurrentPosition(
      p => {
        this.gps = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        this.setGps('Lokasi OK · akurasi ' + Math.round(p.coords.accuracy) + ' m', '');
      },
      e => this.setGps('Lokasi gagal: ' + (e.message||'izin ditolak'), 'err'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  },
  setGps(msg, cls) {
    const el = $('cam-gps');
    el.innerHTML = '<span class="dot ' + (cls||'') + '"></span>' + escapeHtml(msg);
  },
  async capture() {
    const v = $('cam-video');
    const c = $('cam-canvas');
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return;
    const max = 900;
    const scale = Math.min(1, max / Math.max(w, h));
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    this.blob = c.toDataURL('image/jpeg', 0.75);
    $('cam-preview').src = this.blob;
    $('cam-preview').classList.remove('hidden');
    $('cam-video').classList.add('hidden');
    $('cam-capture').classList.add('hidden');
    $('cam-retake').classList.remove('hidden');
    $('cam-submit').classList.remove('hidden');
  },
  retake() {
    this.blob = null;
    $('cam-preview').classList.add('hidden');
    $('cam-video').classList.remove('hidden');
    $('cam-capture').classList.remove('hidden');
    $('cam-retake').classList.add('hidden');
    $('cam-submit').classList.add('hidden');
  },
  async submit() {
    if (!this.blob || this.submitting) return;
    this.submitting = true;
    $('cam-submit').disabled = true;
    $('cam-submit').textContent = 'Mengirim...';
    $('cam-status').classList.add('hidden');
    try {
      const base64 = this.blob.split(',')[1];
      const payload = {
        photo: base64,
        latitude: this.gps ? this.gps.lat : null,
        longitude: this.gps ? this.gps.lng : null,
        type: this.mode,
      };
      const action = this.mode === 'IN' ? 'checkIn' : 'checkOut';
      const res = await api(action, payload);
      this.showStatusOk('Berhasil. ' + (res && res.message ? res.message : 'Absen tercatat.'));
      const now = new Date();
      const tstr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
      if (this.mode === 'IN') {
        localStorage.setItem(todayKey, JSON.stringify({ in: tstr, out: null }));
        $('t-in').textContent = tstr;
        $('t-in').classList.remove('empty');
        updateAbsenBtn();
      } else {
        const state = JSON.parse(localStorage.getItem(todayKey) || '{}');
        state.out = tstr;
        localStorage.setItem(todayKey, JSON.stringify(state));
        $('t-out').textContent = tstr;
        $('t-out').classList.remove('empty');
        updateAbsenBtn();
      }
      setTimeout(() => this.close(), 1400);
    } catch (e) {
      this.showStatusErr('Backend menolak (' + e.code + '): ' + e.message);
    } finally {
      this.submitting = false;
      $('cam-submit').disabled = false;
      $('cam-submit').textContent = 'Kirim Absen';
    }
  },
  showStatusOk(msg) {
    const s = $('cam-status');
    s.className = 'cam-status ok';
    s.textContent = msg;
    s.classList.remove('hidden');
  },
  showStatusErr(msg) {
    const s = $('cam-status');
    s.className = 'cam-status err';
    s.textContent = msg;
    s.classList.remove('hidden');
  },
};

function restoreAttendanceState() {
  try {
    const st = JSON.parse(localStorage.getItem(todayKey) || '{}');
    if (st.in) { $('t-in').textContent = st.in; $('t-in').classList.remove('empty'); }
    if (st.out) { $('t-out').textContent = st.out; $('t-out').classList.remove('empty'); }
    updateAbsenBtn();
  } catch {}
}

function updateAbsenBtn() {
  const st = JSON.parse(localStorage.getItem(todayKey) || '{}');
  const btn = $('btn-absen');
  if (st.out) { btn.textContent = 'Absen Selesai Hari Ini'; btn.classList.add('done'); btn.disabled = true; Cam.mode = 'DONE'; return; }
  if (st.in) { btn.textContent = 'Absen Keluar'; btn.classList.remove('done'); btn.disabled = false; Cam.mode = 'OUT'; }
  else { btn.textContent = 'Absen Masuk'; btn.classList.remove('done'); btn.disabled = false; Cam.mode = 'IN'; }
}

// ============ HELPERS ============
function safe(v) { return (v === undefined || v === null) ? '—' : v; }
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

// ============ BOOT ============
function boot() {
  tickClock();
  setInterval(tickClock, 1000);

  initLogin();
  initLogout();

  $('cam-close').onclick   = () => Cam.close();
  $('cam-capture').onclick = () => Cam.capture();
  $('cam-retake').onclick  = () => Cam.retake();
  $('cam-submit').onclick  = () => Cam.submit();

  $('btn-absen').onclick = () => {
    if (Cam.mode === 'DONE') return;
    Cam.open(Cam.mode === 'OUT' ? 'OUT' : 'IN');
  };

  if (Session.token() && Session.get()) {
    enterApp();
  }
}

document.addEventListener('DOMContentLoaded', boot);

