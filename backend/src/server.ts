import "dotenv/config";
import express from "express";
import cors from "cors";
import { scheduleEmail } from "./services/email.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "ReachInbox backend is running",
  });
});

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

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});