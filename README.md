# ReachInbox Email Scheduler

A production-oriented email scheduling service and dashboard built for the ReachInbox hiring assignment.

The system accepts email scheduling requests through an Express API, stores email jobs in PostgreSQL using Prisma, schedules jobs using BullMQ and Redis, and processes them asynchronously through a dedicated worker. Emails are sent using Nodemailer with Ethereal SMTP for testing and preview purposes.

## Features

* Schedule emails for a future date and time
* React-based email scheduling dashboard
* Express REST API
* PostgreSQL database with Prisma ORM
* BullMQ persistent job queue
* Redis-backed job scheduling
* Dedicated email worker
* Concurrent job processing
* Email status tracking
* Scheduled, sent, and failed email statistics
* Retry/error handling through the worker
* Redis-based rate limiting
* Ethereal SMTP integration
* Email preview URLs
* Automatic dashboard refresh
* Docker Compose configuration for supporting services

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* CSS

### Backend

* Node.js
* Express
* TypeScript
* Prisma ORM
* PostgreSQL

### Queue & Infrastructure

* Redis
* BullMQ
* Docker Compose

### Email

* Nodemailer
* Ethereal Email SMTP

## Architecture

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
                     │      Port 5000       │
                     └──────────┬───────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
       ┌──────────────────┐          ┌──────────────────┐
       │    PostgreSQL    │          │      BullMQ      │
       │      Prisma      │          │   Job Scheduler  │
       └──────────────────┘          └────────┬─────────┘
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
                                      │  Email Worker    │
                                      │    Concurrency   │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │    Nodemailer    │
                                      │ Ethereal SMTP    │
                                      └──────────────────┘
```

## Email Scheduling Flow

1. The user enters the recipient, subject, message, scheduled time, and sender ID in the React dashboard.
2. The frontend sends a `POST` request to `/api/emails/schedule`.
3. The backend validates the request and scheduled date.
4. The email record is stored in PostgreSQL using Prisma.
5. A BullMQ job is created with the email ID and scheduled execution time.
6. Redis stores and manages the BullMQ job.
7. When the scheduled time is reached, the worker receives the job.
8. The worker loads the email information from PostgreSQL.
9. The worker sends the email using Nodemailer and Ethereal SMTP.
10. The email record is updated with its final status.
11. A preview URL is stored when available.
12. The dashboard periodically refreshes and displays the latest status.

## API Endpoints

### Health Check

```http
GET /health
```

Returns the current backend status.

Example response:

```json
{
  "status": "ok",
  "message": "ReachInbox backend is running"
}
```

### Schedule Email

```http
POST /api/emails/schedule
```

Request body:

```json
{
  "recipient": "test@example.com",
  "subject": "Test Email",
  "body": "Hello from ReachInbox Scheduler!",
  "scheduledAt": "2026-08-18T18:30:00.000Z",
  "senderId": "your-sender-id"
}
```

### Get Email Jobs

```http
GET /api/emails
```

Returns recent email jobs and dashboard statistics.

Example response structure:

```json
{
  "stats": {
    "total": 12,
    "scheduled": 1,
    "sent": 9,
    "failed": 2
  },
  "emails": []
}
```

## Database Design

The application uses PostgreSQL with Prisma ORM.

### User

Stores user information and owns sender accounts.

### Sender

Represents an email sender associated with a user.

### Email

Stores:

* Recipient
* Subject
* Body
* Scheduled time
* Sent time
* Status
* BullMQ job ID
* Attempt count
* Error information
* Email preview URL
* Sender relationship
* Creation/update timestamps

### Email Status

```text
SCHEDULED
PROCESSING
SENT
FAILED
```

Indexes are used on frequently queried fields such as:

* `status`
* `scheduledAt`
* `senderId`

## Queue Architecture

BullMQ is used instead of cron jobs for persistent scheduling.

When an email is scheduled, the backend creates a delayed BullMQ job.

The worker continuously listens for available jobs and processes them asynchronously.

This separates API requests from email delivery and prevents the API server from having to wait for scheduled jobs.

## Worker Concurrency

The email worker supports concurrent processing.

The current worker configuration runs with:

```text
Concurrency: 5
```

This allows multiple email jobs to be processed in parallel while still controlling the amount of concurrent work.

## Rate Limiting

Redis is also used for email sending rate limiting.

This helps prevent the system from sending an excessive number of emails within a short period.

The rate-limit service is implemented separately from the main email service so that queue processing and sending limits can be managed independently.

## Error Handling

The system handles errors during:

* Request validation
* Date validation
* Database operations
* Queue processing
* SMTP/email delivery

Failed jobs are recorded with:

* `FAILED` status
* Error message
* Attempt information

This allows failures to be visible from the dashboard.

## Email Preview

The application uses Ethereal Email for development/testing.

Ethereal provides a preview URL for successfully sent test emails.

The dashboard displays:

```text
View Email Preview
```

for emails where a preview URL is available.

## Project Structure

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
│   │   └── server.ts
│   │
│   ├── create-sender.ts
│   ├── package.json
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

## Prerequisites

Install the following:

* Node.js
* npm
* PostgreSQL
* Redis
* Docker Desktop (optional if Redis/PostgreSQL are run through Docker)

## Environment Variables

Create a `.env` file inside the `backend` directory.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/reachinbox"
REDIS_URL="redis://localhost:6379"

PORT=5000

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_username
SMTP_PASS=your_ethereal_password
```

