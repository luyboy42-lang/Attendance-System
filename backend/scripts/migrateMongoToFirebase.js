require('dotenv').config();

const { MongoClient } = require('mongodb');
const { database } = require('../controllers/firebase');

const isApply = process.argv.includes('--apply');
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error('MONGO_URI is missing from backend/.env');
  process.exit(1);
}

const toFirebaseValue = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toFirebaseValue);
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectId') return value.toString();
    if (value._bsontype === 'Decimal128') return value.toString();
    if (value._bsontype === 'Long' || value._bsontype === 'Int32' || value._bsontype === 'Double') return value.valueOf();
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirebaseValue(item)]));
  }
  return value;
};

const firebaseKey = (value) => String(value).replace(/[.#$\[\]/]/g, '_');

async function importCollection(collection, targetRef, transform, getKey = (doc) => doc._id) {
  const docs = await collection.find({}).toArray();
  let imported = 0;
  let skipped = 0;

  for (const doc of docs) {
    const id = firebaseKey(getKey(toFirebaseValue(doc)));
    const record = transform(toFirebaseValue(doc));
    if (String(doc._id) !== id) record.mongoId = String(doc._id);
    record._id = id;

    if (isApply) {
      const result = await targetRef.child(id).transaction((current) => current === null ? record : undefined);
      if (result.committed) imported += 1;
      else skipped += 1;
    }
  }

  console.log(`${collection.collectionName}: ${docs.length} found, ${imported} imported${isApply ? `, ${skipped} existing Firebase records preserved` : ' (preview only)'}`);
}

async function main() {
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15000 });
  const firebaseDb = database();
  try {
    await client.connect();
    const databaseName = process.env.MONGODB_DATABASE || new URL(mongoUri).pathname.slice(1).split('/')[0];
    const mongoDb = client.db(databaseName || undefined);
    console.log(`MongoDB database: ${mongoDb.databaseName}`);
    console.log(isApply ? 'Import mode: write to Firebase' : 'Import mode: preview (use --apply to write)');

    await importCollection(
      mongoDb.collection(process.env.MONGODB_USERS_COLLECTION || 'users'),
      firebaseDb.ref('users'),
      (user) => ({
        ...user,
        name: user.name || user.fullName || '',
        fullName: user.fullName || user.name || '',
        role: String(user.role || 'employee').toLowerCase()
      })
    );

    await importCollection(
      mongoDb.collection(process.env.MONGODB_ATTENDANCE_COLLECTION || 'attendances'),
      firebaseDb.ref('attendance'),
      (record) => record,
      (record) => record.user && record.date ? `${record.user}_${record.date}` : record._id
    );
  } finally {
    await client.close();
    firebaseDb.goOffline();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
