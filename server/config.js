const path = require('path')

module.exports = {
  TABLES_ROOT: path.resolve(__dirname, '../../branches/<branch>/3xlsx'),
  SESSION_SECRET: (() => {
    if (!process.env.SESSION_SECRET) {
      console.warn('[biaotool] WARNING: SESSION_SECRET not set, using insecure default. Set SESSION_SECRET env var in production.')
    }
    return process.env.SESSION_SECRET || 'biaotool-dev-secret'
  })(),
  PORT: process.env.PORT || 3000,
}
