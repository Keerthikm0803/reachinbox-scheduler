
import { emailQueue } from "../queues/email.queue";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

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

/* =========================
   SINGLE EMAIL SCHEDULING
========================= */

export async function scheduleEmail(
  input: ScheduleEmailInput
) {
  const sender = await prisma.sender.findUnique({
    where: {
      email: "sender@example.com",
    },
  });

  if (!sender) {
    throw new Error(
      "Default sender not found. Please create the sender in the database."
    );
  }

  const email = await prisma.email.create({
    data: {
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
      senderId: sender.id,
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

/* =========================
   BATCH EMAIL SCHEDULING
========================= */

export async function scheduleEmailBatch(input: {
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: Date;
  senderId: string;
  delayBetweenEmails: number;
}) {
  const results = [];

  for (
    let index = 0;
    index < input.recipients.length;
    index++
  ) {
    const recipient =
      input.recipients[index].trim();

    if (!recipient) {
      continue;
    }

    const scheduledTime = new Date(
      input.scheduledAt.getTime() +
        index * input.delayBetweenEmails
    );

    const email = await scheduleEmail({
      recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt: scheduledTime,
      senderId: input.senderId,
    });

    results.push(email);
  }

  return results;
}

/* =========================
   SEND EMAIL USING RESEND
========================= */

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export async function sendEmail(
  input: SendEmailInput
) {
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "onboarding@resend.dev";

  const { data, error } =
    await resend.emails.send({
      from: fromEmail,
      to: [input.to],
      subject: input.subject,
      text: input.body,
    });

  if (error) {
    console.error(
      "Resend error:",
      error
    );

    throw new Error(error.message);
  }

  console.log(
    `Email sent successfully: ${data?.id}`
  );

  return {
    messageId: data?.id || null,
    previewUrl: null,
  };
}