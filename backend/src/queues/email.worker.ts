import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../services/email.service";
import { acquireEmailSlot } from "../services/rate-limit.service";

const prisma = new PrismaClient();

const emailWorker = new Worker(
  "email-queue",
  async (job) => {
    console.log("Processing email job:", job.id);
    console.log("Job data:", job.data);

    const { emailId } = job.data;

    const email = await prisma.email.findUnique({
      where: {
        id: emailId,
      },
      include: {
        sender: true,
      },
    });

    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    // Prevent duplicate sending
    if (email.status === "SENT") {
      console.log(`Email ${emailId} already sent. Skipping.`);
      return;
    }

    // Check Redis rate limits
    const slot = await acquireEmailSlot(email.senderId);

    if (!slot.allowed) {
      console.log(
        `Rate limit reached. Rescheduling job ${job.id} in ${slot.delay}ms`
      );

      await job.moveToDelayed(
        Date.now() + slot.delay,
        job.token
      );

      return;
    }

    try {
      const result = await sendEmail({
        to: email.recipient,
        subject: email.subject,
        body: email.body,
        senderEmail: email.sender.email,
      });

      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          previewUrl: result.previewUrl,
        },
      });

      console.log(`Email ${emailId} marked as SENT`);
    } catch (error) {
      console.error(`Failed to send email ${emailId}:`, error);

      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: "FAILED",
          error:
            error instanceof Error
              ? error.message
              : "Unknown email sending error",
          attempts: {
            increment: 1,
          },
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: Number(
      process.env.WORKER_CONCURRENCY || 5
    ),
  }
);

emailWorker.on("completed", (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `Email job ${job?.id} failed:`,
    error.message
  );
});

emailWorker.on("error", (error) => {
  console.error("Worker error:", error);
});

console.log(
  `Email worker started with concurrency: ${
    process.env.WORKER_CONCURRENCY || 5
  }`
);