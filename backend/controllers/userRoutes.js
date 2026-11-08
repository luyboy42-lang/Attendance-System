const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { register, login } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/', protect, adminOnly, getUsers);
router.post('/', protect, adminOnly, createUser);
router.put('/:id', protect, adminOnly, updateUser);
router.delete('/:id', protect, adminOnly, deleteUser);

module.exports = router;
