// ===== KONFIGURASI =====
const ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbyiopiu30K0YvWCoYBwYyb7RuK3F27Tczg9LmWwv9pJu2Q2naywG3t2XCqsM9P7tOMP/exec';
const BANNER_INTERVAL = 3000; // ms

// ===== STATE =====
let state = {
  token: null,
  user: null, // {employeeId, employeeName, systemRole, mustChangePassword}
  branches: [],
  currentTab: 'dashboard',
  selectedDate: new Date().toISOString().slice(0,10),
  capturedPhoto: null, // base64 raw
  attendanceInProgress: null, // 'checkin' or 'checkout'
};

// ===== DOM REFS =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ===== HELPER =====
function api(action, payload = {}) {
  const body = { action, token: state.token, payload };
  return fetch(ENDPOINT_URL, {
    method: 'POST',
    // HAPUS mode: 'no-cors'
    // GANTI Content-Type menjadi text/plain agar tidak memicu preflight CORS
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  }).then(r => {
    if (!r.ok) throw new Error('HTTP Error: ' + r.status);
    return r.json(); // Langsung parse JSON karena respons sudah bisa dibaca
  }).then(res => {
    if (!res.ok) throw { code: res.error?.code, message: res.error?.message };
    return res.data;
  });
}


function toast(msg, type = 'ok') {
  const w = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  w.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ===== LOGIN =====
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Masuk...';
  document.getElementById('login-error').classList.add('hidden');
  try {
    const data = await api('login', { username, password });
    state.token = data.token;
    state.user = data;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    initHome();
    showScreen('screen-home');
  } catch (err) {
    document.getElementById('login-error').textContent = err.message || 'Gagal login';
    document.getElementById('login-error').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
});

// ===== INIT HOME =====
function initHome() {
  const u = state.user;
  document.getElementById('user-name').textContent = u.employeeName;
  document.getElementById('user-role-badge').textContent = u.systemRole;
  renderDashboard();
  startClock();
  startBanner();
  loadBranches();
}

function startClock() {
  function tick() {
    const now = new Date();
    const jam = now.getHours().toString().padStart(2,'0');
    const menit = now.getMinutes().toString().padStart(2,'0');
    document.getElementById('jam').textContent = `${jam}:${menit}`;
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const d = days[now.getDay()];
    const tgl = now.getDate();
    const bln = months[now.getMonth()];
    const thn = now.getFullYear();
    document.getElementById('tanggal').textContent = `${d}, ${tgl} ${bln} ${thn}`;
  }
  tick();
  setInterval(tick, 60000);
}

function startBanner() {
  let idx = 0;
  const tracks = [document.getElementById('banner-track'), document.getElementById('home-banner-track')];
  setInterval(() => {
    idx = (idx + 1) % 3;
    tracks.forEach(t => { if(t) t.style.transform = `translateX(-${idx * 100}%)`; });
  }, BANNER_INTERVAL);
}

async function loadBranches() {
  try {
    state.branches = await api('listBranches');
  } catch(e) { /* diam */ }
}

// ===== RENDER DASHBOARD (berdasarkan role) =====
function renderDashboard() {
  const container = document.getElementById('dynamic-content');
  const role = state.user.systemRole;
  if (role === 'SUPERADMIN') renderSuperadmin(container);
  else if (role === 'CEO') renderCEO(container);
  else renderKaryawan(container);
}

function renderSuperadmin(container) {
  container.innerHTML = `
    <div class="tab-bar" id="admin-tabs">
      <div class="tab-item active" data-tab="monitoring">📊 Monitoring</div>
      <div class="tab-item" data-tab="izin">📋 Izin/Cuti</div>
      <div class="tab-item" data-tab="manage">👥 Kelola</div>
      <div class="tab-item" data-tab="laporan">📄 Laporan</div>
    </div>
    <div id="admin-monitoring" class="tab-content"></div>
    <div id="admin-izin" class="tab-content hidden"></div>
    <div id="admin-manage" class="tab-content hidden"></div>
    <div id="admin-laporan" class="tab-content hidden"></div>
  `;
  // Event tabs
  document.querySelectorAll('#admin-tabs .tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#admin-tabs .tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('#dynamic-content .tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(`admin-${tab.dataset.tab}`).classList.remove('hidden');
      if (tab.dataset.tab === 'monitoring') loadMonitoring('admin-monitoring');
      if (tab.dataset.tab === 'izin') loadIzinCuti('admin-izin');
      if (tab.dataset.tab === 'laporan') renderLaporan('admin-laporan');
    });
  });
  loadMonitoring('admin-monitoring');
}

