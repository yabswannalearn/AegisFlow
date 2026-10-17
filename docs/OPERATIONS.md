# AegisFlow operations and portfolio walkthrough

Use synthetic records. Keep public demo mode enabled only on a synthetic database.

## Local services

`docker compose up -d` starts dedicated `aegisflow-postgres` (5434) and `aegisflow-n8n` (5679) containers. It does not alter an existing n8n service on 5678. PostgreSQL and n8n have persistent named volumes; never use `down -v` on a database you need to retain.

Run `npm ci`, `npm run env:init`, and `npm run db:migrate` before starting the app on 3005. The initializer preserves an existing `.env`. Keep the encryption keys stable across restarts: replacing them makes existing encrypted data unreadable. Store backups and keys separately.

Set the n8n Gemini credential reference in `.env`, then generate and import the workflows:

```sh
npm run workflows:generate
docker exec aegisflow-n8n n8n import:workflow --separate --input=/home/node/workflows
docker exec aegisflow-n8n n8n publish:workflow --id=TCc5M9TUgKMpOJHN
docker exec aegisflow-n8n n8n publish:workflow --id=AegisOnboardingDispatch02
docker exec aegisflow-n8n n8n publish:workflow --id=AegisOnboardingComplete03
docker restart aegisflow-n8n
```

The credential must exist in this isolated n8n instance. Alternatively import each JSON through its editor, choose the credential, and publish. The error workflow is imported as an error-trigger reference; the triage workflow also has explicit sanitized failure callbacks. Code nodes require native `crypto` and environment access, configured in Compose. Execution payload saving is disabled for success, error, and manual executions. Do not enable payload capture when testing anything other than synthetic data.

## Use an existing n8n instance on port 5678

This is the selected configuration on this machine. The existing instance retains its owner, saved credentials, volumes, and unrelated workflows. The four AegisFlow workflows use their original IDs; updating them does not create duplicate workflows. The isolated instance on 5679 is an optional fresh-install alternative.

Apply `n8n/existing-instance.override.yml` after the existing instance's Compose file, with AegisFlow's `.env` used for interpolation. It supplies only the webhook/tool secrets, callback URL, and Code-node settings. It preserves the existing n8n encryption key and does not supply the Patient Vault encryption key or Gmail/HubSpot credentials to n8n. On this machine, from the AegisFlow directory:

```powershell
docker compose --env-file .env -f ../n8n/docker-compose.yml -f n8n/existing-instance.override.yml up -d n8n
docker cp n8n/workflows n8n:/tmp/aegisflow-workflows
docker exec n8n n8n import:workflow --separate --input=/tmp/aegisflow-workflows
docker exec n8n n8n publish:workflow --id=TCc5M9TUgKMpOJHN
docker exec n8n n8n publish:workflow --id=AegisOnboardingDispatch02
docker exec n8n n8n publish:workflow --id=AegisOnboardingComplete03
docker restart n8n
docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.existing-n8n.yml up -d app postgres
```

Adjust the first Compose path and container name for another machine. Importing updates these four IDs and deactivates their previous versions; publish the three webhook workflows and restart n8n before directing traffic to them. The fourth workflow uses an Error Trigger and does not need a published webhook. Before an update, retain a consistent n8n database backup; credentials in that database remain encrypted.

For a host-run development app, set the three `N8N_*_WEBHOOK_URL` values to `http://localhost:5678/webhook/aegis-triage`, `http://localhost:5678/webhook/aegis-onboarding-dispatch`, and `http://localhost:5678/webhook/aegis-onboarding-complete`. The Docker app uses `host.docker.internal:5678` through `docker-compose.existing-n8n.yml`. n8n calls the application at `host.docker.internal:3005`.

Each AegisFlow workflow disables execution payload saving individually; unrelated workflows retain their own settings. The existing instance's Code nodes need environment access and the `crypto` built-in. Keep the editor and existing workflow authors trusted.

## Gmail

Configure a Gmail OAuth client and grant with sending, profile, and message-search access. The message search is needed to detect a delivery accepted before a lost response. Store client ID, client secret, and refresh token in the app environment. The application refreshes access itself; it does not call n8n with an email address or capability.

In demo mode, an empty `GMAIL_TEST_RECIPIENT` returns `PREVIEW_ONLY` and the clinician can open the invitation on screen. If a controlled inbox is configured, all demo deliveries redirect there. Changing Gmail credentials requires an app restart. A reconnect must complete Google's callback; an old saved credential can still contain an expired grant.

