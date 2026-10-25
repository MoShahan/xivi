# Xivi

Xivi is a full-stack social networking platform packaged as an **npm workspaces** monorepo: a Next.js frontend, an Express REST API, and MongoDB.

Share posts with text and images, engage with likes and comments, grow your network through friend requests and one-way follows, and browse rich profiles with friends, followers, and following. The product also includes in-app notifications, OAuth sign-in (Google, GitHub, Discord), admin feature flags, light/dark mode, and ImageKit-backed media - secured with Bearer JWT access and refresh tokens.

**Author:** Mohammed Shahan

**Live app:** [https://xivi.vercel.app](https://xivi.vercel.app) · **API:** [https://xivi-api.onrender.com](https://xivi-api.onrender.com)

---

## Documentation

| Doc                                        | Contents                               |
| ------------------------------------------ | -------------------------------------- |
| [Features](./docs/FEATURES.md)             | What the app does today + coming soon  |
| [Design roadmap](./docs/DESIGN_ROADMAP.md) | UI journey Phases 0–3 with screenshots |
| [API overview](./docs/API.md)              | REST endpoints and auth header         |
| [Database schema](./docs/SCHEMA.md)        | Collections, fields, indexes           |
| [ER diagram](./docs/ERD.md)                | Visual entity relationships            |

---

## Stack

| Layer    | Technologies                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------ |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Material UI 9, Redux Toolkit, Formik, Yup, axios        |
| Backend  | Node.js, Express 4.22, JWT (access + refresh), bcrypt, Multer 2, Helmet, CORS, rate limiting, ImageKit |
| Database | MongoDB + Mongoose 8                                                                                   |

---

## Project structure

```text
Xivi/
├── frontend/          Next.js app (UI)
├── backend/           Express API
│   ├── models/        User, Post, FriendRequest, Notification
│   ├── routes/
│   ├── controllers/
│   └── middleware/
├── docs/              Features, API, schema, ERD
├── package.json       npm workspaces root
└── README.md
```

---

## Requirements

- **Node.js 20+** (CI uses 22)
- **npm 9+** (workspaces)
- **MongoDB** (local or [Atlas](https://www.mongodb.com/atlas))
- **ImageKit** account (for post/avatar image uploads)
- Optional: Google / GitHub / Discord OAuth apps

---

## Quick start

### 1. Install

From the **repo root**:

```bash
npm install
```

### 2. Environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in at least these **backend** values in `backend/.env`:

| Variable                | Required | Purpose                                                  |
| ----------------------- | -------- | -------------------------------------------------------- |
| `MONGODB_URI`           | Yes      | Mongo connection string                                  |
| `ACCESS_TOKEN_SECRET`   | Yes      | Access JWT signing secret                                |
| `IMAGEKIT_PUBLIC_KEY`   | Yes*     | Image uploads                                            |
| `IMAGEKIT_PRIVATE_KEY`  | Yes*     | Image uploads (server only)                              |
| `IMAGEKIT_URL_ENDPOINT` | Yes*     | ImageKit CDN endpoint                                    |
| `PORT`                  | No       | API port (default `5000`)                                |
| `REFRESH_TOKEN_SECRET`  | No       | Prefer separate secret in production                     |
| `FRONTEND_URL`          | No       | CORS origins (default `http://localhost:3000`)           |
| `API_PUBLIC_URL`        | No       | OAuth callback base (default `http://localhost:5000`)    |
| `ADMIN_EMAILS`          | No       | Comma-separated admin emails (local only - never commit) |

\*Needed to create posts/avatars with images. Text-only flows can run without ImageKit, but image upload will fail.

**Frontend** (`frontend/.env.local`):

| Variable              | Required | Purpose                         |
| --------------------- | -------- | ------------------------------- |
| `NEXT_PUBLIC_API_URL` | No*      | API base URL, no trailing slash |

\*Defaults to `http://localhost:5000` if unset.

Full variable list and OAuth keys: see [`backend/.env.example`](./backend/.env.example) and [`frontend/.env.example`](./frontend/.env.example).

Admin role details: [Features → Admin](./docs/FEATURES.md#admin).

### 3. Run

```bash
npm run dev
```

| App      | URL                                            |
| -------- | ---------------------------------------------- |
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Backend  | [http://localhost:5000](http://localhost:5000) |

Run separately if you prefer:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## Scripts

### Root

| Command                | Description                 |
| ---------------------- | --------------------------- |
| `npm install`          | Install all workspace deps  |
| `npm run dev`          | Backend + frontend together |
| `npm run build`        | Production build (frontend) |
| `npm run lint`         | Lint both packages          |
| `npm run lint:fix`     | Auto-fix ESLint issues      |
| `npm run format`       | Format with Prettier        |
| `npm run format:check` | Check Prettier formatting   |
| `npm run test`         | Frontend + backend tests    |
| `npm run typecheck`    | Frontend `tsc --noEmit`     |
| `npm run prepare`      | Installs Husky git hooks after `npm install` (no-op on Vercel/CI if husky is omitted) |

Husky runs **lint-staged** on every **commit**: ESLint on staged `frontend` / `backend` source files only. If that lint fails, the commit is blocked. After clone, run `npm install` once so the hook is installed. Production installs omit husky, so `prepare` is written as `husky || true` and does not fail the deploy. Full-repo lint still runs in CI (`npm run lint`).

### Workspace examples

```bash
npm run lint -w frontend
npm run lint -w backend
npm run test -w frontend
npm run test -w backend
npm run typecheck -w frontend
npm run start -w backend
```

Backend tests use **in-memory MongoDB** (`mongodb-memory-server`) - no Atlas URI required for `npm run test -w backend`.

---

## Production deployment

| Piece | Host | Notes |
| ----- | ---- | ----- |
| Frontend (Next.js) | [Vercel](https://vercel.com) | Root Directory `frontend/`; `NEXT_PUBLIC_API_URL` = Render API URL |
| Backend (Express) | [Render](https://render.com) | Root Directory `backend/`; Build `npm install`; Start `npm start`; health `GET /health` |
| Database | MongoDB Atlas | `MONGODB_URI` on Render |
| Images | ImageKit | `IMAGEKIT_*` on Render (server only) |

Set production secrets only in the host dashboards (never commit `.env`). Important Render vars: `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL` (Vercel origin, no trailing slash), `API_PUBLIC_URL` (Render origin), `TRUST_PROXY=1`, plus ImageKit and optional OAuth keys. Full list: [`backend/.env.example`](./backend/.env.example).

**Free-tier note:** Render may sleep after idle; the first request can take 30–60s.

---

## CI

One GitHub Actions workflow (`.github/workflows/ci.yml`, Node 22, `npm ci` from the repo root). Jobs run **in parallel** so a lint failure does not hide a test failure:

| Job                | Command                         |
| ------------------ | ------------------------------- |
| Frontend Lint      | `npm run lint -w frontend`      |
| Frontend Typecheck | `npm run typecheck -w frontend` |
| Frontend Test      | `npm run test -w frontend`      |
| Backend Lint       | `npm run lint -w backend`       |
| Backend Test       | `npm run test -w backend`       |

Runs on pull requests and on pushes to `main`. A new commit on the same branch cancels an in-progress run.

---

## Auth note

The API uses **Bearer JWTs** (`Authorization: Bearer <accessToken>`), not cookie sessions. Access and refresh tokens are issued on login/register; refresh tokens are **rotated and stored hashed** server-side; `POST /auth/logout` revokes the session. The frontend refreshes silently on `401`. See [API overview](./docs/API.md).

**Residual risk:** access + refresh JWTs are kept in the browser (Redux Persist / localStorage). Any XSS that can read storage can steal the session. Mitigations in place include Helmet CSP on the API, CSP/security headers on Next.js, input escaping via React, and short-lived access tokens (default `1h`). Do **not** switch to HTTP-only cookies unless you deliberately redesign auth.

---

## License / private

Private project (`"private": true` in root `package.json`). Do not commit secrets (`.env`, admin passwords, ImageKit private key).
