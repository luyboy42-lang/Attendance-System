const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { database } = require('./firebase');
const crypto = require('crypto');

const geofenceRef = () => database().ref('settings/geofence');

const readGeofence = async () => {
  const snapshot = await geofenceRef().once('value');
  return snapshot.val();
};

const validateCoordinates = (body) => {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = Number(body.accuracy);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(accuracy) || accuracy < 0) return null;
  return { latitude, longitude, accuracy };
};

const distanceInMeters = (a, b) => {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const verifyGeofence = async (body) => {
  const location = validateCoordinates(body);
  if (!location) return { error: 'Location is required. Enable device location and try again.' };
  const config = await readGeofence();
  if (!config || !Number.isFinite(Number(config.latitude)) || !Number.isFinite(Number(config.longitude)) || !Number.isFinite(Number(config.radius))) {
    return { error: 'Attendance location has not been configured by an admin.' };
  }
  const center = { latitude: Number(config.latitude), longitude: Number(config.longitude) };
  const distance = distanceInMeters(center, location);
  if (location.accuracy > Number(config.radius)) return { error: 'Location accuracy is too low. Please try again outdoors or with better GPS signal.' };
  if (distance > Number(config.radius)) return { error: `You are outside the allowed attendance area (${Math.round(distance)}m away; limit ${Number(config.radius)}m).` };
  return { location: { ...location, distance: Math.round(distance), verifiedAt: new Date().toISOString() } };
};

exports.getGeofence = async (_req, res) => {
  try {
    return res.set('Cache-Control', 'no-store').json(await readGeofence());
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.saveGeofence = async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const radius = Number(req.body.radius);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(radius) || radius < 1 || radius > 50000) {
    return res.status(400).json({ message: 'Enter valid coordinates and a radius between 1 and 50000 meters.' });
  }
  try {
    const config = { latitude, longitude, radius, updatedAt: new Date().toISOString(), updatedBy: req.user.id };
    await geofenceRef().set(config);
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getBangkokDate = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);

const getBangkokTime = (date) => date.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok' });

const signDailyQrDate = (date) => crypto
  .createHmac('sha256', process.env.QR_SECRET || process.env.JWT_SECRET)
  .update(`attendance-daily-qr:${date}`)
  .digest('hex');

const isValidDailyQrCode = (qrCode, today) => {
  if (!process.env.QR_SECRET && !process.env.JWT_SECRET) return false;
  const match = typeof qrCode === 'string'
    ? qrCode.match(/^ATTENDANCE-KEY-(\d{4}-\d{2}-\d{2})-([a-f0-9]{64})$/)
    : null;
  if (!match || match[1] !== today) return false;
  const expected = Buffer.from(signDailyQrDate(today), 'hex');
  const supplied = Buffer.from(match[2], 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};

exports.getDailyQRCode = async (_req, res) => {
  const date = getBangkokDate(new Date());
  if (!process.env.QR_SECRET && !process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'QR signing secret is not configured.' });
  }
  return res.set('Cache-Control', 'no-store').json({
    date,
    qrCode: `ATTENDANCE-KEY-${date}-${signDailyQrDate(date)}`
  });
};

exports.checkIn = async (req, res) => {
  try {
    const now = new Date();
    const date = getBangkokDate(now);
    if (!isValidDailyQrCode(req.body.qrCode, date)) {
      return res.status(400).json({ message: 'This QR code is invalid or expired. Please scan today\'s QR code.' });
    }
    const verification = await verifyGeofence(req.body);
    if (verification.error) return res.status(403).json({ message: verification.error });
    const userId = req.user.id;
    const attendance = await Attendance.createForUserAndDate(userId, date, {
      user: userId,
      date,
      checkInTime: getBangkokTime(now),
      checkOutTime: null,
      status: 'Present',
      location: {
        latitude: verification.location.latitude,
        longitude: verification.location.longitude
      },
      checkInLocation: verification.location,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });

    if (!attendance) return res.status(400).json({ message: 'You have already checked in today.' });
    return res.status(201).json(attendance);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const now = new Date();
    const date = getBangkokDate(now);
    if (!isValidDailyQrCode(req.body.qrCode, date)) {
      return res.status(400).json({ message: 'This QR code is invalid or expired. Please scan today\'s QR code.' });
    }
    const verification = await verifyGeofence(req.body);
    if (verification.error) return res.status(403).json({ message: verification.error });
    const attendance = await Attendance.findForUserAndDate(req.user.id, date);
    if (!attendance) return res.status(404).json({ message: 'No check-in record found for today.' });
    if (attendance.checkOutTime) return res.status(400).json({ message: 'You have already checked out today.' });
    const updated = await Attendance.update(attendance._id, {
      checkOutTime: getBangkokTime(now),
      checkOutLocation: verification.location
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const history = await Attendance.findForUser(req.user.id);
    return res.status(200).json(history);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTodayAttendance = async (_req, res) => {
  try {
    const today = getBangkokDate(new Date());
    const [records, users] = await Promise.all([Attendance.findForDate(today), User.findAll()]);
    const usersById = new Map(users.map((user) => [user._id, user]));
    const logs = records.map((record) => {
      const user = usersById.get(record.user) || {};
      return {
        ...record,
        fullName: user.name || user.fullName || 'Unknown user',
        userId: user.userId || record.user
      };
    });
    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
