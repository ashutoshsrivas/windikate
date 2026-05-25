# Windikate · Investment Analysis Workflow

A multi-phase web application for investment analysts — onboarding, deck upload,
intelligence layer (deviation, competitors, questions), and a report dashboard
with Memo generation.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Bootstrap Icons |
| Backend  | Node.js, Express 4, Multer (uploads), JWT auth |
| Database | MySQL 8 |
| File storage | Local disk (`backend/uploads`) — swap for S3 in prod |

## Project structure

```
analysis-app/
├── backend/                 Express API + analysis services
│   ├── server.js
│   ├── db/                  pool + schema.sql
│   ├── routes/              REST routes
│   ├── controllers/         route handlers
│   ├── middleware/          auth, error
│   ├── services/            schema mapping, deviation, competitor, question, apercept
│   └── uploads/             stored decks
└── frontend/                Next.js dashboard
    ├── app/                 App Router pages
    │   ├── onboarding/      Phase 1
    │   ├── dashboard/       Phase 2 (upload + recent analyses)
    │   └── dashboard/analyses/[id]/    Phase 4 (report, question, call, apercept, memo)
    ├── components/          UploadZone, ReportTabs, DeviationCard, etc.
    └── lib/api.js           fetch wrapper
```

## Quick start

### 1 · Database

```bash
mysql -u root -p < backend/db/schema.sql
```

### 2 · Backend (port 4000)

```bash
cd backend
cp .env.example .env       # fill in DB creds + JWT_SECRET
npm install
npm run dev
```

### 3 · Frontend (port 3000)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000> — you'll land on onboarding for first run.

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register | Create analyst account |
| POST | /api/auth/login | Issue JWT |
| GET  | /api/users/me | Current profile |
| PUT  | /api/users/me/onboarding | Save Phase 1 + Phase 1.2 data |
| POST | /api/analyses | Multipart upload of deck + financials, starts analysis |
| GET  | /api/analyses | List analyst's analyses |
| GET  | /api/analyses/:id | Full analysis (metrics + deviations + competitors + questions) |
| PUT  | /api/analyses/:id/deviations/:devId | Edit severity, add citation |
| PUT  | /api/analyses/:id/questions/:qId | Edit question text |
| POST | /api/analyses/:id/memo | Generate IC memo in chosen format |

## Notes

- The intelligence layer in `backend/services/` runs synchronously and returns
  deterministic mock output for demonstration. Wire it to your real AI pipeline by
  replacing the function bodies — the data contracts are stable.
- File upload caps at 25 MB per file. Tighten in `routes/analysis.routes.js`.
- Analyst-edited deviation severity is persisted to `deviations.edited_severity`
  and treated as the "OK standard" on subsequent views.
