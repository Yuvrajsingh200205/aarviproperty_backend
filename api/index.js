// Vercel serverless entry: every request is rewritten here (see vercel.json).
const mongoose = require('mongoose');
const app = require('../src/app');

let connecting;

async function connect() {
  if (mongoose.connection.readyState === 1) return;
  if (!process.env.MONGODB_URI) {
    const err = new Error('MONGODB_URI is not configured on this deployment');
    err.code = 'NO_DB_URI';
    throw err;
  }
  if (!connecting) {
    mongoose.set('strictQuery', true);
    connecting = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .catch((e) => {
        connecting = null; // retry on the next request
        throw e;
      });
  }
  await connecting;
}

module.exports = async (req, res) => {
  // health check should answer even when the database is not reachable
  if (!(req.url || '').startsWith('/api/health')) {
    try {
      await connect();
    } catch (err) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, message: err.code === 'NO_DB_URI' ? err.message : 'Database unavailable' }));
    }
  }
  return app(req, res);
};
