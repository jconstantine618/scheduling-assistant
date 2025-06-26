// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { google } = require('googleapis');

const upload = multer();
const app = express();

// pull in environment vars
const {
  PORT = 5000,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_CALENDAR_ID,
} = process.env;

// middleware
app.use(cors());
app.use(express.json());

// OCR endpoint: parse image & return fake PTO data
app.post('/api/parse-pto', upload.single('file'), async (req, res) => {
  // TODO: plug in real OCR/LLM on req.file.buffer
  return res.json({
    pto: [
      { name: 'Heather', days: ['Monday', 'Wednesday'] },
      { name: 'Sheridan', days: ['Tuesday'] },
    ]
  });
});

// Calendar PTO endpoint: fetch from your Google Calendar
process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_APPLICATION_CREDENTIALS;
app.get('/api/pto-calendar', async (req, res) => {
  try {
    const { start, end } = req.query;
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

    // fold into { name: [ '2025-06-21', ... ], ... }
    const ptoMap = {};
    for (const evt of result.data.items) {
      const who = evt.summary;
      const date = (evt.start.date || evt.start.dateTime).split('T')[0];
      ptoMap[who] = ptoMap[who] || [];
      ptoMap[who].push(date);
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
  console.log(`🔑 OpenAI key= ${!!process.env.OPENAI_API_KEY}`);
  console.log(`🌐 Calendar ID → ${GOOGLE_CALENDAR_ID}`);
  console.log(`☁️ API listening on http://0.0.0.0:${PORT}`);
});
