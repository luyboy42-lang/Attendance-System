// Scanner helper module
let html5QrCode = null;
let scanRequestPending = false;
function showScanResult(state, message) {
    const el = document.getElementById('scanResult');
    if (!el) return;
    el.dataset.state = state;
    el.textContent = message;
    el.classList.remove('hidden');
}
let currentScanType = 'checkin'; // áž€áŸ†ážŽážáŸ‹áž”áŸ’ážšáž—áŸáž‘ážŸáŸ’áž€áŸ‚áž“áž”áž…áŸ’áž…áž»áž”áŸ’áž”áž“áŸ’áž“

function activateCamera(type) {
    if (!localStorage.getItem('token')) {
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
    }
    currentScanType = type; // ážšáž€áŸ’ážŸáž¶áž‘áž»áž€áž”áŸ’ážšáž—áŸáž‘ážŸáŸ’áž€áŸ‚áž“ (checkin áž¬ checkout)
    if (!navigator.geolocation) {
        showScanResult('location', 'សូមបើក GPS និងអនុញ្ញាតសេវាទីតាំង ដើម្បីស្កេនវត្តមាន។');
        return;
    }
    showScanResult('location', 'កំពុងពិនិត្យ GPS…');
    navigator.geolocation.getCurrentPosition(
        () => startAttendanceCamera(),
        (error) => {
            console.warn('GPS check failed:', error);
            const message = error.code === 1
                ? 'សូមអនុញ្ញាតសេវាទីតាំង (Location) ក្នុង Browser ហើយបើក GPS រួចព្យាយាមម្ដងទៀត។'
                : error.code === 2
                    ? 'រកទីតាំងមិនឃើញទេ។ សូមបើក GPS/Location លើឧបករណ៍ ហើយព្យាយាមម្ដងទៀត។'
                    : 'ទីតាំងមិនឆ្លើយតប។ សូមបើក GPS ហើយព្យាយាមម្ដងទៀត។';
            showScanResult('location', message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function startAttendanceCamera() {
    const feed = document.getElementById('simulatedCamFeed');
    if (feed) {
        feed.style.opacity = '0';
        setTimeout(() => { feed.style.display = 'none'; }, 300);
    }

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (width, height) => { const size = Math.min(420, Math.floor(Math.min(width, height) * 0.78)); return { width: size, height: size }; } },
        (decodedText, decodedResult) => {
            if (scanRequestPending) return;
            scanRequestPending = true;
            handleScanSuccess(decodedText, currentScanType);
        },
        (errorMessage) => {
            // scanning progress/error
        }
    ).catch(err => {
        console.error("Camera start failed.", err);
        showScanResult('error', 'មិនអាចបើកកាមេរ៉ាបានទេ។ សូមអនុញ្ញាត Camera permission ហើយព្យាយាមម្ដងទៀត។');
    });
}

function handleScanSuccess(qrData, scanType) {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            const feed = document.getElementById('simulatedCamFeed');
            if (feed) {
                feed.style.display = 'flex';
                setTimeout(() => { feed.style.opacity = '1'; }, 50);
            }
            // áž áŸ…áž˜áž»ážáž„áž¶ážšáž”áž‰áŸ’áž‡áž¼áž“áž‘áž·áž“áŸ’áž“áž“áŸáž™áž‘áŸ…áž€áž¶áž“áŸ‹ Server áž–áŸ’ážšáž˜áž‘áž¶áŸ†áž„áž•áŸ’áž‰áž¾ scanType áž‘áŸ…áž‡áž¶áž˜áž½áž™
            handleAttendanceScan(qrData, scanType);
        }).catch(err => console.error(err));
    } else {
        handleAttendanceScan(qrData, scanType);
    }
}

