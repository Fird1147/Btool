// server/routes/svn.js
const router    = require('express').Router()
const { spawn } = require('child_process')
const path      = require('path')
const os        = require('os')
const fs        = require('fs')
const requireAuth               = require('../middleware/requireAuth')
const { scanTables, readTable } = require('../services/tableReader')
const { SVN_EXE }               = require('../config')

router.use(requireAuth)

// ── helpers ──────────────────────────────────────────────────────────────────

function runProcess(exe, args) {
  return new Promise((resolve, reject) => {
    const outChunks = [], errChunks = []
    let proc
    try {
      proc = spawn(exe, args, { shell: false })
    } catch (e) {
      return reject(e)
    }
    proc.stdout.on('data', d => outChunks.push(d))
    proc.stderr.on('data', d => errChunks.push(d))
    proc.on('error', reject)
    proc.on('close', code => resolve({
      stdout: Buffer.concat(outChunks),
      stderr: Buffer.concat(errChunks).toString('utf8'),
      code,
    }))
  })
}

function parseSvnLogXml(xml) {
  const entries = []
  const entryRe = /<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/g
  let m
  while ((m = entryRe.exec(xml)) !== null) {
    const inner  = m[2]
    const author = (inner.match(/<author>(.*?)<\/author>/)    || [])[1] || ''
    const date   = (inner.match(/<date>(.*?)<\/date>/)        || [])[1] || ''
    const msg    = (inner.match(/<msg>([\s\S]*?)<\/msg>/)     || [])[1]?.trim() || ''
    entries.push({ rev: parseInt(m[1], 10), author, date, msg })
  }
  return entries
}

function svnNotFoundError(res) {
  return res.status(503).json({
    error: 'SVN 命令行工具未安装。请重新安装 TortoiseSVN 并勾选 "Command Line Client Tools"，然后重启 biaotool 服务器。',
  })
}

// ── GET /api/svn/log?name=&limit=30 ─────────────────────────────────────────
router.get('/log', async (req, res) => {
  const { name, limit } = req.query
  if (!name) return res.status(400).json({ error: 'name is required' })

  const tables = scanTables()
  const entry  = tables.find(t => t.name === name && t.kind === 'xlsx')
  if (!entry) return res.status(404).json({ error: 'Table not found' })

  const lim = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100)

  try {
    const { stdout, stderr, code } = await runProcess(SVN_EXE, [
      'log', '--xml', '-l', String(lim), entry.path,
    ])
    if (code !== 0) return res.status(500).json({ error: stderr || 'svn log 失败' })
    res.json(parseSvnLogXml(stdout.toString('utf8')))
  } catch (err) {
    if (err.code === 'ENOENT') return svnNotFoundError(res)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/svn/cat?name=&rev= ──────────────────────────────────────────────
router.get('/cat', async (req, res) => {
  const { name, rev } = req.query
  if (!name) return res.status(400).json({ error: 'name is required' })
  if (!rev || !/^\d+$/.test(rev)) return res.status(400).json({ error: 'rev must be a positive integer' })

  const tables = scanTables()
  const entry  = tables.find(t => t.name === name && t.kind === 'xlsx')
  if (!entry) return res.status(404).json({ error: 'Table not found' })

  const tmpFile = path.join(os.tmpdir(), `biaotool_svn_r${rev}_${name}_${Date.now()}.xlsx`)

  try {
    const { stdout, stderr, code } = await runProcess(SVN_EXE, [
      'cat', '-r', rev, entry.path,
    ])
    if (code !== 0) return res.status(500).json({ error: stderr || 'svn cat 失败' })
    if (stdout.length === 0) return res.status(404).json({ error: `r${rev} 该文件无内容` })

    fs.writeFileSync(tmpFile, stdout)
    const tableData = readTable(tmpFile)
    res.json(tableData)
  } catch (err) {
    if (err.code === 'ENOENT') return svnNotFoundError(res)
    res.status(500).json({ error: err.message })
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch (_) {}
  }
})

module.exports = router
