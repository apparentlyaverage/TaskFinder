# TaskFinder — Frontend

> Peer-to-peer service marketplace. Creators post tasks, Earners bid and fulfil them.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the App](#running-the-app)
4. [Demo Mode](#demo-mode)
5. [Connecting to the Backend](#connecting-to-the-backend)
6. [Project Structure](#project-structure)
7. [Pages & Features](#pages--features)
8. [Tech Stack](#tech-stack)
9. [Environment Variables](#environment-variables)
10. [Building for Production](#building-for-production)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Version | Download |
|-------------|---------|----------|
| Node.js     | 18+     | https://nodejs.org |
| npm         | 9+      | Bundled with Node.js |

To check your versions:

```bash
node -v   # should print v18.x.x or higher
npm -v    # should print 9.x.x or higher
```

---

## Installation

### macOS / Linux

```bash
# 1. Extract the zip and enter the folder
unzip taskfinder.zip
cd taskfinder

# 2. Run the installer
bash install.sh
```

### Windows

```
1. Extract taskfinder.zip
2. Open the taskfinder folder
3. Double-click install.bat
   — OR —
   Open Command Prompt in the folder and run: install.bat
```

### Manual installation (all platforms)

```bash
cd taskfinder
npm install
```

---

## Running the App

```bash
npm run dev
```

This starts the development server. The app will automatically open at:

```
http://localhost:3000
```

If the browser doesn't open automatically, navigate to that URL manually.

To stop the server: press `Ctrl + C` in the terminal.

---

## Demo Mode

The app ships in **demo mode** — it runs entirely in your browser with mock data, no backend required.

### Demo Login Presets

Click the preset buttons on the login screen, or use these credentials (any password works):

| Role    | Email                | What you can do |
|---------|----------------------|-----------------|
| Creator | creator@demo.com     | Post tasks, review bids, accept bids, release payment, raise disputes |
| Earner  | earner@demo.com      | Browse tasks, view skill-matched suggestions, submit bids |
| Admin   | admin@demo.com       | View dispute queue, review message logs, resolve disputes |

### What works in demo mode

- ✅ All navigation and page transitions
- ✅ Full task browsing with skill and status filters
- ✅ Task detail view with bid submission flow
- ✅ Creator bid acceptance → escrow → release / dispute flow
- ✅ Admin dispute resolution (refund creator vs release to earner)
- ✅ Real-time-style messaging with simulated replies
- ✅ Notification centre with unread badges
- ✅ Skill-matched task suggestions with score rings
- ✅ Profile editing

### What requires the backend

- 🔌 Real authentication (JWT tokens)
- 🔌 Persisted data across sessions
- 🔌 Real-time WebSocket notifications
- 🔌 Stripe payment processing
- 🔌 Matching engine running against real skill profiles

---

## Connecting to the Backend

When your backend is running (see the full stack setup in `docker-compose.yml`), update your `.env` file:

```env
VITE_API_URL=http://localhost:8080
VITE_SOCKET_URL=http://localhost:3004
```

Then swap the mock imports in `src/App.jsx` for the real API calls:

```js
// Replace this at the top of App.jsx:
import { MOCK_TASKS, MOCK_BIDS, ... } from './api/mock'

// With real API calls from:
import { tasks, auth, payments, messaging, matching, reviews, disputes } from './api'
```

The `src/api/index.js` file contains all endpoint definitions already wired to the gateway. The `src/api/client.js` Axios instance handles JWT attachment and 401 redirects automatically.

### Backend services expected

| Service     | Default URL             | Purpose |
|-------------|-------------------------|---------|
| API Gateway | http://localhost:8080   | Single entry point for all API calls |
| Messaging   | http://localhost:3004   | WebSocket connection for real-time notifications |

All other services (Auth, Tasks, Payments, Matching, Reviews, Disputes) route through the gateway — the frontend never calls them directly.

---

## Project Structure

```
taskfinder/
├── index.html              # App entry point
├── vite.config.js          # Vite config + dev proxy
├── package.json            # Dependencies
├── .env                    # Environment variables (create from .env.example)
├── install.sh              # macOS/Linux installer
├── install.bat             # Windows installer
└── src/
    ├── main.jsx            # React DOM mount
    ├── App.jsx             # All pages + routing logic
    ├── styles/
    │   └── global.css      # Design tokens, resets, animations
    ├── api/
    │   ├── client.js       # Axios instance (JWT + 401 handling)
    │   ├── index.js        # All API endpoint definitions
    │   └── mock.js         # Mock data for demo mode
    └── contexts/
        ├── AuthContext.jsx  # Authentication state
        └── SocketContext.jsx # WebSocket connection
```

---

## Pages & Features

### Dashboard
- Role-aware stats (tasks posted / bids / earnings / disputes)
- Recent activity feed with quick navigation to any task

### Browse Tasks (/tasks-browse)
- Live search by skill tag or keyword
- Status filter (Open / In Progress / Completed / Disputed)
- Card grid with budget, deadline, and skill tags

### Task Detail (/task-detail)
- Full description and skill requirements
- Bid panel with earner ratings and pitch text
- **Creator actions:** Accept bid → move funds to escrow → release payment or raise dispute
- **Earner actions:** Submit bid with price and pitch

### Post Task (/tasks-new)
- Title, description, budget, deadline, skill tags
- Success screen with routing to My Tasks

### My Tasks (/tasks-mine) — Creator
- All tasks posted by the logged-in creator
- Bid count badge on open tasks

### Suggestions (/suggestions) — Earner
- Tasks ranked by Jaccard similarity match score
- Visual match score ring showing percentage overlap with your skills

### Messages (/messages)
- Task-scoped direct messaging thread
- Simulated replies in demo mode
- Typing indicator

### Notifications (/notifications)
- All notifications with type icons
- Unread badge in sidebar
- Click to mark read / mark all read

### Profile (/profile)
- Display name, bio, skills, portfolio URL
- Skill tags used by the matching engine

### Dispute Queue (/admin-disputes) — Admin
- FIFO queue of open disputes
- Escrow amount, parties, reason summary

### Dispute Detail (/admin-dispute-detail) — Admin
- Full dispute context: reason, message log, escrow state
- Timeline of admin actions
- Internal notes
- Resolution controls: Refund Creator or Release to Earner

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 18 | UI rendering |
| Build tool | Vite 6 | Dev server + bundling |
| HTTP client | Axios | API calls + interceptors |
| WebSocket | Socket.io-client | Real-time notifications |
| Routing | React Router v6 | Client-side navigation |
| Styling | CSS Modules + CSS Variables | Scoped styles, design tokens |
| Fonts | Barlow Condensed, Barlow, JetBrains Mono | Display / body / monospace |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | API Gateway base URL |
| `VITE_SOCKET_URL` | `http://localhost:3004` | WebSocket server URL |

The `VITE_` prefix is required by Vite to expose variables to the browser bundle.

---

## Building for Production

```bash
# Build optimised static files
npm run build

# Preview the production build locally
npm run preview
```

Output is in the `dist/` folder. Deploy it to any static host:

```bash
# Netlify
netlify deploy --prod --dir=dist

# Vercel
vercel --prod

# Nginx / Apache
# Point your web root at the dist/ folder
# Add a rewrite rule: all routes → index.html
```

### Nginx rewrite rule (SPA routing)

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## Troubleshooting

### Port 3000 already in use

Change the port in `vite.config.js`:

```js
server: {
  port: 3001,  // change to any free port
}
```

Or kill the process using port 3000:

```bash
# macOS / Linux
lsof -ti:3000 | xargs kill

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### `npm install` fails — network error

If you're behind a corporate proxy:

```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
npm install
```

### Blank screen after login

Open the browser developer console (`F12` → Console tab). If you see module errors, try:

```bash
rm -rf node_modules
npm install
npm run dev
```

### `Cannot find module` errors

Make sure you're running commands from inside the `taskfinder/` folder:

```bash
cd taskfinder
npm run dev
```

### Fonts not loading

The app loads Google Fonts over the internet. If you're offline:

1. Open `src/styles/global.css`
2. Remove the `@import url('https://fonts.googleapis.com/...')` line
3. The app will fall back to system sans-serif fonts

### Changes not reflecting in browser

Vite supports hot module replacement (HMR) — changes to `.jsx` and `.css` files update instantly without refreshing. If something looks stuck, do a hard refresh: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (macOS).

---

## Quick Reference

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production → dist/
npm run preview  # Preview production build locally
```

---

*TaskFinder Frontend v1.0.0 — Generated as part of the full-stack Task Finder project.*
