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

exports.findById = async (id) => {
  const snapshot = await attendanceRef().child(id).once('value');
  return snapshot.exists() ? { ...snapshot.val(), _id: snapshot.key } : null;
};

exports.correct = async (id, attendance, actorId) => {
  const before = await exports.findById(id);
  if (!before) return null;
  const newId = `${attendance.user}_${attendance.date}`;
  const auditRef = database().ref('attendanceCorrections').push();
  const audit = {
    action: 'update', recordId: newId, previousRecordId: id, actorId,
    before: pickAuditFields(before), after: pickAuditFields(attendance),
    changedAt: new Date().toISOString()
  };
  const updates = { [`attendanceCorrections/${auditRef.key}`]: audit };
  if (newId !== id) {
    updates[`attendance/${id}`] = null;
    updates[`attendance/${newId}`] = { ...attendance, updatedAt: audit.changedAt };
  } else {
    updates[`attendance/${id}`] = { ...attendance, updatedAt: audit.changedAt };
  }
  await database().ref().update(updates);
  return { ...attendance, _id: newId };
};

exports.removeWithAudit = async (id, actorId) => {
  const before = await exports.findById(id);
  if (!before) return null;
  const auditRef = database().ref('attendanceCorrections').push();
  const audit = {
    action: 'delete', recordId: id, actorId,
    before: pickAuditFields(before), after: null,
    changedAt: new Date().toISOString()
  };
  await database().ref().update({
    [`attendance/${id}`]: null,
    [`attendanceCorrections/${auditRef.key}`]: audit
  });
  return before;
};

function pickAuditFields(record) {
  return {
    user: record.user || null,
    userId: record.userId || null,
    date: record.date || null,
    checkInTime: record.checkInTime || null,
    checkOutTime: record.checkOutTime || null,
    status: record.status || null
  };
}

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

exports.findForMonth = async (month) => {
  const snapshot = await attendanceRef()
    .orderByChild('date')
    .startAt(`${month}-01`)
    .endAt(`${month}-31`)
    .once('value');
  const value = snapshot.val() || {};
  return Object.entries(value)
    .map(([id, record]) => ({ ...record, _id: id }))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.user).localeCompare(String(b.user)));
};

exports.findForYear = async (year) => {
  const snapshot = await attendanceRef()
    .orderByChild('date')
    .startAt(`${year}-01-01`)
    .endAt(`${year}-12-31`)
    .once('value');
  const value = snapshot.val() || {};
  return Object.entries(value)
    .map(([id, record]) => ({ ...record, _id: id }))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.user).localeCompare(String(b.user)));
};