An invitation retains its SHA-256 lookup hash and a temporary encrypted capability. Confirmed email delivery, expiration cleanup, or booking clears the encrypted capability. The raw capability is absent from telemetry and n8n. A stable subject reference derived from the token hash and a sent-mail lookup reduce duplicate delivery after an ambiguous timeout; this is not a distributed exactly-once guarantee. Gmail rewrote a custom Message-ID during the live self-test, so deduplication does not depend on that header. The Gmail API supports [message searching through its q parameter](https://developers.google.com/workspace/gmail/api/guides/filtering).

## Standalone Docker deployment

The image uses Node 22, builds Next.js standalone output, and runs the application as the `node` user. `.dockerignore` excludes `.env`, credential exports, local test output, and browser downloads.

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml build app migrate
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d postgres
docker compose -f docker-compose.yml -f docker-compose.production.yml --profile migration run --rm migrate
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d app n8n
```

Before internet publication:

1. Choose the hosting platform and HTTPS application hostname. Set `NEXT_PUBLIC_APP_URL` before building so browser and server links agree.
2. Provision persistent PostgreSQL and n8n storage and inject the generated secrets through the hosting platform. Keep the n8n editor private. Run `prisma migrate deploy` once per release before switching traffic.
3. Set the three app-to-n8n webhook URLs and n8n's `NEXTJS_INTERNAL_URL` to reachable internal addresses. In this Compose topology the override uses service DNS automatically. External CRM review links use the public app URL.
   The override also sets `AEGIS_ALLOWED_ORIGIN` to that public URL so browser submissions pass the origin check through container port mapping. Cross-site origins remain denied.
4. Keep `AEGIS_OUTBOX_WORKER=true` on at least one running Node process. On a scale-to-zero or serverless host, instead schedule authenticated POST requests to `/api/internal/outbox` with `Authorization: Bearer <AEGIS_WORKER_SECRET>`. An in-process interval cannot run while its host is asleep.
5. For a public portfolio, retain `AEGIS_DEMO_MODE=true`, leave the email recipient empty, protect credentials, and enable host-level request limits. Demo clinician access is intentional and must only reach synthetic records. Setting demo mode false disables the demo login; an actual identity-provider integration is still required for real staff access.

The local Compose ports bind to loopback. Configure HTTPS, reverse proxy, health monitoring, backups, secret management, and platform access controls before making a deployment public. The repository does not provision those services or claim production medical readiness.

## This machine's Docker storage

At the user's request, Docker's local runtime data was relocated to `D:\DockerData`. Both virtual disks were checked with SHA-256 before cutover, and the original data was retained at `D:\DockerData-migration-backup-20261016`. The original `%LOCALAPPDATA%\Docker` path redirects to D: through a junction; WSL's `docker-desktop` distribution is registered directly at `D:\DockerData\wsl\engine`, and Docker's WSL storage setting points to `D:\DockerData\wsl`. WSL cannot mount its bootstrap disk through the junction alone.

All four pre-existing containers were restored, including the separate n8n and Twenty CRM database. Do not remove the active D: folder or its compatibility junction. The backup is separate from active storage and remains available for recovery. Docker Desktop's application binaries retain their standard installation location.

## Retry behavior

The intake transaction stores a signed-dispatch payload encrypted in `OutboxDelivery`. Workers claim deliveries with a lease, so concurrent workers cannot claim the same unexpired job. HTTP delivery times out after three seconds and retries with bounded exponential delay. An expired processing lease is recoverable after a crash. A 202 acknowledgement is followed by a two-minute completion check; a missing callback returns the delivery to the queue. Five unsuccessful attempts mark it failed.

The inspector shows pending attempts and sanitized errors. An authenticated Retry action requeues a failed triage without creating a new patient. Downstream approval and completion deliveries recover automatically. A critical case stops at the emergency advisory and cannot receive an approval token. A late callback cannot undo approval or a completed booking.

Simulation requires both demo mode and `DEMO_SIMULATE_N8N_IF_SLEEPING=true`. The verified live configuration leaves fallback disabled. To distinguish upstream model failure from infrastructure failure, inspect sanitized outbox status and the current n8n workflow, without turning on raw execution persistence.

## Three-minute recruiter walkthrough

1. Select Routine Dermatology and submit. Show the encrypted vault fields, scrubbed outbound payload, live Gemini result, and numeric HubSpot IDs. Explain that the two tools use synthetic payer/routing data.
2. Open the clinician vault and use the demo sign-in. Show the decryption audit entry, review the recommendation, and approve. The normal public demo presents a portal link without sending email.
3. Complete synthetic card verification, signature, and a future appointment. Refresh to show the receipt; replaying the same completion returns 410. The HubSpot pipeline advances to completed onboarding.
4. Submit the emergency preset and show that server-side approval returns 409. Explain the privacy and clinical limits in the README.

`npm run test:e2e` records this flow under `test-results/`. Tokens visible in successful lifecycle evidence have been burned. Never publish an unexpired invitation, a credential screenshot, or genuine patient details.
