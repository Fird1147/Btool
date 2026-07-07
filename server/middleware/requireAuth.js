module.exports = function requireAuth(req, res, next) {
  if (req.session && req.session.username) return next()
  res.status(401).json({ error: 'Not authenticated' })
}
