# ReachInbox Email Scheduler

A production-oriented full-stack email scheduling service and dashboard built for the ReachInbox hiring assignment.

The application allows users to schedule emails for a future date and time. Email jobs are stored in PostgreSQL, scheduled using BullMQ and Redis, and processed asynchronously by an email worker. Email delivery is handled through the Resend API.

NOTE:
Testing Note: Please use keerthikm0803@gmail.com as the recipient. Resend's current testing environment only allows delivery to the account owner's email.

## 🚀 Live Demo

**Hosted Application:** https://reachinbox-frontend-pv7w.onrender.com

**Backend API:** https://reachinbox-backend-30q7.onrender.com

**GitHub Repository:** https://github.com/Keerthikm0803/reachinbox-scheduler

**Demo Video:** https://www.loom.com/share/eeb7a1ac31ea45f6a0c819d5e7bf9a65

---

## ✨ Features

* Schedule emails for a future date and time
* React-based email scheduling dashboard
* Express REST API
* PostgreSQL database
* Prisma ORM
* BullMQ persistent job queue
* Redis-backed delayed job scheduling
* Dedicated email worker
* Concurrent email processing
* Configurable worker concurrency
* Email status tracking
* Scheduled, sent, and failed email statistics
* Automatic dashboard refresh
* Redis-based rate limiting
* Resend API email delivery
* Email error tracking
* Email attempt tracking
* Docker Compose support for local infrastructure
* Production deployment using Render

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* CSS

### Backend

* Node.js
* Express.js
* TypeScript
* Prisma ORM

### Database

* PostgreSQL

### Queue & Scheduling

* BullMQ
* Redis

### Email Delivery

* Resend API

### Deployment

* Render
* GitHub

### Local Infrastructure

* Docker
* Docker Compose

---

# 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │      React UI        │
                         │   Vite + TypeScript  │
                         └──────────┬───────────┘
                                    │
                                    │ HTTP REST API
                                    ▼
                         ┌──────────────────────┐
                         │   Express Backend    │
                         │      Node.js         │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
                    ▼                                ▼
          ┌──────────────────┐             ┌──────────────────┐
          │    PostgreSQL    │             │      BullMQ      │
          │     Prisma       │             │  Delayed Queue   │
          └──────────────────┘             └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │      Redis       │
                                           │ Queue + Rate     │
                                           │     Limiting     │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │   Email Worker   │
                                           │   Concurrency 5  │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │    Resend API    │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                               Recipient
```

---

# 📧 Email Scheduling Flow

1. The user enters the recipient, subject, message, scheduled time, and sender information in the React dashboard.
2. The frontend sends a `POST` request to `/api/emails/schedule`.
3. The Express backend validates the request.
4. The scheduled date is validated to ensure it is in the future.
5. The email record is stored in PostgreSQL using Prisma.
6. A delayed BullMQ job is created with the email ID.
7. Redis stores and manages the delayed job.
8. At the scheduled time, the email worker receives the job.
9. The worker retrieves the email and sender information from PostgreSQL.
10. Redis rate limiting is checked before sending.
11. The worker sends the email through the Resend API.
12. The email record is updated to `SENT`.
13. The sent timestamp and message ID are stored.
14. If delivery fails, the email is marked as `FAILED` and the error is stored.
15. The dashboard refreshes and displays the latest email status.

### Successful Flow

```text
SCHEDULED
    ↓
BullMQ Delayed Job
    ↓
Redis
    ↓
Email Worker
    ↓
Rate Limit Check
    ↓
Resend API
    ↓
Email Delivered
    ↓
SENT
```

---

# 🔌 API Endpoints

## Health Check

```http
GET /health
```

Example response:

```json
{
  "status": "ok",
  "message": "ReachInbox backend is running"
}
```

## Schedule Email

```http
POST /api/emails/schedule
```

Example request:

```json
{
  "recipient": "test@example.com",
  "subject": "Test Email",
  "body": "Hello from ReachInbox Scheduler!",
  "scheduledAt": "2026-08-19T10:39:00.000Z",
  "senderId": "your-sender-id"
}
```

## Get Email Jobs

```http
GET /api/emails
```

Returns recent email jobs and dashboard statistics.

Example response:

```json
{
  "stats": {
    "total": 10,
    "scheduled": 2,
    "sent": 7,
    "failed": 1
  },
  "emails": []
}
```

---

# 🗄️ Database Design

The application uses PostgreSQL with Prisma ORM.

## User

Stores user information and owns sender accounts.

Fields include:

* `id`
* `googleId`
* `name`
* `email`
* `avatar`
* `createdAt`
* `updatedAt`

## Sender

Represents an email sender associated with a user.

Fields include:

* `id`
* `email`
* `name`
* `userId`
* `createdAt`
* `updatedAt`

## Email

Stores scheduled and processed email jobs.

Fields include:

* `id`
* `recipient`
* `subject`
* `body`
* `scheduledAt`
* `sentAt`
* `status`
* `jobId`
* `attempts`
* `error`
* `previewUrl`
* `senderId`
* `createdAt`
* `updatedAt`

Indexes are used on frequently queried fields:

* `status`
* `scheduledAt`
* `senderId`

## Email Status

```text
SCHEDULED
PROCESSING
SENT
FAILED
```

---

# 🔄 Queue Architecture

BullMQ is used instead of cron jobs for persistent email scheduling.

When an email is scheduled, the backend creates a delayed BullMQ job:

```text
Email Request
     ↓
PostgreSQL
     ↓
BullMQ
     ↓
Redis
     ↓
Delayed Until Scheduled Time
     ↓
