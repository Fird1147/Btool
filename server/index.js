const express = require('express')
const session = require('express-session')
const http = require('http')
const path = require('path')
const { SESSION_SECRET, PORT } = require('./config')

const app = express()
app.use(express.json())
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production' },
}))

// Routes (filled in later tasks)
app.use('/api/auth',   require('./routes/auth'))
app.use('/api/tables', require('./routes/tables'))
app.use('/api/tables', require('./routes/write'))
app.use('/api/logs',   require('./routes/logs'))
app.use('/api/search', require('./routes/search'))
app.use('/api/svn',    require('./routes/svn'))

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')))
  app.get('*', (_, res) =>
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  )
}

const server = http.createServer(app)
require('./services/presence').attach(server)
require('./services/searchIndex').startBuild()

server.listen(PORT, '0.0.0.0', () =>
  console.log(`biaotool running on http://0.0.0.0:${PORT}`)
)
