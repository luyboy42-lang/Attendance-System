// ពិនិត្យការ Login ពេលចូលមកដល់ទំព័រ User App ដំបូងបង្អស់
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) { lucide.createIcons(); }

  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  if (!token) {
    // បើគ្មាន Token ទេ បង្ហាញផ្ទាំង Auth Modal បង្ខំឱ្យ Login / Register
    if (typeof openAuthModal === 'function') {
      openAuthModal();
    }
  } else {
    // បើមាន Token រួចហើយ ទាញយកទិន្នន័យ User មកបង្ហាញលើ UI
    console.log('User authenticated successfully.');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        updateUserUI(user);
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
    
    // ប្តូរប៊ូតុង Header ទៅជា ចាកចេញ (Logout)
    const authBtnText = document.getElementById('authBtnText');
    const authBtnToggle = document.getElementById('authBtnToggle');
    if (authBtnText && authBtnToggle) {
      authBtnText.innerText = 'ចាកចេញ';
      authBtnToggle.onclick = handleLogout;
      authBtnToggle.className = "px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-md transition flex items-center gap-1.5 cursor-pointer";
    }

    loadAttendanceSummary();
    // Keep elapsed hours current while the employee is still checked in.
    window.setInterval(loadAttendanceSummary, 60 * 1000);
  }
});

const attendanceDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
});

function formatAttendanceTime(value) {
  if (!value) return '—';
  const parsed = new Date(`2000-01-01 ${value}`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeToMinutes(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3]) {
    const suffix = match[3].toUpperCase();
    hour = (hour % 12) + (suffix === 'PM' ? 12 : 0);
  }
  return hour * 60 + minute;
}

async function loadAttendanceSummary() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const response = await fetch(window.apiUrl('/api/attendance'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Could not load attendance history');
    const records = await response.json();
    renderAttendanceSummary(Array.isArray(records) ? records : []);
  } catch (error) {
    console.error('Error loading attendance summary:', error);
  }
}

function renderAttendanceSummary(records) {
  const today = attendanceDateFormatter.format(new Date());
  const todayRecord = records.find((record) => record.date === today);
  const hours = document.getElementById('totalHoursCounter');
  const times = document.getElementById('todayAttendanceTimes');
  if (hours) {
    const start = timeToMinutes(todayRecord?.checkInTime);
    const end = todayRecord?.checkOutTime
      ? timeToMinutes(todayRecord.checkOutTime)
      : (todayRecord ? Number(new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).format(new Date()).split(':')[0]) * 60 + Number(new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).format(new Date()).split(':')[1]) : null);
    const elapsed = start !== null && end !== null ? Math.max(0, end - start) : null;
    if (elapsed === null) {
      hours.textContent = 'Not started';
      hours.classList.remove('text-4xl', 'text-3xl', 'text-2xl');
      hours.classList.add('text-2xl');
    } else if (elapsed < 60) {
      hours.textContent = elapsed === 0 ? 'Under 1 min' : `${elapsed} min`;
      hours.classList.remove('text-4xl', 'text-3xl', 'text-2xl');
      hours.classList.add('text-3xl');
    } else {
      const wholeHours = Math.floor(elapsed / 60);
      const remainingMinutes = elapsed % 60;
      hours.textContent = remainingMinutes ? `${wholeHours} hr ${remainingMinutes} min` : `${wholeHours} hr`;
      hours.classList.remove('text-4xl', 'text-3xl', 'text-2xl');
      hours.classList.add('text-3xl');
    }
  }
  if (times) {
    times.textContent = `Check-In: ${formatAttendanceTime(todayRecord?.checkInTime)} · Check-Out: ${formatAttendanceTime(todayRecord?.checkOutTime)}`;
  }

  const container = document.getElementById('recentLogs');
  if (!container) return;
  container.replaceChildren();
  // Show only today's attendance so a previous day's scan cannot be mistaken
  // for today's check-in or check-out.
  const todayRecords = records.filter((record) => record.date === today);
  if (!todayRecords.length) {
    const empty = document.createElement('p');
    empty.className = 'text-xs text-slate-500';
    empty.textContent = 'No scans recorded today.';
    container.append(empty);
    return;
  }
  todayRecords.forEach((record) => {
    const row = document.createElement('div');
    row.className = 'p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center text-xs';
    const details = document.createElement('div');
    const date = document.createElement('div');
    date.className = 'font-medium text-slate-200';
    date.textContent = record.date || '';
    const time = document.createElement('div');
    time.className = 'text-[11px] text-slate-400';
    time.textContent = `${formatAttendanceTime(record.checkInTime)} - ${formatAttendanceTime(record.checkOutTime)}`;
    details.append(date, time);
    const status = document.createElement('span');
    status.className = 'px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20';
    status.textContent = record.checkOutTime ? 'Checked-Out' : 'Checked-In';
    row.append(details, status);
    container.append(row);
  });
}

