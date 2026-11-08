const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Register
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const name = req.body.name || req.body.fullName;
    const userId = (req.body.userId || '').trim();
    const department = (req.body.department || '').trim();
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required' });
    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findByEmail(normalizedEmail) || (userId ? await User.findByUserId(userId) : null);
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name: name.trim(), fullName: name.trim(), email: normalizedEmail, userId, department, password: hashedPassword, role: 'employee' });
    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name || user.fullName,
        email: user.email,
        role: user.role,
        userId: user.userId,
        department: user.department,
        user: { userId: user.userId, fullName: user.name || user.fullName, department: user.department, role: user.role },
        token: generateToken(user._id, user.role)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const identifier = (req.body.userId || email || '').trim();
    const user = identifier.includes('@')
      ? await User.findByEmail(identifier.toLowerCase())
      : await User.findByUserId(identifier);
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        name: user.name || user.fullName,
        email: user.email,
        role: user.role,
        userId: user.userId,
        department: user.department,
        user: { userId: user.userId, fullName: user.name || user.fullName, department: user.department, role: user.role },
        token: generateToken(user._id, user.role)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
