# DMITProxy

DMITProxy is a 3X-UI management frontend with a local Express backend, an invite-based user portal, and SQLite-backed session storage.

## What It Does

- Admin login through 3X-UI panel credentials
- Local invite-based registration for end users
- Subscription portal with client download links
- Local admin APIs for invite codes, users, and system settings
- React + Vite frontend with Express proxying for 3X-UI

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- Backend: Express, better-sqlite3, tsx
- Auth: 3X-UI admin session + local SQLite user sessions

## Development

1. Install dependencies:
   `npm install`
2. Copy [`.env.example`](.env.example) to `.env`
3. Fill the required 3X-UI settings:
   - `VITE_3XUI_SERVER`
   - `VITE_3XUI_BASE_PATH`
   - `XUI_ADMIN_USERNAME`
   - `XUI_ADMIN_PASSWORD`
4. Start the backend:
   `npm run server`
5. Start the frontend:
   `npm run dev`

Default ports:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Production

1. Build the frontend:
   `npm run build`
2. Start the unified server:
   `npm start`

## Common Environment Variables

See [`.env.example`](.env.example) for the full list. The most important settings are:

- `SERVER_PORT`
- `VITE_3XUI_SERVER`
- `VITE_3XUI_BASE_PATH`
- `VITE_SUB_URL`
- `XUI_ADMIN_USERNAME`
- `XUI_ADMIN_PASSWORD`
- `XUI_AUTO_CREATE_ON_REGISTER`

## Useful Scripts

- `npm run dev`
- `npm run server`
- `npm run server:watch`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Documentation

- [`docs/system-flow.md`](docs/system-flow.md)
- [`docs/architecture-layers.md`](docs/architecture-layers.md)
- [`docs/playwright-invite-flow.md`](docs/playwright-invite-flow.md)