Email Worker
```

This allows the API to respond immediately without keeping an HTTP request open until the scheduled email time.

---

# ⚙️ Worker Concurrency

The email worker supports concurrent processing.

The current configuration uses:

```text
Concurrency: 5
```

This allows up to five email jobs to be processed concurrently.

The concurrency can be configured using:

```env
WORKER_CONCURRENCY=5
```

---

# 🚦 Rate Limiting

Redis is also used for email sending rate limiting.

Before sending an email, the worker checks whether the sender is currently allowed to send.

If the rate limit is reached, the job can be delayed and processed again later.

This helps prevent excessive email sending within a short period.

---

# 📩 Email Delivery

The production deployment uses the Resend API for email delivery.

The worker sends the email information to Resend:

```text
Recipient
Subject
Message
     ↓
Resend API
     ↓
Email Delivery
```

The Resend API key is stored securely as a Render environment variable and is never committed to GitHub.

---

# ❌ Error Handling

The application handles errors during:

* Request validation
* Scheduled date validation
* PostgreSQL operations
* Prisma operations
* BullMQ job processing
* Redis operations
* Rate limiting
* Email delivery

Failed emails store:

* `FAILED` status
* Error message
* Attempt count

Example:

```text
SCHEDULED
    ↓
Worker
    ↓
Resend API Error
    ↓
FAILED
    ↓
Error stored in PostgreSQL
```

---

# 📁 Project Structure

```text
reachinbox-scheduler/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── config/
│   │   │   └── redis.ts
│   │   │
│   │   ├── queues/
│   │   │   ├── email.queue.ts
│   │   │   └── email.worker.ts
│   │   │
│   │   ├── services/
│   │   │   ├── email.service.ts
│   │   │   └── rate-limit.service.ts
│   │   │
│   │   ├── create-sender.ts
│   │   └── server.ts
│   │
│   ├── package.json
│   ├── package-lock.json
│   ├── prisma.config.ts
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

# 💻 Prerequisites

Install the following:

* Node.js
* npm
* PostgreSQL
* Redis
* Docker Desktop
* Git

Docker can be used to run PostgreSQL and Redis locally.

---

# 🐳 Local Infrastructure

Start the supporting services:

```bash
docker compose up -d
```

Check running containers:

```bash
docker ps
```

The expected services include:

```text
PostgreSQL
Redis
```

---

# 🔐 Environment Variables

Create a `.env` file inside the `backend` directory.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/reachinbox"
REDIS_URL="redis://localhost:6379"
PORT=5000
RESEND_API_KEY="your_resend_api_key"
RESEND_FROM_EMAIL="onboarding@resend.dev"
WORKER_CONCURRENCY=5
```

Never commit the real `.env` file to GitHub.

Production environment variables are configured securely through Render.

---

# 📦 Installation

Clone the repository:

```bash
git clone https://github.com/Keerthikm0803/reachinbox-scheduler.git
cd reachinbox-scheduler
```

## Backend

```bash
cd backend
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate deploy
```

Start the backend:

```bash
npm run dev
```

## Email Worker

Open another terminal:

```bash
cd backend
npm run worker
```

Expected output:

```text
Email worker started with concurrency: 5
Redis connected
```

## Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# 🧪 Testing

The implementation was tested using scheduled emails through the deployed dashboard.

Test scenarios include:

* Successful email scheduling
* Future-date validation
* BullMQ delayed job execution
* Redis queue processing
* Concurrent email processing
* Redis rate limiting
* Resend API delivery
* Failed email handling
* Dashboard status updates
* Email statistics
* Production deployment

### Successful Production Test

```text
SCHEDULED
    ↓
BullMQ
    ↓
Redis
    ↓
Email Worker
    ↓
Resend API
    ↓
SENT
```

A production test successfully scheduled an email for `10:39:00 AM` and the dashboard recorded it as `SENT` at `10:39:01 AM`.

---

# 🔒 Security

Sensitive credentials are stored using environment variables.

The repository does not contain:

* Resend API keys
* Database passwords
* Redis credentials
* Private API keys
* Production environment configuration

The `.env` file should never be committed to GitHub.

---

# ☁️ Deployment

The application is deployed on Render.

The production deployment runs the Express backend and email worker with PostgreSQL, Redis, and Resend API integration.

---

# 📊 Dashboard

The dashboard provides:

* Total email count
* Scheduled email count
* Sent email count
* Failed email count
* Email scheduling form
* Recipient information
* Subject
* Message
* Scheduled timestamp
* Sent timestamp
* Email status
* Error information
* Recent email jobs

The dashboard automatically refreshes email information periodically.

---

# 🎯 Assignment

This project was developed as part of the ReachInbox Full-stack Email Job Scheduler hiring assignment.

The implementation demonstrates:

* API-based email scheduling
* Persistent job scheduling using BullMQ
* Redis-backed queues
* Asynchronous email processing
* Worker concurrency
* Rate limiting
* PostgreSQL persistence
* Prisma ORM
* Email status tracking
* Resend email delivery
* React dashboard
* Production deployment

The scheduler uses BullMQ and Redis instead of cron jobs for delayed email execution.

---

# 🚀 Future Improvements

Possible future improvements include:

* User authentication
* Google OAuth integration
* Multiple sender accounts
* Email templates
* Bulk email scheduling
* Email cancellation
* Job retry configuration
* Advanced analytics
* Delivery tracking
* Bounce handling
* Open and click tracking
* Improved rate-limit configuration
* Dedicated production worker service

---

# 👨‍💻 Author

**Keerthi Km**

B.Tech Computer Science & Engineering (AI & ML)

2027 Batch

