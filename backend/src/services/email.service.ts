import { emailQueue } from "../queues/email.queue";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

interface ScheduleEmailInput {
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  senderId: string;
}

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  senderEmail: string;
}

export async function scheduleEmail(input: ScheduleEmailInput) {
  const email = await prisma.email.create({
    data: {
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
      senderId: input.senderId,
      status: "SCHEDULED",
    },
  });

  const delay = Math.max(
    0,
    input.scheduledAt.getTime() - Date.now()
  );

  const job = await emailQueue.add(
    "send-email",
    {
      emailId: email.id,
    },
    {
      jobId: `email-${email.id}`,
      delay,
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  await prisma.email.update({
    where: {
      id: email.id,
    },
    data: {
      jobId: job.id,
    },
  });

  return email;
}

export async function sendEmail(input: SendEmailInput) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: `"${input.senderEmail}" <${process.env.SMTP_USER}>`,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });

  console.log(
    `Email sent successfully: ${info.messageId}`
  );

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null,
  };
}