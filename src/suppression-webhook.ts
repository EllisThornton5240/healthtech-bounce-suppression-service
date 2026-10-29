import { z } from "zod";
import { infrai } from "./infrai-email.js";

const bounceBody = z.object({
  event: z.literal("hard-bounce"),
  patientEmail: z.string().email(),
  appointmentId: z.string().min(1),
});

export async function recordHardBounce(input: unknown): Promise<{ appointmentId: string; suppressed: true }> {
  const bounce = bounceBody.parse(input);
  await infrai.email.suppression.add(bounce.patientEmail, "hard_bounce");
  return { appointmentId: bounce.appointmentId, suppressed: true };
}
