// server.js
const express = require('express')
const multer = require('multer')
const upload = multer()
const app = express()

// parse-pto: receives the image, returns fake/demo data
app.post('/api/parse-pto', upload.single('file'), async (req, res) => {
  // TODO: here you’d run OCR / LLM on req.file.buffer
  // For now, we’ll just return a hard-coded demo:
  return res.json([
    { name: 'Heather', days: ['Monday', 'Wednesday'] },
    { name: 'Sheridan', days: ['Tuesday'] }
  ])
})

// serve on port 5000
const port = 5000
app.listen(port, () => console.log(`☁️  API listening on http://localhost:${port}`))
