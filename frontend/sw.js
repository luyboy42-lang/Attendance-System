self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "ដាស់តឿនវត្តមាន (Attendance Notification)";
  const options = {
    body: data.body || "ជិតដល់ម៉ោងបញ្ចប់ការងារហើយ! សូមកុំភ្លេច Scan Check-out។",
    icon: "/icon-192.png",
    badge: "/icon-192.png"
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});