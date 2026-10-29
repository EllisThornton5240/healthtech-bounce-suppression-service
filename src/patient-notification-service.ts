import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai-email.js";

export const notificationBody = z.object({
  appointmentId: z.string().min(1),
  patientEmail: z.string().email(),
  patientName: z.string().min(1),
  appointmentTime: z.string().min(1),
  notification: z.enum(["appointment-confirmation", "appointment-reminder"]),
});
export type NotificationBody = z.infer<typeof notificationBody>;

export type Decision =
  | { kind: "suppressed"; appointmentId: string; reason: string }
  | { kind: "sent"; appointmentId: string; messageId: string };

export async function notifyPatient(input: NotificationBody): Promise<Decision> {
  const parsed = notificationBody.parse(input);
  const status = await infrai.email.suppression.check(parsed.patientEmail);
  if (status.suppressed) return { kind: "suppressed", appointmentId: parsed.appointmentId, reason: "email-suppressed" };

  const subject = parsed.notification === "appointment-confirmation" ? "Appointment confirmed" : "Appointment reminder";
  const sent = await infrai.email.send({
    to: parsed.patientEmail,
    subject,
    html: `<p>Hello ${parsed.patientName},</p><p>Your appointment is scheduled for ${parsed.appointmentTime}.</p><p>Appointment: ${parsed.appointmentId}</p>`,
  }, parsed.appointmentId);
  return { kind: "sent", appointmentId: parsed.appointmentId, messageId: sent.message_id };
}

function sendJson(response: import("node:http").ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/notifications/appointment") return sendJson(response, 404, { error: "route-not-found" });
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await notifyPatient(notificationBody.parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
    sendJson(response, 200, result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof InfraiError && error.status >= 400 && error.status < 500 ? error.status : 500;
    sendJson(response, status, { error: error instanceof Error ? error.message : "notification-failed" });
  }
});

if (process.env.START_SERVER === "1") server.listen(Number(process.env.PORT ?? 3000));
