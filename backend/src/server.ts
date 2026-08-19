import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import { RedisStore } from "connect-redis";
import passport from "./auth/google";
import { redisConnection } from "./config/redis";

import { scheduleEmail } from "./services/email.service";
import { PrismaClient } from "@prisma/client";
import "./queues/email.worker";

const prisma = new PrismaClient();

const app = express();
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    store: new RedisStore({
      client: redisConnection,
    }),
    secret:
      process.env.SESSION_SECRET ||
      "development-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "ReachInbox backend is running",
  });
});

/* =========================
   GOOGLE LOGIN
========================= */

app.get(
  "/api/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/?login=failed`,
  }),
  (_req, res) => {
    res.redirect(FRONTEND_URL);
  }
);

app.get("/api/auth/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      authenticated: false,
      user: null,
    });
  }

  return res.json({
    authenticated: true,
    user: req.user,
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.logout((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        message: "Logout failed",
      });
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        console.error(
          "Session destroy error:",
          sessionError
        );
      }

      res.clearCookie("connect.sid");

      return res.json({
        message: "Logged out successfully",
      });
    });
  });
});

/* =========================
   EMAIL SCHEDULING
========================= */

app.post("/api/emails/schedule", async (req, res) => {
  try {
    const {
      recipient,
      subject,
      body,
      scheduledAt,
      senderId,
    } = req.body;

    if (
      !recipient ||
      !subject ||
      !body ||
      !scheduledAt ||
      !senderId
    ) {
      return res.status(400).json({
        message:
          "recipient, subject, body, scheduledAt and senderId are required",
      });
    }

    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        message: "Invalid scheduledAt date",
      });
    }

    if (scheduledDate.getTime() <= Date.now()) {
      return res.status(400).json({
        message: "scheduledAt must be in the future",
      });
    }

    const email = await scheduleEmail({
      recipient,
      subject,
      body,
      scheduledAt: scheduledDate,
      senderId,
    });

    return res.status(201).json({
      message: "Email scheduled successfully",
      email,
    });
  } catch (error) {
    console.error("Schedule email error:", error);

    return res.status(500).json({
      message: "Failed to schedule email",
    });
  }
});

/* =========================
   EMAIL DASHBOARD
========================= */

app.get("/api/emails", async (_req, res) => {
  try {
    const [emails, total, scheduled, sent, failed] =
      await Promise.all([
        prisma.email.findMany({
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          include: {
            sender: true,
          },
        }),

        prisma.email.count(),

        prisma.email.count({
          where: {
            status: "SCHEDULED",
          },
        }),

        prisma.email.count({
          where: {
            status: "SENT",
          },
        }),

        prisma.email.count({
          where: {
            status: "FAILED",
          },
        }),
      ]);

    res.json({
      stats: {
        total,
        scheduled,
        sent,
        failed,
      },
      emails,
    });
  } catch (error) {
    console.error("Fetch emails error:", error);

    res.status(500).json({
      message: "Failed to fetch emails",
    });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Backend server running on port ${PORT}`
  );
});