const { database } = require('../controllers/firebase');

const usersRef = () => database().ref('users');

const normalizeUser = (user, id) => ({
  ...user,
  name: user.name || user.fullName || '',
  role: (user.role || 'employee').toLowerCase(),
  _id: id
});

exports.findByEmail = async (email) => {
  if (!email) return null;
  const snapshot = await usersRef().orderByChild('email').equalTo(email).limitToFirst(1).once('value');
  const value = snapshot.val();
  if (!value) return null;
  const [id, user] = Object.entries(value)[0];
  return normalizeUser(user, id);
};

exports.findByUserId = async (userId) => {
  if (!userId) return null;
  const snapshot = await usersRef().orderByChild('userId').equalTo(userId).limitToFirst(1).once('value');
  const value = snapshot.val();
  if (!value) return null;
  const [id, user] = Object.entries(value)[0];
  return normalizeUser(user, id);
};

exports.findById = async (id) => {
  const snapshot = await usersRef().child(id).once('value');
  const user = snapshot.val();
  return user ? normalizeUser(user, snapshot.key) : null;
};

exports.create = async (userData) => {
  const ref = usersRef().push();
  const user = { ...userData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await ref.set(user);
  return normalizeUser(user, ref.key);
};

exports.updateById = async (id, changes) => {
  const ref = usersRef().child(id);
  const snapshot = await ref.once('value');
  if (!snapshot.exists()) return null;
  await ref.update({ ...changes, updatedAt: new Date().toISOString() });
  const updated = await ref.once('value');
  return normalizeUser(updated.val(), id);
};

exports.deleteById = async (id) => {
  const ref = usersRef().child(id);
  const snapshot = await ref.once('value');
  if (!snapshot.exists()) return false;
  await ref.remove();
  return true;
};

exports.findAll = async () => {
  const snapshot = await usersRef().once('value');
  const value = snapshot.val() || {};
  return Object.entries(value).map(([id, user]) => {
    const { password, ...safeUser } = user;
    return normalizeUser(safeUser, id);
  });
};
