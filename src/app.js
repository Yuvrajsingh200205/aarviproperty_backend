const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { UPLOAD_DIR } = require('./middleware/upload');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / server-to-server (no Origin header) and configured sites
      if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(compression());
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(
  '/uploads',
  express.static(UPLOAD_DIR, { maxAge: env.isProd ? '30d' : 0, index: false, fallthrough: false })
);

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

// Only mutating requests are limited. Page renders call this API from the Next.js server (one shared IP),
// so limiting GETs would throttle the whole site. Login and enquiry routes have their own stricter limiters.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 100000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: { success: false, message: 'Too many requests, please slow down' },
});
app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
