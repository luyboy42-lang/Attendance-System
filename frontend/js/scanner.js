// Scanner helper module
let html5QrCode = null;
let currentScanType = 'checkin'; // កំណត់ប្រភេទស្កែនបច្ចុប្បន្ន

function activateCamera(type) {
    currentScanType = type; // រក្សាទុកប្រភេទស្កែន (checkin ឬ checkout)
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
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText, decodedResult) => {
            handleScanSuccess(decodedText, currentScanType);
        },
        (errorMessage) => {
            // scanning progress/error
        }
    ).catch(err => {
        console.error("Camera start failed.", err);
        alert("មិនអាចបើកកាមេរ៉ាបានទេ! សូមពិនិត្យ Permission កាមេរ៉ារបស់ Browser");
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
            // ហៅមុខងារបញ្ជូនទិន្នន័យទៅកាន់ Server ព្រមទាំងផ្ញើ scanType ទៅជាមួយ
            handleAttendanceScan(qrData, scanType);
        }).catch(err => console.error(err));
    } else {
        handleAttendanceScan(qrData, scanType);
    }
}

// មុខងារអាន QR ពី File ជាមួយការកំណត់ប្រភេទ (Default គឺ checkin ឬអាចទាញពី UI បាន)
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
                    // ផ្ញើ code.data និង type ទៅកាន់ handleAttendanceScan
                    handleAttendanceScan(code.data, type);
                } else {
                    alert('រកមិនឃើញ QR Code ក្នុងរូបភាពនេះទេ សូមព្យាយាមម្តងទៀត!');
                }
            } else {
                alert('กรุณាបញ្ចូល jsQR library ក្នុង HTML របស់អ្នកជាមុនសិន!');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// មុខងារផ្ញើទិន្នន័យទៅកាន់ Backend API
async function handleAttendanceScan(qrCodeData, type = 'checkin') {
  try {
    // ពិនិត្យម៉ោងនៅฝั่ง Client ជាមុនសិន
    if (!navigator.geolocation) {
      alert('This device does not support location services. Location is required to record attendance.');
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
        ? 'Location permission is required to record attendance. Please allow location access and try again.'
        : 'Could not get an accurate location. Please enable GPS and try again.';
      alert(message);
      return null;
    });
    if (!position) return;

    // Server verifies these coordinates against the admin geofence.
    const endpoint = type === 'checkin' 
      ? window.apiUrl('/api/attendance/checkin')
      : window.apiUrl('/api/attendance/checkout');
    
    const token = localStorage.getItem('token'); // ទាញយក Token របស់អ្នក

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
      alert(data.message || 'មានបញ្ហាក្នុងការស្កែន!');
    } else {
      const recordedTime = type === 'checkin' ? data.checkInTime : data.checkOutTime;
      alert(`ស្កែន (${type.toUpperCase()}) ជោគជ័យ!\nម៉ោងកត់ត្រា៖ ${recordedTime}`);
      location.reload(); // ផ្ទុកទំព័រឡើងវិញដើម្បីអាប់ដេតតារាងបង្ហាញម៉ោងជាក់ស្តែង
    }
  } catch (err) {
    console.error('Error handling scan:', err);
    alert('មិនអាចតភ្ជាប់ទៅកាន់ Server បានទេ!');
  }
}
