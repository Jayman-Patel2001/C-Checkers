# Gas Station Employee Productivity Tracker

A full-stack web application for tracking employee productivity at a gas station, built with Next.js 14, TypeScript, Prisma, and Tailwind CSS.

## Features

- **Role-based authentication** (Admin / Employee)
- **Shift management** with auto-start on first task
- **Task timer system** (Start, Pause, Resume, Complete)
- **One active task at a time** with smart conflict resolution
- **Full event audit trail** for every task
- **Productivity tracking** (Work vs. Personal time)
- **Admin review workflow** (Approve / Reject with comments)
- **Real-time dashboard** with live timers
- **Timer restoration** after page refresh
- **Predefined + custom tasks**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth.js v4 (JWT sessions) |
| ORM | Prisma |
| Database | SQLite (dev) |
| Icons | Lucide React |

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# 1. Clone / navigate to project
cd employee-productivity

# 2. Install dependencies + setup database + seed demo data
npm run setup
```

This runs:
1. `npm install`
2. `prisma generate` (generates Prisma client)
3. `prisma db push` (creates SQLite database)
4. Seeds demo users and task definitions

### Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Sample Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** (Station Manager) | admin@gasstation.com | admin123 |
| **Employee** | john@gasstation.com | emp123 |
| **Employee** | sarah@gasstation.com | emp123 |
| **Employee** | mike@gasstation.com | emp123 |

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          # Login page
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Dashboard shell with sidebar
│   │   ├── admin/
│   │   │   ├── page.tsx            # Admin dashboard
│   │   │   ├── employees/page.tsx  # Employee management
│   │   │   ├── tasks/page.tsx      # Task template management
│   │   │   └── reviews/page.tsx    # Task review workflow
│   │   └── employee/
│   │       └── page.tsx            # Employee dashboard
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth handler
│   │   ├── shifts/                 # Shift management
│   │   ├── tasks/                  # Task entry CRUD
│   │   ├── task-definitions/       # Template CRUD
│   │   ├── reviews/                # Review workflow
│   │   ├── employees/              # Employee management
│   │   └── dashboard/             # Dashboard data endpoints
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Redirect to dashboard
├── components/
│   ├── employee/                   # Employee-specific components
│   ├── layout/                     # Sidebar, header
│   ├── providers/                  # SessionProvider, ToastProvider
│   └── ui/                         # Badge, Modal, etc.
├── lib/
│   ├── auth.ts                     # NextAuth config
│   ├── prisma.ts                   # Prisma client singleton
│   └── utils.ts                    # Helper functions
└── types/
    └── index.ts                    # TypeScript types
```

## Database Schema

```
User          → id, name, email, password, role (ADMIN|EMPLOYEE)
Shift         → id, userId, startTime, endTime
TaskDefinition→ id, name, description, category (WORK|PERSONAL), isActive
TaskEntry     → id, userId, shiftId, taskDefinitionId?, name, category,
                status (PENDING|ACTIVE|PAUSED|COMPLETED),
                startedAt, completedAt, activeIntervalStart, totalActiveTime
TaskEventLog  → id, taskEntryId, event (CREATED|STARTED|PAUSED|RESUMED|COMPLETED), timestamp
Review        → id, taskEntryId, adminId, status (APPROVED|REJECTED), comment
```

## How the Timer Works

1. **Active interval tracking**: `activeIntervalStart` stores when the current interval began
2. **Accumulated time**: `totalActiveTime` stores all completed interval seconds
3. **Live calculation**: `currentTime = totalActiveTime + (now - activeIntervalStart)`
4. **Pause**: adds elapsed to `totalActiveTime`, clears `activeIntervalStart`
5. **Resume**: sets `activeIntervalStart` to now
6. **Complete**: adds final elapsed to `totalActiveTime`
7. **After refresh**: restores from database state - timers resume correctly

## Useful Commands

```bash
npm run dev          # Start dev server
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:reset     # Reset database and re-seed
npm run db:seed      # Re-seed without resetting
npm run build        # Production build
```

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"
```
