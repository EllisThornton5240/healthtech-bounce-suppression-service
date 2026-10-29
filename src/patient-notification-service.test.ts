import test from "node:test";
import assert from "node:assert/strict";
import { notificationBody } from "./patient-notification-service.js";

test("rejects a notification without a patient-safe appointment identity", () => {
  const result = notificationBody.safeParse({
    patientEmail: "person@example.com",
    patientName: "Pat",
    appointmentTime: "2026-11-03 09:30",
    notification: "appointment-reminder",
  });
  assert.equal(result.success, false);
});
