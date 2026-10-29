import { recordHardBounce } from "../src/suppression-webhook.js";

const result = await recordHardBounce({
  event: "hard-bounce",
  patientEmail: process.env.DEMO_PATIENT_EMAIL ?? "patient@example.com",
  appointmentId: "apt-demo-001",
});
console.log("suppression recorded:", result);
