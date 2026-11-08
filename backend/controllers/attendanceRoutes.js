const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getAttendanceHistory, getTodayAttendance, getDailyQRCode, getGeofence, saveGeofence } = require('../controllers/attendanceController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/today', protect, adminOnly, getTodayAttendance);
router.get('/daily-qr', getDailyQRCode);
router.get('/geofence', protect, getGeofence);
router.put('/geofence', protect, adminOnly, saveGeofence);
router.post('/checkin', protect, checkIn);
router.put('/checkout', protect, checkOut);
router.get('/', protect, getAttendanceHistory);

module.exports = router;
