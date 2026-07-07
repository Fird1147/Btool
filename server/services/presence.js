// server/services/presence.js
const { WebSocketServer } = require('ws')

// Map<tableName, Map<ws, username>>
const tableClients = new Map()

function attach(httpServer) {
  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws) => {
    ws.on('error', () => {}) // prevent unhandled error crash
    let currentTable = null
    let currentUser = null

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      if (msg.type === 'join') {
        if (currentTable) leave(currentTable, ws)
        currentTable = msg.table
        currentUser = msg.username || 'unknown'
        if (!tableClients.has(currentTable)) tableClients.set(currentTable, new Map())
        tableClients.get(currentTable).set(ws, currentUser)
        broadcast(currentTable)
      }
    })

    ws.on('close', () => {
      if (currentTable) { leave(currentTable, ws); broadcast(currentTable) }
    })
  })
}

function leave(table, ws) {
  if (tableClients.has(table)) {
    tableClients.get(table).delete(ws)
    if (tableClients.get(table).size === 0) tableClients.delete(table)
  }
}

function broadcast(table) {
  const clients = tableClients.get(table)
  if (!clients) return
  const users = [...clients.values()]
  const msg = JSON.stringify({ type: 'presence', table, count: users.length, users })
  for (const [ws] of clients) {
    if (ws.readyState === 1) ws.send(msg)
  }
}

function notifyTableUpdated(table, byUsername) {
  const clients = tableClients.get(table)
  if (!clients) return
  const msg = JSON.stringify({ type: 'table_updated', table, by: byUsername })
  for (const [ws, user] of clients) {
    if (ws.readyState === 1 && user !== byUsername) ws.send(msg)
  }
}

module.exports = { attach, notifyTableUpdated }
