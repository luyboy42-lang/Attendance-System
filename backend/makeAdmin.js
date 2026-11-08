const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();
require('./controllers/firebase');

async function createAdmin() {
  try {
    const email = 'admin@system.com';
    if (await User.findByEmail(email)) {
      console.log('Admin already exists');
      return;
    }

    const password = await bcrypt.hash('admin123', 10);
    await User.create({ name: 'System Admin', email, password, role: 'admin' });
    console.log('Admin account created successfully');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

createAdmin();
