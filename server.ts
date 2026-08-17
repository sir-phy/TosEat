import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import express from 'express'
import { createExpressApp } from './server/app.js'
import { initSocketIO } from './server/socket.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = createExpressApp()
const httpServer = createServer(app)

// Initialize Socket.IO
initSocketIO(httpServer)

// Serve static frontend in production
const distPath = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
  ? path.join(__dirname, 'dist')
  : fs.existsSync(path.join(__dirname, 'index.html'))
    ? __dirname
    : path.resolve(process.cwd(), 'dist')

app.use(express.static(distPath))

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = 3000

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GoMeal Backend Server & Socket.IO running on http://0.0.0.0:${PORT}`)
})

