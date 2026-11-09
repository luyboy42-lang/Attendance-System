(() => {
  const isAdmin = () => {
    try { return String(JSON.parse(localStorage.getItem('user') || '{}').role || '').toLowerCase() === 'admin'; }
    catch { return false; }
  };
  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    'Content-Type': 'application/json'
  });
  const readResponse = async (response) => {
    const text = await response.text();
    try { return text ? JSON.parse(text) : {}; }
    catch {
      throw new Error('The attendance API returned HTML instead of JSON. Restart the backend from the backend folder, then reload this page.');
    }
  };
  const timeForInput = (value) => {
    if (!value) return '';
    const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return '';
    let hour = Number(match[1]);
    if (match[4]) hour = (hour % 12) + (match[4].toUpperCase() === 'PM' ? 12 : 0);
    return `${String(hour).padStart(2, '0')}:${match[2]}:${match[3] || '00'}`;
  };
  const refreshAttendanceViews = async () => {
    if (typeof fetchLiveAttendance === 'function') await fetchLiveAttendance();
    if (typeof loadMonthlyReport === 'function') await loadMonthlyReport();
  };

  window.openAttendanceEditor = (recordId) => {
    if (!isAdmin()) return alert('Admin access is required.');
    const record = window.attendanceRecordCache?.get(recordId);
    if (!record) return alert('Record is no longer available. Reload the attendance list.');
    document.getElementById('attendanceRecordId').value = record._id;
    document.getElementById('attendanceEditUserId').value = record.userId || '';
    document.getElementById('attendanceEditDate').value = record.date || '';
    document.getElementById('attendanceEditCheckIn').value = timeForInput(record.checkInTime);
    document.getElementById('attendanceEditCheckOut').value = timeForInput(record.checkOutTime);
    document.getElementById('attendanceEditStatus').textContent = 'Changes are recorded in the admin correction history.';
    document.getElementById('attendanceEditModal').classList.remove('hidden');
  };

  window.closeAttendanceEditor = () => document.getElementById('attendanceEditModal').classList.add('hidden');

  window.saveAttendanceCorrection = async (event) => {
    event.preventDefault();
    if (!isAdmin()) return alert('Admin access is required.');
    const id = document.getElementById('attendanceRecordId').value;
    const status = document.getElementById('attendanceEditStatus');
    status.textContent = 'Saving correction...';
    try {
      const response = await fetch(window.apiUrl(`/api/attendance/${encodeURIComponent(id)}`), {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({
          userId: document.getElementById('attendanceEditUserId').value.trim(),
          date: document.getElementById('attendanceEditDate').value,
          checkInTime: document.getElementById('attendanceEditCheckIn').value,
          checkOutTime: document.getElementById('attendanceEditCheckOut').value
        })
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.message || `Request failed (${response.status})`);
      closeAttendanceEditor();
      await refreshAttendanceViews();
    } catch (error) {
      status.textContent = error.message || 'Unable to save correction.';
    }
  };

  window.deleteAttendanceCorrection = async () => {
    if (!isAdmin()) return alert('Admin access is required.');
    const id = document.getElementById('attendanceRecordId').value;
    if (!confirm('Delete this attendance record? The deletion will be recorded in the admin correction history.')) return;
    const status = document.getElementById('attendanceEditStatus');
    status.textContent = 'Deleting record...';
    try {
      const response = await fetch(window.apiUrl(`/api/attendance/${encodeURIComponent(id)}`), {
        method: 'DELETE', headers: authHeaders()
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.message || `Request failed (${response.status})`);
      closeAttendanceEditor();
      await refreshAttendanceViews();
    } catch (error) {
      status.textContent = error.message || 'Unable to delete attendance record.';
    }
  };
})();
