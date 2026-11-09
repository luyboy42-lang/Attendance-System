const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getAttendanceHistory, getTodayAttendance, getMonthlyAttendance, getAttendanceAnalytics, getDailyQRCode, getGeofence, saveGeofence } = require('../controllers/attendanceController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { updateAttendance, deleteAttendance } = require('./attendanceCorrectionController');

router.get('/today', protect, adminOnly, getTodayAttendance);
router.get('/month', protect, adminOnly, getMonthlyAttendance);
router.get('/analytics', protect, getAttendanceAnalytics);
router.get('/daily-qr', getDailyQRCode);
router.get('/geofence', protect, getGeofence);
router.put('/geofence', protect, adminOnly, saveGeofence);
router.post('/checkin', protect, checkIn);
router.put('/checkout', protect, checkOut);
router.get('/', protect, getAttendanceHistory);
router.put('/:id', protect, adminOnly, updateAttendance);
router.delete('/:id', protect, adminOnly, deleteAttendance);

module.exports = router;