// មុខងារអាប់ដេតព័ត៌មាន Profile លើអេក្រង់ UI
function updateUserUI(user) {
  const fullName = String(user.fullName || user.name || '').trim();
  if (fullName) {
    const el = document.getElementById('displayFullName');
    if (el) el.innerText = fullName;
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
      const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join('');
      avatar.textContent = initials.toLocaleUpperCase();
    }
  }
  if (user.userId) {
    const el = document.getElementById('displayUserId');
    if (el) el.innerText = user.userId;
  }
  if (user.department) {
    const el = document.getElementById('displayDept');
    if (el) el.innerText = user.department;
  }
  if (user.role) {
    const el = document.getElementById('displayRole');
    if (el) el.innerText = user.role;
  }
}

// មុខងារទូទៅសម្រាប់គ្រប់គ្រង Modal & Language
function toggleLang() {
  document.querySelectorAll('.lang-km').forEach(el => el.classList.toggle('hidden'));
  document.querySelectorAll('.lang-en').forEach(el => el.classList.toggle('hidden'));
}

function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  // Authentication is required before any attendance features can be used.
  if (!localStorage.getItem('token')) return;
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('hidden');
}

function switchAuthTab(type) {
  const loginBtn = document.getElementById('authTabBtnLogin');
  const regBtn = document.getElementById('authTabBtnRegister');
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');

  if (type === 'login') {
    if (loginBtn) loginBtn.className = 'pb-3 text-sm font-semibold text-brand-400 border-b-2 border-brand-500';
    if (regBtn) regBtn.className = 'pb-3 text-sm font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent';
    if (loginForm) loginForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
  } else {
    if (regBtn) regBtn.className = 'pb-3 text-sm font-semibold text-emerald-400 border-b-2 border-emerald-500';
    if (loginBtn) loginBtn.className = 'pb-3 text-sm font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent';
    if (regForm) regForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
  }
}

// មុខងារ Handle Login ព្រមទាំងរក្សាទុក Session ទុកប្រើប្រាស់ពេលក្រោយ
async function handleLogin(e) {
  e.preventDefault();
  const userId = document.getElementById('loginUserId').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(window.apiUrl('/api/users/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      if (!data.token) {
        alert('ការចូលប្រើមិនបានជោគជ័យទេ៖ Server មិនបានផ្ញើ authentication token មកវិញ។');
        return;
      }
      alert('ចូលប្រព័ន្ធជោគជ័យ!');
      
      // រក្សាទុក Token និងព័ត៌មាន User ទុកក្នុង localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user || { userId, fullName: userId, department: 'IT Dept', role: 'Staff' }));
      
      if (typeof closeAuthModal === 'function') {
        closeAuthModal();
      }
      location.reload(); // Refresh ដើម្បីរៀបចំ UI ឡើងវិញ
    } else {
      alert(data.message || 'User ID ឬ Password មិនត្រឹមត្រូវ!');
    }
  } catch (err) {
    console.error(err);
    alert('មិនអាចភ្ជាប់ទៅ Server បានទេ។ សូមពិនិត្យថា backend កំពុងដំណើរការ។');
  }
}

// មុខងារ Handle Register
async function handleRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('regFullName').value;
  const email = document.getElementById('regEmail').value;
  const userId = document.getElementById('regUserId').value;
  const department = document.getElementById('regDepartment').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch(window.apiUrl('/api/users/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fullName, email, userId, department, password })
    });
    const data = await res.json();
    if (res.ok) {
      if (!data.token) {
        alert('ការចុះឈ្មោះបានជោគជ័យ ប៉ុន្តែ Server មិនបានផ្ញើ authentication token មកវិញទេ។ សូមចូលប្រើប្រព័ន្ធ។');
        switchAuthTab('login');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user || {
        userId,
        fullName,
        department,
        role: data.role || 'employee'
      }));
      alert('ចុះឈ្មោះ និងចូលប្រព័ន្ធជោគជ័យ!');
      location.reload();
    } else {
      alert(data.message || 'ការចុះឈ្មោះបរាជ័យ!');
    }
  } catch (err) {
    console.error(err);
    alert('មិនអាចភ្ជាប់ទៅ Server បានទេ។ សូមពិនិត្យថា backend កំពុងដំណើរការ។');
  }
}

// មុខងារ Logout សម្រាប់លុប Token ចោលពេលត្រូវការចាកចេញ
function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  alert('ចាកចេញពីប្រព័ន្ធជោគជ័យ!');
  location.reload();
}