// áž˜áž»ážáž„áž¶ážšáž¢áž¶áž“ QR áž–áž¸ File áž‡áž¶áž˜áž½áž™áž€áž¶ážšáž€áŸ†ážŽážáŸ‹áž”áŸ’ážšáž—áŸáž‘ (Default áž‚ážº checkin áž¬áž¢áž¶áž…áž‘áž¶áž‰áž–áž¸ UI áž”áž¶áž“)
function decodeQRFromFile(event, type = 'checkin') {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    console.log('QR Code Data Found:', code.data);
                    // áž•áŸ’áž‰áž¾ code.data áž“áž·áž„ type áž‘áŸ…áž€áž¶áž“áŸ‹ handleAttendanceScan
                    handleAttendanceScan(code.data, type);
                } else {
                    alert('ážšáž€áž˜áž·áž“ážƒáž¾áž‰ QR Code áž€áŸ’áž“áž»áž„ážšáž¼áž”áž—áž¶áž–áž“áŸáŸ‡áž‘áŸ ážŸáž¼áž˜áž–áŸ’áž™áž¶áž™áž¶áž˜áž˜áŸ’ážáž„áž‘áŸ€áž!');
                }
            } else {
                alert('à¸à¸£à¸¸à¸“áž¶áž”áž‰áŸ’áž…áž¼áž› jsQR library áž€áŸ’áž“áž»áž„ HTML ážšáž”ážŸáŸ‹áž¢áŸ’áž“áž€áž‡áž¶áž˜áž»áž“ážŸáž·áž“!');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// áž˜áž»ážáž„áž¶ážšáž•áŸ’áž‰áž¾áž‘áž·áž“áŸ’áž“áž“áŸáž™áž‘áŸ…áž€áž¶áž“áŸ‹ Backend API
async function handleAttendanceScan(qrCodeData, type = 'checkin') {
  try {
    // áž–áž·áž“áž·ážáŸ’áž™áž˜áŸ‰áŸ„áž„áž“áŸ…à¸à¸±à¹ˆà¸‡ Client áž‡áž¶áž˜áž»áž“ážŸáž·áž“
    if (!navigator.geolocation) {
      showScanResult('location', 'ឧបករណ៍នេះមិនគាំទ្រ GPS ទេ។ មិនអាចកត់ត្រាវត្តមានបានឡើយ។'); scanRequestPending = false;
      return;
    }
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
    }).catch((error) => {
      const message = error.code === 1
        ? 'សូមអនុញ្ញាតសេវាទីតាំង (Location) ក្នុង Browser ដើម្បីកត់ត្រាវត្តមាន។'
        : error.code === 2
          ? 'រកទីតាំងមិនឃើញទេ។ សូមបើក GPS/Location លើឧបករណ៍ ហើយព្យាយាមម្ដងទៀត។'
          : 'ទីតាំងមិនឆ្លើយតប។ សូមបើក GPS ហើយព្យាយាមម្ដងទៀត។';
      showScanResult('location', message); scanRequestPending = false;
      return null;
    });
    if (!position) return;

    // Server verifies these coordinates against the admin geofence.
    const endpoint = type === 'checkin' 
      ? window.apiUrl('/api/attendance/checkin')
      : window.apiUrl('/api/attendance/checkout');
    
    const token = localStorage.getItem('token'); // áž‘áž¶áž‰áž™áž€ Token ážšáž”ážŸáŸ‹áž¢áŸ’áž“áž€

    const response = await fetch(endpoint, {
      method: type === 'checkin' ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        qrCode: qrCodeData,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data.message || 'ស្កេនមិនបានជោគជ័យទេ។'; const locationIssue = /location|gps|geofence|distance|meter|ទីតាំង|ចម្ងាយ/i.test(message); showScanResult(locationIssue ? 'location' : 'error', locationIssue ? `ខុសទីតាំង GPS៖ ${message}` : `ស្កេនមិនបាន៖ ${message}`); scanRequestPending = false;
    } else {
      const recordedTime = type === 'checkin' ? data.checkInTime : data.checkOutTime;
      showScanResult('success', `ស្កេនបានជោគជ័យ! ${type === 'checkin' ? 'ចូល' : 'ចេញ'} ម៉ោង ${recordedTime || 'បានកត់ត្រា'}`); scanRequestPending = false;
      setTimeout(() => location.reload(), 1800);
    }
  } catch (err) {
    console.error('Error handling scan:', err);
    showScanResult('error', 'មិនអាចភ្ជាប់ទៅ Server បានទេ។ សូមព្យាយាមម្ដងទៀត។'); scanRequestPending = false;
  }
}
