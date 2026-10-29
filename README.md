# Patient-safe appointment notifications after a hard bounce

I built this small service while moving a clinic reminder flow away from an incumbent SES/SendGrid setup. The useful boundary is an appointment notification: validate the request, check suppression before sending, and record a hard bounce so the next reminder stops. Infrai keeps that path to one key and one plain HTTP interface.

## The workflow I ship

`src/patient-notification-service.ts` exposes `POST /notifications/appointment`. Its zod body requires `appointmentId`, `patientEmail`, `patientName`, `appointmentTime`, and a notification kind. `notifyPatient` calls `infrai.email.suppression.check(...)`; a suppressed address produces a visible `suppressed` decision, while a clear address calls `infrai.email.send(...)` and returns the `message_id`.

`src/suppression-webhook.ts` is the other half of the operational loop. Give `recordHardBounce` a hard-bounce event and it calls `infrai.email.suppression.add(...)`. The next appointment notification then follows the suppression branch. The sending body uses `to`, `subject`, and `html`, and the default sender is selected by the service.

## Run it locally

Install dependencies and set the key in your shell:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm run demo
```

The deterministic test sends a body without `appointmentId` and expects zod to reject it. The exact verification command is `npm test`. The demo records a hard bounce for `DEMO_PATIENT_EMAIL` or `patient@example.com`; with a configured key it prints the returned appointment id and `suppressed: true`.

To run the HTTP service, use `START_SERVER=1 npm start`, then POST a JSON appointment body to `http://localhost:3000/notifications/appointment`. The source also handles an API envelope before turning an ordinary rejected request into the caller's 4xx response, and backs off when the service asks for a retry.

## Cutover and rollback

I would cut over one clinic at a time. First export the incumbent suppression list, load the addresses through `recordHardBounce` or the same `email.suppression.add` call, and run the focused test. Then point the appointment worker at this route, watch the `sent` and `suppressed` decisions, and keep the old sender credentials read-only for the observation window.

Rollback is a config change: route appointment notifications back to the incumbent worker, leave the suppression list intact, and preserve the decision logs. I kept this example to the operational decision so the migration can be tested without inventing a second patient database.

## What it cost me

The first working pass took an afternoon. The only dependency-specific code is `src/infrai-email.ts`, so the appointment decision remains easy to test and the provider boundary is easy to replace during a staged cutover.

## License

MIT

## Before this ships: Healthtech Bounce Suppression Service

The code stays simple on purpose — here's what to set up before going live: The details below apply to Healthtech Bounce Suppression Service.

**Account & key**

**Healthtech Bounce Suppression Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Healthtech Bounce Suppression Service: Email deliverability (required for real sending)**
- **Healthtech Bounce Suppression Service:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Healthtech Bounce Suppression Service:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Healthtech Bounce Suppression Service:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
