require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5001,
  mongoUri: isTest
    ? process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/aarvi_property_test'
    : process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aarvi_property',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@aarviproperty.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',
  adminName: process.env.ADMIN_NAME || 'Aarvi Admin',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO,
  },
};

if (env.isProd && env.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
