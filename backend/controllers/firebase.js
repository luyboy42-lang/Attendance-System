const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');

const app = getApps()[0] || initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://test-ca6dd-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = getDatabase(app);

module.exports = { database: () => db, db };
