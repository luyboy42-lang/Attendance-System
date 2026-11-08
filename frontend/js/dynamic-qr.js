const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
let qrRefreshInProgress = false;
let lastQrRefreshAttemptAt = 0;

function getBangkokDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function refreshDailyQRCode() {
  const qrContainer = document.getElementById('kioskQrCanvas');
  if (!qrContainer || qrRefreshInProgress || Date.now() - lastQrRefreshAttemptAt < 30_000) return;
  qrRefreshInProgress = true;
  lastQrRefreshAttemptAt = Date.now();

  try {
    const response = await fetch(window.apiUrl('/api/attendance/daily-qr'), { cache: 'no-store' });
    if (!response.ok) {
      const message = response.status === 404
        ? 'QR endpoint not found. Restart the backend server.'
        : `QR request failed (${response.status}). Check the backend server.`;
      throw new Error(message);
    }
    const { qrCode, date } = await response.json();

    qrContainer.replaceChildren();
    qrContainer.classList.remove('text-slate-900', 'text-sm', 'font-semibold', 'text-center', 'break-words', 'p-3');
    new QRCode(qrContainer, {
      text: qrCode,
      width: 200,
      height: 200,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    qrContainer.dataset.qrDate = date;
  } catch (error) {
    console.error('Unable to refresh daily QR code:', error);
    qrContainer.classList.add('text-slate-900', 'text-sm', 'font-semibold', 'text-center', 'break-words', 'p-3');
    qrContainer.textContent = error.message;
  } finally {
    qrRefreshInProgress = false;
  }
}

function updateDailyTimer() {
  const timerLabel = document.getElementById('timerCountdown');
  const progressBar = document.getElementById('refreshProgress');
  const now = new Date();
  const dateKey = getBangkokDateKey(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const time = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  const elapsedSeconds = time.hour * 3600 + time.minute * 60 + time.second;
  const secondsLeft = 86400 - elapsedSeconds;

  if (timerLabel) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    timerLabel.textContent = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (progressBar) progressBar.style.width = `${(secondsLeft / 86400) * 100}%`;

  const qrContainer = document.getElementById('kioskQrCanvas');
  if (qrContainer && qrContainer.dataset.qrDate !== dateKey) refreshDailyQRCode();
}

document.addEventListener('DOMContentLoaded', () => {
  refreshDailyQRCode();
  updateDailyTimer();
  window.setInterval(updateDailyTimer, 1000);
});
