import { describe, expect, it, vi } from "vitest";
import { createMailer } from "@/lib/mailer";

describe("createMailer", () => {
  const cfg = { fromEmail: "contacto@monolabprintstudio.cl" };
  it("sends as the public address with Reply-To, never the SMTP login", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    await createMailer({ sendMail } as never, cfg, { sleep: vi.fn() }).send({
      to: "ana@example.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "Monolab Print Studio", address: "contacto@monolabprintstudio.cl" },
      replyTo: "contacto@monolabprintstudio.cl",
      to: "ana@example.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    });
  });
  it("retries a transient SMTP failure once more", async () => {
    const sendMail = vi.fn().mockRejectedValueOnce({ code: "ETIMEDOUT" }).mockResolvedValue({});
    await createMailer({ sendMail } as never, cfg, {
      sleep: vi.fn().mockResolvedValue(undefined),
    }).send({ to: "a@b.cl", subject: "s", text: "t", html: "h" });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
  it("does not retry permanent failures", async () => {
    const sendMail = vi.fn().mockRejectedValue({ code: "EAUTH" });
    await expect(
      createMailer({ sendMail } as never, cfg, { sleep: vi.fn() }).send({
        to: "a@b.cl",
        subject: "s",
        text: "t",
        html: "h",
      }),
    ).rejects.toBeDefined();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
