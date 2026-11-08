const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();
require('./controllers/firebase');

const userRoutes = require('./controllers/userRoutes');
const attendanceRoutes = require('./controllers/attendanceRoutes');

const app = express();
app.use(express.json());
app.use(cors());

console.log('Firebase Realtime Database configured');

// Routes Mapping
app.use('/api/users', userRoutes);
app.use('/api/auth', userRoutes);
app.use('/api/attendance', attendanceRoutes);

// Serve the frontend over HTTP so its manifest and API calls work outside file://.
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : PORT;
  console.log(`Server running at http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    // If this is already our app, treat a repeated `npm start` as success.
    // This commonly happens when the server is still running in another terminal.
    const request = http.get(`http://127.0.0.1:${PORT}/`, (response) => {
      let page = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { page += chunk; });
      response.on('end', () => {
        if (response.statusCode === 200 && page.includes('<title>User App - Attendance System</title>')) {
          console.log(`Attendance app is already running at http://localhost:${PORT}`);
          process.exitCode = 0;
        } else {
          console.error(`Port ${PORT} is in use by another app. Stop that app or change PORT in backend/.env.`);
          process.exitCode = 1;
        }
      });
    });
    request.setTimeout(2000, () => request.destroy(new Error('Health check timed out')));
    request.on('error', () => {
      console.error(`Port ${PORT} is in use and the attendance app could not be reached. Stop the other process or change PORT in backend/.env.`);
      process.exitCode = 1;
    });
    return;
  }

  console.error('Unable to start the attendance server:', error.message);
  process.exitCode = 1;
});
