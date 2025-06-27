// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

// Replicate __dirname functionality in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer();
const app = express();

const {
  PORT = 5001, // Use port 5001 from .env file
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_CALENDAR_ID,
} = process.env;

// Define the list of known employee names directly in the server
const employeeNames = [
  'Antje', 'Adam', 'Heather', 'Sheridan', 'Katy', 'SydPo', 
  'Elliott', 'Brian Adie', 'Paul', 'Shelby', 'SydMo'
];

// middleware
app.use(cors());
app.use(express.json());

// ... (your other endpoints like parse-pto remain the same)
app.post('/api/parse-pto', upload.single('file'), async (req, res) => {
  return res.json({
    pto: {
        'Heather': ['2025-06-25'],
        'Sheridan': ['2025-06-24'],
    }
  });
});


// Calendar PTO endpoint: fetch from your Google Calendar
process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_APPLICATION_CREDENTIALS;
app.get('/api/pto-calendar', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'Missing start or end date query parameters.' });
    }
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const result = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: start,
      timeMax: end,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const ptoMap = {};
    if (result.data.items) {
        for (const evt of result.data.items) {
            if (evt.summary && (evt.start.date || evt.start.dateTime)) {
                // Find which employee this event summary belongs to
                const employeeName = employeeNames.find(name => evt.summary.startsWith(name));

                if (employeeName) {
                    const date = (evt.start.date || evt.start.dateTime).split('T')[0];
                    ptoMap[employeeName] = ptoMap[employeeName] || [];
                    ptoMap[employeeName].push(date);
                }
            }
        }
    }
    return res.json({ ptoMap });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// if you build React into /build, serve it here
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
);

// kick off the server
app.listen(PORT, () => {
  console.log(`🔑 Google Credentials Path = ${!!process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  console.log(`🌐 Calendar ID → ${GOOGLE_CALENDAR_ID}`);
  console.log(`☁️ API listening on http://localhost:${PORT}`);
});