Do not commit the real `.env` file to GitHub.

## Installation

Clone the repository:

```bash
git clone https://github.com/Keerthikm0803/reachinbox-scheduler.git
cd reachinbox-scheduler
```

### Backend

```bash
cd backend
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate deploy
```

Start the backend:

```bash
npm run dev
```

The API will run at:

```text
http://localhost:5000
```

### Start the Email Worker

Open another terminal:

```bash
cd backend
npm run worker
```

The worker should display:

```text
Email worker started with concurrency: 5
Redis connected
```

### Frontend

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

## Running with Docker

The project includes a `docker-compose.yml` file for supporting infrastructure.

Run:

```bash
docker compose up -d
```

Verify the required services are running before starting the backend and worker.

## Dashboard

The dashboard provides:

* Total email count
* Scheduled email count
* Sent email count
* Failed email count
* Email scheduling form
* Recent email jobs
* Email status
* Scheduled timestamp
* Sent timestamp
* Error details
* Ethereal preview links

The dashboard automatically refreshes email job information periodically.

## Testing

The implementation was tested using scheduled emails through the dashboard.

Test scenarios include:

* Successful email scheduling
* Delayed email execution
* Multiple concurrent email jobs
* Redis rate limiting
* Ethereal SMTP delivery
* Failed email handling
* Dashboard status updates
* Email preview generation

Example successful flow:

```text
SCHEDULED
    ↓
BullMQ delayed job
    ↓
Redis
    ↓
Email Worker
    ↓
Nodemailer
    ↓
Ethereal SMTP
    ↓
SENT
```

## Security

Sensitive environment variables are excluded from Git using `.gitignore`.

The repository does not contain:

* SMTP passwords
* Database passwords
* Redis credentials
* Private API keys
* Local environment configuration

## Demo

Assignment demonstration video:

**Loom : **https://www.loom.com/share/ffb4eb862c5549fdadeabe157c806676

## Hosted Assignment

**Live Application:** Add your deployed application URL here.

## GitHub Repository

**Repository:** https://github.com/Keerthikm0803/reachinbox-scheduler

## Assignment

This project was developed as part of the ReachInbox Full-stack Email Job Scheduler assignment.

The implementation demonstrates asynchronous email scheduling using BullMQ and Redis without relying on cron jobs.

## Author

**Keerthi Km**

B.Tech Computer Science & Engineering (AI & ML)

2027 Batch
