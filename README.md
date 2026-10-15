# Aarvi Property – Backend API

Node.js + Express + MongoDB (Mongoose). JWT admin auth, file uploads, enquiries, CMS content.

## Run locally
```bash
cp .env.example .env           # fill MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run db                     # (optional) start a local MongoDB in ./.data
npm run seed                   # admin user + categories, locations, developers, 300+ projects, blogs
npm run dev                    # http://localhost:5001
```

## Environment variables
See `.env.example`. Important ones for production:
- `MONGODB_URI` – MongoDB Atlas connection string
- `JWT_SECRET` – long random string (the server refuses to start in production without it)
- `CLIENT_URL` – your website URL (comma separated list is allowed)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` – first admin created by `npm run seed`
- `SMTP_*`, `MAIL_TO` – optional email alerts for new enquiries

## Deploy
Needs a host with a **persistent disk** (uploads are stored in `uploads/`), e.g. Render, Railway, Fly.io or a VPS.
Build command: `npm install` · Start command: `npm start` · set `NODE_ENV=production`.
Then run `npm run seed` once (use a shell on the host).

## Tests
```bash
npm test      # 62 API integration tests (uses the database aarvi_property_test)
```
