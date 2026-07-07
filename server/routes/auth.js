const router = require('express').Router()
const bcrypt = require('bcrypt')
const fs = require('fs')
const path = require('path')

const USERS_FILE = path.join(__dirname, '../data/users.json')

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) }
  catch { return [] }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' })

  const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu'
  const users = loadUsers()
  const user = users.find(u => u.username === username)
  const hash = user ? user.passwordHash : DUMMY_HASH
  const match = await bcrypt.compare(password, hash)
  if (!user || !match) return res.status(401).json({ error: 'Invalid credentials' })

  req.session.username = username
  res.json({ username })
})

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

router.get('/me', (req, res) => {
  if (req.session.username) return res.json({ username: req.session.username })
  res.status(401).json({ error: 'Not authenticated' })
})

module.exports = router
