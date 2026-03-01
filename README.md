# NanoFlow - Workflow Automation Platform

Modern SaaS website built with Next.js, TypeScript, Tailwind CSS, and Framer Motion.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Required Ports

| Service  | Port | Description           |
|----------|------|-----------------------|
| Frontend | 3000 | Next.js dev server    |
| Backend  | 4001 | Express API server    |
| Postgres | 5433 | Database (Docker)     |
| Redis    | 6379 | Cache/Queue (Docker)  |

If ports are in use, run: `npm run kill:ports`

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion

## Project Structure

```
nanoFlow/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Card.tsx
│   └── sections/
│       ├── Navbar.tsx
│       ├── Hero.tsx
│       ├── Features.tsx
│       ├── Integrations.tsx
│       ├── Testimonials.tsx
│       ├── CTA.tsx
│       └── Footer.tsx
└── public/
```