function renderCEO(container) {
  container.innerHTML = `
    <div class="stats-grid" id="ceo-stats"></div>
    <div class="tab-bar" id="ceo-tabs">
      <div class="tab-item active" data-tab="monitoring">📊 Monitoring</div>
      <div class="tab-item" data-tab="izin">📋 Izin/Cuti</div>
    </div>
    <div id="ceo-monitoring" class="tab-content"></div>
    <div id="ceo-izin" class="tab-content hidden"></div>
  `;
  loadCEOSummary();
  document.querySelectorAll('#ceo-tabs .tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#ceo-tabs .tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('#ceo-monitoring, #ceo-izin').forEach(c => c.classList.add('hidden'));
      document.getElementById(`ceo-${tab.dataset.tab}`).classList.remove('hidden');
      if (tab.dataset.tab === 'monitoring') loadMonitoring('ceo-monitoring');
      if (tab.dataset.tab === 'izin') loadIzinCuti('ceo-izin');
    });
  });
  loadMonitoring('ceo-monitoring');
}

function renderKaryawan(container) {
  container.innerHTML = `
    <div class="actions" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <button id="btn-absen" class="btn btn-primary">📷 Absen Sekarang</button>
      <button id="btn-profil" class="btn btn-ghost">👤 Profil</button>
    </div>
    <div id="absen-status" style="margin-bottom:12px"></div>
    <div id="proyek-list" style="margin-bottom:16px"></div>
    <div class="stats-grid" id="karyawan-stats"></div>
    <div style="margin-top:16px">
      <h3 style="font-size:.9rem;margin-bottom:8px;color:#64748b">Riwayat Hari Ini</h3>
      <div id="riwayat-list"></div>
    </div>
  `;
  document.getElementById('btn-absen').addEventListener('click', openCamera);
  document.getElementById('btn-profil').addEventListener('click', showProfil);
  loadKaryawanStatus();
  loadKaryawanStats();
  loadRiwayat();
}

