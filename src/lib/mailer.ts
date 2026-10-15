import nodemailer, { type Transporter } from "nodemailer";
import { withRetry, type RetryOptions } from "@/lib/retry";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Gmail SMTP, fail fast: 10 s timeouts. */
export function createSmtpTransport(smtp: {
  host: string;
  port: number;
  user: string;
  pass: string;
}): Transporter {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

/** Customers only ever see FROM_EMAIL (the public alias), never the SMTP login. */
export function createMailer(
  transport: Pick<Transporter, "sendMail">,
  cfg: { fromEmail: string },
  retry: RetryOptions = {},
): Mailer {
  return {
    async send(mail) {
      await withRetry(
        () =>
          transport.sendMail({
            from: { name: "Monolab Print Studio", address: cfg.fromEmail },
            replyTo: cfg.fromEmail,
            ...mail,
          }),
        retry,
      );
    },
  };
}
