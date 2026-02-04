# Industry Archive Demo (Viewer + Admin + API)

This repo is a **single deployable service** for Railway:
- **Fastify** serves:
  - Static pages built by **Vite** (viewer + admin)
  - JSON API under `/api/*` and `/api/admin/*`
- Server accesses Supabase via **supabase-js** (service role key on server only)

Design follows the "API contract first" blueprint: the browser only calls `/api/*`, never Supabase directly. (See the provided blueprint document.) 

## 1) Local dev

### Requirements
- Node.js 18+ (recommended 20+)

### Install
```bash
npm install
```

### Configure env
Create `apps/api/.env`:
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_TOKEN=change-me
NODE_ENV=development
PORT=3000
```

### Run (build web + start api)
```bash
npm run build
npm start
```

Open:
- Viewer: http://localhost:3000/viewer.html
- Admin:  http://localhost:3000/admin.html

## 2) Railway deploy (single service)

### Variables (Railway -> Variables)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_TOKEN
- NODE_ENV=production

### Build / Start commands (Railway -> Settings -> Build & Deploy)
- Build Command: `npm run build`
- Start Command: `npm start`

Railway provides `PORT` automatically.

## 3) API quick test

### Search
`GET /api/search?q=foo`

### Admin create organization (use header)
`X-Admin-Token: <ADMIN_TOKEN>`
`POST /api/admin/organization`

Body example:
```json
{
  "company_short_name":"Acme",
  "company_full_name":"Acme Security Inc.",
  "establish_year":2001,
  "organization_slug":"acme"
}
```

## 4) Notes
- Tables are assumed to already exist in Supabase with the ERD schema (organization, cybersecurity_product, cybersecurity_domain, organization_product, cybersecurity_product_domain).
- This is a demo baseline; add validation and richer UI later.
