const bcrypt = require('bcrypt')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 ? args[idx + 1] : null
}
const username = getArg('username')
const password = getArg('password')

if (!username || !password) {
  console.error('Usage: node scripts/add-user.js --username <name> --password <pass>')
  process.exit(1)
}

const USERS_FILE = path.join(__dirname, '../server/data/users.json')
const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))

if (users.find(u => u.username === username)) {
  console.error(`User "${username}" already exists`)
  process.exit(1)
}

bcrypt.hash(password, 10).then(passwordHash => {
  users.push({ username, passwordHash })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  console.log(`User "${username}" added.`)
})
