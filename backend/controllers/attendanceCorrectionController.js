const Attendance = require('../models/Attendance');
const User = require('../models/User');

const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeTime = (value, required) => {
  if ((value === '' || value == null) && !required) return null;
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (minute > 59 || second > 59) return undefined;
  if (match[4]) {
    if (hour < 1 || hour > 12) return undefined;
    hour = (hour % 12) + (match[4].toUpperCase() === 'PM' ? 12 : 0);
  }
  if (hour > 23) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};
const formatAttendanceTime = (value) => {
  if (!value) return null;
  const [hourText, minute, second] = value.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute}:${second} ${hour >= 12 ? 'PM' : 'AM'}`;
};

exports.updateAttendance = async (req, res) => {
  const { date, checkInTime, checkOutTime, userId } = req.body || {};
  if (!validDate(String(date || ''))) return res.status(400).json({ message: 'Enter a valid attendance date.' });
  const normalizedCheckIn = normalizeTime(checkInTime, true);
  const normalizedCheckOut = normalizeTime(checkOutTime, false);
  if (!normalizedCheckIn || normalizedCheckOut === undefined) {
    return res.status(400).json({ message: 'Enter valid check-in and check-out times.' });
  }
  if (normalizedCheckOut && normalizedCheckOut < normalizedCheckIn) {
    return res.status(400).json({ message: 'Check-out time must be after check-in time.' });
  }
  try {
    const existing = await Attendance.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Attendance record not found.' });
    const user = await User.findByUserId(String(userId || '').trim());
    if (!user) return res.status(400).json({ message: 'Select a valid User ID.' });
    const conflict = await Attendance.findForUserAndDate(user._id, date);
    if (conflict && conflict._id !== existing._id) {
      return res.status(409).json({ message: 'This user already has an attendance record for that date.' });
    }
    const { _id: ignoredId, ...existingData } = existing;
    const corrected = await Attendance.correct(existing._id, {
      ...existingData,
      user: user._id,
      userId: user.userId,
      date,
      checkInTime: formatAttendanceTime(normalizedCheckIn),
      checkOutTime: formatAttendanceTime(normalizedCheckOut),
      status: existing.status || 'Present'
    }, req.user.id);
    return res.json({ ...corrected, fullName: user.name || user.fullName || 'Unknown user' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const removed = await Attendance.removeWithAudit(req.params.id, req.user.id);
    if (!removed) return res.status(404).json({ message: 'Attendance record not found.' });
    return res.json({ message: 'Attendance record deleted.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
