const User = require('../models/User');
const bcrypt = require('bcryptjs');

const normalizeRole = (role) => {
  const value = String(role || 'employee').trim().toLowerCase();
  return value === 'staff' ? 'employee' : value;
};

const publicUser = (user) => {
  if (!user) return user;
  const { password, ...safeUser } = user;
  return safeUser;
};

const countAdmins = async () => (await User.findAll()).filter((user) => user.role === 'admin').length;

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users.map(publicUser));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const name = String(req.body.name || req.body.fullName || '').trim();
    const userId = String(req.body.userId || '').trim();
    const department = String(req.body.department || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = normalizeRole(req.body.role);

    if (!name || !userId || !password) {
      return res.status(400).json({ message: 'Name, User ID, and password are required.' });
    }
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (!['admin', 'student', 'employee'].includes(role)) {
      return res.status(400).json({ message: 'Role must be Admin, Student, or Staff.' });
    }
    if (await User.findByUserId(userId)) return res.status(409).json({ message: 'User ID already exists.' });
    if (email && await User.findByEmail(email)) return res.status(409).json({ message: 'Email already exists.' });

    const user = await User.create({
      name,
      fullName: name,
      userId,
      email: email || null,
      department,
      role,
      password: await bcrypt.hash(password, 10)
    });
    return res.status(201).json(publicUser(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const existing = await User.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'User not found.' });

    const name = String(req.body.name || req.body.fullName || '').trim();
    const userId = String(req.body.userId || '').trim();
    const department = String(req.body.department || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = normalizeRole(req.body.role);
    const password = String(req.body.password || '');

    if (!name || !userId) return res.status(400).json({ message: 'Name and User ID are required.' });
    if (!['admin', 'student', 'employee'].includes(role)) {
      return res.status(400).json({ message: 'Role must be Admin, Student, or Staff.' });
    }
    if (password && password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const matchingId = await User.findByUserId(userId);
    if (matchingId && matchingId._id !== existing._id) return res.status(409).json({ message: 'User ID already exists.' });
    const matchingEmail = email ? await User.findByEmail(email) : null;
    if (matchingEmail && matchingEmail._id !== existing._id) return res.status(409).json({ message: 'Email already exists.' });

    if (existing.role === 'admin' && role !== 'admin' && await countAdmins() <= 1) {
      return res.status(400).json({ message: 'The last admin account cannot be demoted.' });
    }

    const changes = {
      name,
      fullName: name,
      userId,
      email: email || null,
      department,
      role
    };
    if (password) changes.password = await bcrypt.hash(password, 10);

    return res.json(publicUser(await User.updateById(existing._id, changes)));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const existing = await User.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'User not found.' });
    if (existing._id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    if (existing.role === 'admin' && await countAdmins() <= 1) {
      return res.status(400).json({ message: 'The last admin account cannot be deleted.' });
    }

    await User.deleteById(existing._id);
    return res.json({ message: 'User deleted.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