// ===== MONITORING (SUPERADMIN & CEO) =====
async function loadMonitoring(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="filter-row">
      <input type="date" id="mon-date" value="${state.selectedDate}" />
      <button id="mon-refresh" class="btn btn-sm btn-primary">🔄</button>
    </div>
    <div id="mon-list" class="card-list">Memuat...</div>
  `;
  document.getElementById('mon-date').addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    fetchMonitoring(containerId);
  });
  document.getElementById('mon-refresh').addEventListener('click', () => fetchMonitoring(containerId));
  fetchMonitoring(containerId);
}

async function fetchMonitoring(containerId) {
  const list = document.querySelector(`#${containerId} #mon-list`);
  if (!list) return;
  list.innerHTML = '⏳ Memuat...';
  try {
    const data = await api('getDailyAttendance', { date: state.selectedDate });
    if (!data.result || data.result.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b">Tidak ada data</div>';
      return;
    }
    list.innerHTML = data.result.map(emp => {
      const att = emp.attendance;
      const status = emp.overallStatus;
      let badgeClass = 'badge-alfa';
      let badgeText = 'Alfa';
      if (status === 'PRESENT' || status === 'LATE' || status === 'CHECKED_IN') { badgeClass = 'badge-hadir'; badgeText = 'Hadir'; }
      if (emp.leaves.length > 0) { badgeClass = 'badge-cuti'; badgeText = 'Cuti'; }
      if (emp.permissions.length > 0) {
        const t = emp.permissions[0].permissionType;
        badgeClass = t === 'SICK' ? 'badge-sakit' : 'badge-izin';
        badgeText = t === 'SICK' ? 'Sakit' : 'Izin';
      }
      return `
        <div class="emp-card" data-eid="${emp.employeeId}" onclick="openDetail('${emp.employeeId}','${state.selectedDate}')">
          <div class="left">
            <div class="avatar">${emp.employeeName.charAt(0).toUpperCase()}</div>
            <div class="info">
              <div class="name">${emp.employeeName}</div>
              <div class="detail">${att ? '🕐 '+att.checkIn.time + (att.checkOut.time ? ' → '+att.checkOut.time : '') : 'Belum absen'}</div>
            </div>
          </div>
          <div class="status-badge ${badgeClass}">${badgeText}</div>
        </div>
      `;
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:#B91C1C">Gagal memuat: '+e.message+'</div>';
  }
}

// ===== IZIN/CUTI MONITORING =====
async function loadIzinCuti(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="filter-row">
      <input type="date" id="izin-date" value="${state.selectedDate}" />
      <button id="izin-refresh" class="btn btn-sm btn-primary">🔄</button>
    </div>
    <div id="izin-list" class="card-list">Memuat...</div>
  `;
  document.getElementById('izin-date').addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    fetchIzinCuti(containerId);
  });
  document.getElementById('izin-refresh').addEventListener('click', () => fetchIzinCuti(containerId));
  fetchIzinCuti(containerId);
}

async function fetchIzinCuti(containerId) {
  const list = document.querySelector(`#${containerId} #izin-list`);
  if (!list) return;
  list.innerHTML = '⏳ Memuat...';
  try {
    const data = await api('getDailyAttendance', { date: state.selectedDate });
    const items = data.result.filter(e => e.leaves.length > 0 || e.permissions.length > 0);
    if (items.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b">Tidak ada izin/cuti</div>';
      return;
    }
    list.innerHTML = items.map(emp => {
      const l = emp.leaves[0];
      const p = emp.permissions[0];
      const req = l || p;
      const type = l ? 'Cuti' : (p.permissionType === 'SICK' ? 'Sakit' : 'Izin');
      let badge = '';
      let actionBtn = '';
      if (l) {
        const st = l.status;
        if (st === 'PENDING') {
          badge = '<span class="status-badge badge-pending">⏳ Perlu Tindakan</span>';
          if (state.user.systemRole === 'SUPERADMIN') {
            actionBtn = `
              <button class="btn btn-sm btn-success" onclick="decideLeave('${l.requestId}','APPROVED')">✅ Setujui</button>
              <button class="btn btn-sm btn-danger" onclick="decideLeave('${l.requestId}','REJECTED')">❌ Tolak</button>
            `;
          }
        } else if (st === 'APPROVED') badge = '<span class="status-badge badge-approved">✅ Disetujui</span>';
        else badge = '<span class="status-badge badge-rejected">❌ Ditolak</span>';
      } else {
        badge = '<span class="status-badge badge-izin">📋 Ditinjau Admin</span>';
      }
      const alasan = req ? req.reason : '';
      return `
        <div class="emp-card">
          <div class="left">
            <div class="avatar">${emp.employeeName.charAt(0)}</div>
            <div class="info">
              <div class="name">${emp.employeeName} — ${type}</div>
              <div class="detail">${alasan}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${badge} ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:#B91C1C">Gagal: '+e.message+'</div>';
  }
}

// ===== DECIDE LEAVE =====
window.decideLeave = async (requestId, decision) => {
  const notes = decision === 'REJECTED' ? prompt('Alasan penolakan:') : '';
  if (decision === 'REJECTED' && !notes) { toast('Alasan wajib diisi', 'err'); return; }
  try {
    await api('decideLeaveRequest', { requestId, decision, notes });
    toast('Berhasil', 'ok');
    loadIzinCuti('admin-izin');
  } catch(e) { toast(e.message, 'err'); }
};

// ===== CEO SUMMARY =====
async function loadCEOSummary() {
  const container = document.getElementById('ceo-stats');
  if (!container) return;
  try {
    const data = await api('getDailyAttendance', { date: state.selectedDate });
    const hadir = data.result.filter(e => e.attendance && e.attendance.checkIn.time).length;
    const sudahPulang = data.result.filter(e => e.attendance && e.attendance.checkOut.time).length;
    const cuti = data.result.filter(e => e.leaves.length > 0).length;
    const sakit = data.result.filter(e => e.permissions.some(p => p.permissionType === 'SICK')).length;
    container.innerHTML = `
      <div class="stat-card"><div class="num">${data.totalEmployees}</div><div class="lbl">Total Karyawan</div></div>
      <div class="stat-card"><div class="num">${hadir}</div><div class="lbl">Masuk</div></div>
      <div class="stat-card"><div class="num">${sudahPulang}</div><div class="lbl">Sudah Pulang</div></div>
      <div class="stat-card"><div class="num">${cuti+sakit}</div><div class="lbl">Cuti/Sakit</div></div>
    `;
  } catch(e) { container.innerHTML = '<div style="color:#B91C1C">Gagal load</div>'; }
}

// ===== KARYAWAN: STATUS, PROYEK, STATS, RIWAYAT =====
async function loadKaryawanStatus() {
  const el = document.getElementById('absen-status');
  try {
    const data = await api('getDailyAttendance', { date: state.selectedDate });
    const saya = data.result.find(e => e.employeeId === state.user.employeeId);
    if (saya && saya.attendance) {
      const a = saya.attendance;
      el.innerHTML = `
        <div style="display:flex;gap:16px;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px">
          <div style="flex:1;text-align:center">
            <div style="font-size:.7rem;color:#64748b">Masuk</div>
            <div style="font-weight:700;font-size:1.1rem">${a.checkIn.time || '--:--'}</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:.7rem;color:#64748b">Pulang</div>
            <div style="font-weight:700;font-size:1.1rem">${a.checkOut.time || '--:--'}</div>
          </div>
        </div>
      `;
    } else {
      el.innerHTML = '<div style="text-align:center;padding:12px;color:#64748b">Belum absen hari ini</div>';
    }
  } catch(e) { el.innerHTML = ''; }
}

async function loadKaryawanStats() {
  const container = document.getElementById('karyawan-stats');
  try {
    const data = await api('getAttendanceReport', { month: state.selectedDate.slice(0,7), employeeId: state.user.employeeId });
    const emp = data.employees[0];
    if (!emp) { container.innerHTML = ''; return; }
    const totalLemburJam = Math.floor(emp.overtimeMinutes / 60);
    const totalTelatJam = Math.floor(emp.lateCount * 0); // lateCount per hari, bisa disesuaikan
    container.innerHTML = `
      <div class="stat-card"><div class="num">${emp.presentCount}</div><div class="lbl">Total Masuk</div></div>
      <div class="stat-card"><div class="num">${totalLemburJam}</div><div class="lbl">Lembur (jam)</div></div>
      <div class="stat-card"><div class="num">${emp.lateCount}</div><div class="lbl">Telat (hari)</div></div>
      <div class="stat-card"><div class="num">${emp.earlyLeaveCount}</div><div class="lbl">Izin (hari)</div></div>
    `;
  } catch(e) { container.innerHTML = ''; }
}

async function loadRiwayat() {
  const container = document.getElementById('riwayat-list');
  try {
    const data = await api('listMyAttendance', { month: state.selectedDate.slice(0,7) });
    if (!data.items || data.items.length === 0) {
      container.innerHTML = '<div style="color:#64748b">Belum ada riwayat</div>';
      return;
    }
    container.innerHTML = data.items.slice(0,7).map(item => `
      <div class="emp-card" onclick="showDetailHarian('${item.attendanceId}')">
        <div class="left">
          <div class="info">
            <div class="name">${item.attendanceDate}</div>
            <div class="detail">${item.checkInTime} → ${item.checkOutTime || '—'}</div>
          </div>
        </div>
        <div class="status-badge badge-hadir">${item.attendanceStatus}</div>
      </div>
    `).join('');
  } catch(e) { container.innerHTML = ''; }
}

window.showDetailHarian = (attendanceId) => {
  // bisa fetch detail via getAttendanceForDate atau listMyAttendance
  toast('Fitur detail harian menyusul', 'ok');
};

// ===== PROYEK LIST =====
async function loadProyek() {
  const container = document.getElementById('proyek-list');
  try {
    const branches = await api('listBranches');
    if (branches.length === 0) {
      container.innerHTML = '<div style="color:#64748b">Tidak ada proyek</div>';
      return;
    }
    container.innerHTML = '<h3 style="font-size:.9rem;margin-bottom:8px;color:#64748b">📍 Lokasi Proyek</h3>' +
      branches.map(b => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:8px">
          <strong>${b.branchName}</strong>
          <div style="font-size:.75rem;color:#64748b">${b.address || ''}</div>
        </div>
      `).join('');
  } catch(e) { container.innerHTML = ''; }
}

// ===== PROFIL KARYAWAN =====
function showProfil() {
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-title').textContent = '👤 Profil Saya';
  const user = state.user;
  document.getElementById('detail-content').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="width:80px;height:80px;border-radius:50%;background:#DBEAFE;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 8px;color:#1D4ED8">${user.employeeName.charAt(0)}</div>
      <strong style="font-size:1.1rem">${user.employeeName}</strong>
      <div style="color:#64748b;font-size:.85rem">${user.systemRole}</div>
    </div>
    <div style="margin-bottom:12px">
      <button class="btn btn-sm btn-ghost" onclick="gantiPassword()">🔑 Ganti Password</button>
    </div>
  `;
  showModal('detail-modal');
}

function gantiPassword() {
  const pwBaru = prompt('Password baru (min 8 karakter):');
  if (!pwBaru || pwBaru.length < 8) { toast('Password minimal 8 karakter', 'err'); return; }
  const pwLama = prompt('Password lama:');
  if (!pwLama) return;
  api('changeOwnPassword', { oldPassword: pwLama, newPassword: pwBaru })
    .then(() => { toast('Password berhasil diganti', 'ok'); hideModal('detail-modal'); })
    .catch(e => toast(e.message, 'err'));
}

// ===== KAMERA & ABSEN =====
async function openCamera() {
  const modal = document.getElementById('camera-modal');
  showModal('camera-modal');
  const video = document.getElementById('camera-video');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
    video.srcObject = stream;
    video.play();
  } catch(e) {
    toast('Tidak bisa akses kamera', 'err');
    hideModal('camera-modal');
    return;
  }
  state.attendanceInProgress = null;
  document.getElementById('photo-preview-area').classList.add('hidden');
  document.getElementById('camera-actions').classList.remove('hidden');
  document.getElementById('reason-input').value = '';
}

document.getElementById('btn-capture').addEventListener('click', () => {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]; // kompres
  state.capturedPhoto = base64;
  document.getElementById('photo-preview').src = 'data:image/jpeg;base64,' + base64;
  document.getElementById('photo-preview-area').classList.remove('hidden');
  document.getElementById('camera-actions').classList.add('hidden');
  // stop kamera
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
});

document.getElementById('btn-cancel-camera').addEventListener('click', () => {
  const stream = document.getElementById('camera-video').srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());
  hideModal('camera-modal');
});

document.getElementById('btn-submit-attendance').addEventListener('click', async () => {
  const reason = document.getElementById('reason-input').value.trim();
  if (!state.capturedPhoto) { toast('Ambil foto dulu', 'err'); return; }
  // cek apakah checkin atau checkout? Tentukan berdasarkan status hari ini
  try {
    const data = await api('getDailyAttendance', { date: state.selectedDate });
    const saya = data.result.find(e => e.employeeId === state.user.employeeId);
    const isCheckIn = !saya || !saya.attendance || !saya.attendance.checkIn.time;
    const action = isCheckIn ? 'checkIn' : 'checkOut';
    // ambil branch pertama
    const branch = state.branches[0];
    if (!branch) { toast('Tidak ada proyek terdaftar', 'err'); return; }
    // dapatkan posisi GPS
    let lat = 0, lng = 0;
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch(e) { /* gunakan default */ }
    const payload = {
      branchId: branch.branchId,
      latitude: lat || branch.latitude,
      longitude: lng || branch.longitude,
      photoBase64: state.capturedPhoto,
      reason: reason || ''
    };
    const result = await api(action, payload);
    toast(`${action === 'checkIn' ? 'Check-in' : 'Check-out'} berhasil!`, 'ok');
    hideModal('camera-modal');
    loadKaryawanStatus();
    loadKaryawanStats();
    loadRiwayat();
  } catch(e) {
    if (e.code === 'REASON_REQUIRED') {
      toast('Harap isi alasan terlebih dahulu', 'err');
      document.getElementById('reason-input').focus();
    } else {
      toast(e.message, 'err');
    }
  }
});

// ===== LOGOUT =====
document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await api('logout'); } catch(e) {}
  state.token = null;
  state.user = null;
  localStorage.clear();
  showScreen('screen-login');
});

// ===== CEK TOKEN TERSIMPAN =====
(async function init() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  if (token && user) {
    state.token = token;
    state.user = user;
    try {
      const me = await api('me');
      state.user = me;
      initHome();
      showScreen('screen-home');
    } catch(e) {
      localStorage.clear();
      showScreen('screen-login');
    }
  } else {
    showScreen('screen-login');
  }
})();
