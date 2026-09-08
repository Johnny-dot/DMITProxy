# Prism · DMITProxy

A self-hosted 3X-UI dashboard and invite-based subscription portal, built with React, TypeScript, Express, and SQLite.

[简体中文](README.md) · [License](LICENSE) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

![Running admin dashboard with synthetic data](docs/images/admin-dashboard.png)

## Try locally without a proxy server

Use Node.js 22.12 or newer; Node.js 24 LTS is recommended.

```bash
git clone https://github.com/Johnny-dot/DMITProxy.git
cd DMITProxy
npm ci
npm run demo
```

Open **http://127.0.0.1:4173**.

| Role            | Username | Password          |
| --------------- | -------- | ----------------- |
| User portal     | `demo`   | `prism-demo-2026` |
| Admin dashboard | `admin`  | `prism-demo-2026` |

The invite code `PRISM-DEMO` creates a new local demo user. The demo starts with a fresh temporary SQLite database and a simulated 3X-UI server. It does not load `.env`, does not connect to a real proxy, and only listens on loopback. External probes, mirror downloads, traffic sync, and Surge conversion are disabled in this harness. Stop with Ctrl+C.

## Features

- Admin authentication through 3X-UI; local invite-based user accounts.
- User and invite management, subscription assignment, announcements, shared resources, and community links.
- Server/traffic dashboards, billing settings, optional DMIT traffic sync and Xray outbound probes.
- Universal protocol subscriptions plus Clash, sing-box, and optional Surge conversion.
- Device-aware client selection, subscription copy/QR/import actions, and setup guides.
- English/Chinese, light/dark themes, and responsive layouts.

## Running screens

All screenshots come from the running local application using synthetic accounts, traffic, and nodes. Mobile images use browser device emulation.

![Subscription workspace](docs/images/portal-overview.png)
![Subscription setup](docs/images/subscription-desktop.png)

<p><img src="docs/images/portal-mobile.png" width="35%" alt="Mobile portal"> <img src="docs/images/subscription-mobile.png" width="35%" alt="Mobile setup"></p>

Regenerate with `npm run pw:install`, then `npm run demo:screenshots`.

## Connect a real 3X-UI panel

Copy `.env.example` to `.env` and configure the panel URL, panel base path, service credentials, and public Prism URL. On Windows use `Copy-Item .env.example .env`; on Linux/macOS use `cp .env.example .env`.

```bash
# Terminal 1
npm run server
# Terminal 2
npm run dev
```

Open `http://127.0.0.1:3000`. API defaults to `127.0.0.1:3001`. Admin login uses upstream 3X-UI credentials; user login uses the local database.

For production run `npm ci`, `npm run ci:verify`, then `NODE_ENV=production npm start`. Express serves the built frontend. Configure an HTTPS reverse proxy and protect the upstream panel and database. `SERVER_HOST` defaults to `127.0.0.1`; change it only for your deployment network.

Clash and sing-box are rendered inline. Surge requires the optional subconverter sidecar (`bash scripts/install-subconverter.sh`). Real node probes require Xray on the Prism host. These services are separately installed and retain their own licenses.

Detailed Chinese guides: [Getting started](docs/GETTING_STARTED.md), [Deployment](docs/DEPLOYMENT.md), [Architecture](docs/ARCHITECTURE.md).

## Checks

```bash
npm run ci:verify
npm run pw:install
npm run test:e2e
```

Browser checks start an isolated demo and save evidence to `output/e2e`. Windows can use installed Edge if Playwright Chromium is missing. Linux CI uses `npx playwright install --with-deps chromium`.

## Scope and roadmap

Prism is independent of DMIT and 3X-UI. Demo tests and screenshots do not establish real network connectivity. Upstream exchanges are bounded; read requests can recover expired service sessions; billing retries preserve confirmed stages and require review for uncertain writes. Backups use checked online snapshots. Passing main CI triggers exact-commit deployment with application rollback. See [reliability notes](docs/RELIABILITY.md) for boundaries and operational controls. Broader proxy-core, device, and capacity checks remain future work.

Original project code is licensed under [MIT](LICENSE). Third-party components and brand assets retain their own rights; see [notices](THIRD_PARTY_NOTICES.md).
