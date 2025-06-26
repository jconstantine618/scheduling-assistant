// server.js

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import openai from 'openai';
// import ptoParser from './src/pto-parser.js';    ← comment this out
import { google } from 'googleapis';

const {
  PORT = 5001,
  OPENAI_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_CALENDAR_ID,
} = process.env;

openai.apiKey = OPENAI_API_KEY;
process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_APPLICATION_CREDENTIALS;

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(process.cwd(), 'build')));

// OCR endpoint
// app.post('/api/parse-pto', ptoParser);         ← comment this out

app.get('/api/pto-calendar', async (req, res) => {
  /* … your calendar code … */
});

// catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🔑 OpenAI key= ${!!OPENAI_API_KEY}`);
  console.log(`🌐 Calendar ID       → ${GOOGLE_CALENDAR_ID}`);
  console.log(`☁️  API listening on http://0.0.0.0:${PORT}`);
});
