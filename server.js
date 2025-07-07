// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer();
const app = express();

const {
  PORT = 5001,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_PTO_CALENDAR_ID,
  GOOGLE_MEETINGS_CALENDAR_ID, // New calendar ID
} = process.env;

const serviceAccountPath = path.resolve(__dirname, GOOGLE_APPLICATION_CREDENTIALS);

const employeeNames = [
  'Antje', 'Adam', 'Heather', 'Sheridan', 'Katy', 'SydPo', 
  'Elliott', 'Brian Adie', 'Paul', 'Shelby', 'SydMo'
];

app.use(cors());
app.use(express.json());

// Helper function to fetch events from a given calendar
async function fetchCalendarEvents(auth, calendarId, timeMin, timeMax) {
    if (!calendarId) return [];
    const calendar = google.calendar({ version: 'v3', auth });
    try {
        const result = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime'
        });
        return result.data.items || [];
    } catch (error) {
        console.error(`Error fetching from calendar ${calendarId}:`, error.message);
        return []; // Return empty array on error to not crash the server
    }
}


// Updated endpoint to fetch from both calendars
app.get('/api/calendar-data', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'Missing start or end date query parameters.' });
    }
    
    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath, 
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    // Fetch events from both calendars in parallel
    const [ptoEvents, meetingEvents] = await Promise.all([
        fetchCalendarEvents(auth, GOOGLE_PTO_CALENDAR_ID, start, end),
        fetchCalendarEvents(auth, GOOGLE_MEETINGS_CALENDAR_ID, start, end)
    ]);

    // Process PTO events (full-day events)
    const ptoMap = {};
    for (const evt of ptoEvents) {
        if (evt.summary) {
            const employeeName = employeeNames.find(name => evt.summary.startsWith(name));
            if (employeeName) {
                const date = (evt.start.date || evt.start.dateTime).split('T')[0];
                ptoMap[employeeName] = ptoMap[employeeName] || [];
                ptoMap[employeeName].push(date);
            }
        }
    }

    // Process Meeting events (events with specific start/end times)
    const meetingsMap = {};
     for (const evt of meetingEvents) {
        if (evt.summary && evt.start.dateTime && evt.end.dateTime) {
             const employeeName = employeeNames.find(name => evt.summary.startsWith(name));
             if(employeeName) {
                if (!meetingsMap[employeeName]) {
                    meetingsMap[employeeName] = [];
                }
                meetingsMap[employeeName].push({
                    start: evt.start.dateTime,
                    end: evt.end.dateTime,
                });
             }
        }
     }

    return res.json({ ptoMap, meetingsMap });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});


app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
);

app.listen(PORT, () => {
  console.log(`🔑 Google Credentials Path = ${serviceAccountPath}`);
  console.log(`🌐 PTO Calendar ID → ${GOOGLE_PTO_CALENDAR_ID}`);
  console.log(`📅 Meetings Calendar ID → ${GOOGLE_MEETINGS_CALENDAR_ID}`);
  console.log(`☁️ API listening on http://localhost:${PORT}`);
});
