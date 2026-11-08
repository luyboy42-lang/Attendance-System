const { database } = require('../controllers/firebase');

const attendanceRef = () => database().ref('attendance');

exports.createForUserAndDate = async (userId, date, attendance) => {
  const ref = attendanceRef().child(`${userId}_${date}`);
  const result = await ref.transaction((current) => current === null ? attendance : undefined);
  return result.committed ? { ...result.snapshot.val(), _id: ref.key } : null;
};

exports.findForUserAndDate = async (userId, date) => {
  const snapshot = await attendanceRef().child(`${userId}_${date}`).once('value');
  return snapshot.exists() ? { ...snapshot.val(), _id: snapshot.key } : null;
};

exports.update = async (id, changes) => {
  const ref = attendanceRef().child(id);
  await ref.update({ ...changes, updatedAt: new Date().toISOString() });
  const snapshot = await ref.once('value');
  return { ...snapshot.val(), _id: snapshot.key };
};

exports.findForUser = async (userId) => {
  const snapshot = await attendanceRef().orderByChild('user').equalTo(userId).once('value');
  const value = snapshot.val() || {};
  return Object.entries(value)
    .map(([id, record]) => ({ ...record, _id: id }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

exports.findForDate = async (date) => {
  const snapshot = await attendanceRef().orderByChild('date').equalTo(date).once('value');
  const value = snapshot.val() || {};
  return Object.entries(value).map(([id, record]) => ({ ...record, _id: id }));
};
