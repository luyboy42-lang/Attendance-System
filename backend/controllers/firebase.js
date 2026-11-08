const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const fs = require('fs');
const path = require('path');

const loadServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON: ${error.message}`);
    }
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    (process.env.RENDER
      ? '/etc/secrets/serviceAccountKey.json'
      : path.join(__dirname, 'serviceAccountKey.json'));

  try {
    return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Firebase service account credentials were not found or are invalid at ${serviceAccountPath}. ` +
      'On Render, add serviceAccountKey.json under Environment > Secret Files.'
    );
  }
};

const serviceAccount = loadServiceAccount();

const app = getApps()[0] || initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://test-ca6dd-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = getDatabase(app);

module.exports = { database: () => db, db };
