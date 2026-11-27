// ================= CONFIG =================
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyiopiu30K0YvWCoYBwYyb7RuK3F27Tczg9LmWwv9pJu2Q2naywG3t2XCqsM9P7tOMP/exec',                      // isi URL Apps Web App untuk mode sungguhan
  STORAGE_TOKEN: 'tb_token',
  STORAGE_USER: 'tb_user',
};
CONFIG.DEMO = !CONFIG.API_URL;

// ================= HELPERS =================
const $ = (id) => document.getElementById(id);
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function fmtToday(d) {
  return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

// ================= SESSION =================
const Session = {
  get() {
    try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_USER)); }
    catch { return null; }
  },
  set(token, user) {
    localStorage.setItem(CONFIG.STORAGE_TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_USER, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(CONFIG.STORAGE_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_USER);
  },
  token() { return localStorage.getItem(CONFIG.STORAGE_TOKEN); },
};

// ================= API =================
async function api(action, payload = {}) {
  if (CONFIG.DEMO) return demoApi(action, payload);
  const body = { action, payload };
  const token = Session.token();
  if (token) body.token = token;
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ? data.error.message : 'Terjadi kesalahan');
  return data.data;
}

function demoApi(action, p) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (action === 'login') {
        if (p.username === 'demo' && p.password === 'demo12345') {
          resolve({
            token: 'DEMO', mustChangePassword: false,
            employeeId: 'EMP_DEMO', employeeName: 'Budi Santoso', systemRole: 'EMPLOYEE',
          });
        } else reject(new Error('Username atau password salah'));
      } else if (action === 'getLeaveBalance') {
        resolve({ year: 2026, annualQuotaDays: 12, usedDays: 4, remainingDays: 8, exists: true });
      } else if (action === 'listMyAttendance') {
        resolve({ items: [], total: 0 });
      } else {
        resolve({});
      }
    }, 600);
  });
}

// ================= BANNER (auto 4s + swipe) =================
const Banner = {
  idx: 0, total: 3, timer: null,
  init() {
    const dots = $('banner-dots');
    for (let i = 0; i < this.total; i++) {
      const d = document.createElement('i');
      if (i === 0) d.className = 'on';
      dots.appendChild(d);
    }
    this.start();
    // swipe
    const track = $('banner-track');
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
    track.addEventListener('mouseenter', () => this.stop());
    track.addEventListener('mouseleave', () => this.start());
  },
  start() {
    this.stop();
    this.timer = setInterval(() => this.go(this.idx + 1), 4000);
  },
  stop() { if (this.timer) clearInterval(this.timer); },
  go(i) {
    this.idx = ((i % this.total) + this.total) % this.total;
    $('banner-track').style.transform = 'translateX(-' + (this.idx * 100) + '%)';
    $('banner-dots').querySelectorAll('i').forEach((d, n) => d.classList.toggle('on', n === this.idx));
  },
};

// ================= CLOCK =================
function tickClock() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  $('clock').textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

// ================= NAV =================
function initNav() {
  $('tabbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    $('tab-' + btn.dataset.t).classList.add('on');
  });
}

// ================= PAGE RENDER =================
function renderUser(user) {
  $('greet').textContent = 'Hallo, ' + user.employeeName.split(' ')[0];
  $('p-name').textContent = user.employeeName;
  $('p-role').textContent = user.systemRole;
  $('p-id').textContent = user.employeeId;
  $('avatar').textContent = user.employeeName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

async function loadLeaveBalance() {
  try {
    const b = await api('getLeaveBalance', {});
    $('cuti-sisa').textContent = b.remainingDays;
    $('cuti-kuota').textContent = b.annualQuotaDays;
  } catch (e) { /* tampil 0 */ }
}

// ================= LOGIN =================
function initLogin() {
  $('btn-eye').addEventListener('click', () => {
    const p = $('in-pass');
    p.type = p.type === 'password' ? 'text' : 'password';
  });
  $('btn-login').addEventListener('click', doLogin);
  $('in-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

async function doLogin() {
  const username = $('in-user').value.trim();
  const password = $('in-pass').value;
  const err = $('login-err');
  err.classList.remove('hidden');
  if (!username || !password) {
    err.textContent = 'Username dan password wajib diisi.';
    return;
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
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

function enterApp() {
  const user = Session.get();
  if (!user) return;
  $('view-login').classList.remove('on');
  $('view-app').classList.add('on');
  renderUser(user);
  loadLeaveBalance();
}

function initLogout() {
  $('btn-logout').addEventListener('click', async () => {
    try { await api('logout'); } catch (e) {}
    Session.clear();
    $('view-app').classList.remove('on');
    $('view-login').classList.add('on');
    $('in-pass').value = '';
  });
}

// ================= SEG PENGAJUAN =================
function initSeg() {
  $('seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    $('seg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    const isCuti = btn.dataset.t === 'cuti';
    $('f-type').classList.toggle('hidden', isCuti);
    $('f-lampiran').classList.toggle('hidden', isCuti);
  });
}

// ================= BOOT =================
window.addEventListener('DOMContentLoaded', () => {
  $('today').textContent = fmtToday(new Date());
  $('rekap-month').textContent = MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear();
  tickClock();
  setInterval(tickClock, 1000);
  Banner.init();
  initNav();
  initLogin();
  initLogout();
  initSeg();
  if (Session.token()) enterApp();
});
