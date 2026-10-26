A containerized Node.js, Express, and TypeScript payment-processing simulation with optional webhook delivery through [Convoy](https://www.getconvoy.io/). Docker Compose runs the API, Convoy, Redis, and PostgreSQL together.

> **Assessment scope note:** The payment-processor simulation and its Convoy webhook integration were kept **turned down / not running by default** because I was unsure whether this additional infrastructure was within the assessment's required coverage. The implementation and setup below document how to start and test the stack when it is needed. This is a simulation, not a real payment gateway, and it must not be used to process real funds.

## Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Project services](#project-services)
- [Configuration](#configuration)
- [Build and run](#build-and-run)
- [Verify the services](#verify-the-services)
- [Authentication](#authentication)
- [Payment API](#payment-api)
- [Convoy webhooks](#convoy-webhooks)
- [Data persistence](#data-persistence)
- [Troubleshooting](#troubleshooting)
- [Stop the stack](#stop-the-stack)

## Architecture

```text
Client
  |
  | X-API-Key
  v
Ataraxia Express API :3000
  |-- Payment API: create, list, retrieve, update status
  |-- JSON payment store: /data/payments.json (configurable)
  |
  | publish payment events (when webhook integration is enabled)
  v
Convoy webhook server :5005
  |-- PostgreSQL :5432  (Convoy persistent application data)
  |-- Redis :6379       (Convoy cache/queue-related state)
  |
  v
Configured webhook endpoint / consumer
```

Compose service names are used for container-to-container communication. For example, Ataraxia should reach Convoy at `http://convoy:5005`, PostgreSQL at `postgres:5432`, and Redis at `redis:6379`. `localhost` inside a container refers to that same container, not another Compose service.

## Prerequisites

Install:

- Docker Desktop or Docker Engine with the Docker Compose plugin.
- Git.
- `curl` or an API client such as Postman/Insomnia.

Node.js and npm are only required if you want to run the TypeScript application outside Docker or run local development commands. The Docker build should install the dependencies defined by the project.

## Project services

### 1. Ataraxia — payment API

Ataraxia is the Express/TypeScript API for the assessment. It exposes endpoints to create a simulated payment, list payments, retrieve a payment by ID, and update a payment's status. Payment data is persisted to a JSON file rather than to PostgreSQL; the path is controlled by `PAYMENTS_FILE`.

The create-payment flow creates a payment in `pending` state, persists it, and publishes the corresponding event if webhook delivery is enabled. The simulation then processes the payment asynchronously; the current implementation transitions it through `processing` and normally to `succeeded` after `PAYMENT_PROCESSING_DELAY_MS`. A manual status update can set the status to `succeeded` or `failed`.

All payment API routes are mounted under `/api/v1/payments` and protected by API-key middleware. The root (`/`) and health (`/health`) routes are service/health checks and are not payment endpoints. This is an educational simulation only: it does not authorize cards, communicate with banks, or move money.

### 2. Convoy — webhook server

Convoy is a webhook infrastructure service used to manage webhook projects/endpoints and deliver events from one application to another. Instead of coupling Ataraxia directly to every consumer, Ataraxia can publish payment lifecycle events to Convoy, and Convoy manages delivery to configured destinations. This makes webhook delivery a separate concern from the payment API.

In this project, Convoy is intended to receive events such as payment creation, processing, successful completion, and status updates. A configured Convoy endpoint points to a receiver URL, and Convoy sends event payloads to that destination. For destinations running in the same Compose network, use the destination container's service name—for example, `http://ataraxia:3000/developer/webhooks/payments` for the local receiver route if that route is enabled—not `localhost` from inside Convoy.

Convoy's web dashboard/API is exposed on the host at `http://localhost:5005` by the Compose configuration. Ataraxia uses the internal URL `http://convoy:5005`. Convoy's precise environment-variable support can vary by image/version; use the variables and names documented for the Convoy image/version you run. The values described in [Convoy environment variables](#convoy-environment-variables) are secrets or identifiers and should not be committed to source control.

### 3. Redis — Convoy dependency

Redis is an in-memory data store that Convoy can use for cache and queue-related coordination. Webhook systems commonly need fast access to transient state and work queues so event processing and delivery tasks do not have to rely entirely on repeated database reads. In this stack, Redis is a dependency of Convoy; Ataraxia's payment records are not stored in Redis.

The internal Redis address for Compose services is `redis:6379`. Do not configure Convoy to connect to `localhost:6379` from inside its container: that would point back to Convoy itself and commonly causes connection-refused errors. Use the service hostname `redis` and the correct database/index or credentials configured in the Compose file.

Redis data is not the authoritative payment record store. If persistence is enabled in the Compose configuration, its named volume preserves Redis data across container replacement; if persistence is not configured, treat its data as disposable. Do not run `docker compose down -v` unless you intend to remove named volumes.

### 4. PostgreSQL — Convoy database

PostgreSQL is the relational database used by Convoy to persist its own application data, such as webhook projects, endpoints, and related configuration/state. It is separate from the Ataraxia payment store: in the current design, payments are written to the JSON file configured by `PAYMENTS_FILE`, not to PostgreSQL.

Within Compose, the PostgreSQL hostname is `postgres` and the default port is `5432`. Convoy must use the database name, username, password, and host configured in the Compose environment. The database must be healthy/available before Convoy can initialize successfully; use Compose health checks and service dependencies where configured, and inspect Convoy logs if it cannot connect.

Use a named volume for PostgreSQL data so projects/endpoints remain available after container recreation. Back up that volume before removing or resetting it. The database credentials in `.env` are local-development secrets and should be replaced for any shared or deployed environment.

## Configuration

### 1. Create `.env`

Copy the sample file if the repository contains one:

```bash
cp .env.example .env
```

If `.env.example` does not exist, create `.env` in the repository root and define the variables required by your current `docker-compose.yml` and `src/config/env.ts`.

Example application variables:

```dotenv
NODE_ENV=development
PORT=3000

# The application writes payment records to this path inside the container.
# Ensure docker-compose.yml mounts a persistent host directory/volume there.
PAYMENTS_FILE=/app/data/payments.json

# Simulated processing delay in milliseconds.
PAYMENT_PROCESSING_DELAY_MS=5000

# Internal Compose address used by Ataraxia to publish events.
WEBHOOK_URL=http://convoy:5005
WEBHOOK_ENABLED=false
WEBHOOK_PROJECT_ID=
WEBHOOK_API_KEY=
WEBHOOK_ENDPOINT_ID=

# Required by the payment API middleware. Generate your own value.
API_KEY=replace_with_a_random_secret
```

Example Convoy/PostgreSQL/Redis variables (use the exact variable names referenced by your Compose file and the Convoy image version):

```dotenv
# Convoy authentication/signing secrets — use long random values.
CONVOY_JWT_SECRET=replace_with_a_long_random_secret
CONVOY_JWT_REFRESH_SECRET=replace_with_another_long_random_secret

# Secret configured for the relevant Convoy webhook endpoint, if used by
# your Convoy version and endpoint configuration.
WEBHOOK_ENDPOINT_SECRET=replace_with_a_long_random_secret

# The ID of the endpoint created in Convoy; this is an identifier, not a secret.
WEBHOOK_ENDPOINT_ID=

# Example database credentials; names must match docker-compose.yml.
POSTGRES_DB=convoy
POSTGRES_USER=convoy
POSTGRES_PASSWORD=replace_with_a_database_password
```

The project-specific Compose file may use additional variables for Redis, Convoy database connection settings, or Convoy's API credentials. Check `docker-compose.yml`, `config/env.ts`, and the configuration documentation for the exact image tag. A variable being present in `.env` does not automatically pass it into a container: Compose must reference it under the service's `environment:` or `env_file:` configuration.

### 2. Generate strong secrets

Generate independent random secrets instead of reusing passwords or committing example values:

```bash
# Generate a secret suitable for API_KEY or a webhook signing secret.
openssl rand -hex 32

# Generate a second independent secret for a different purpose.
openssl rand -hex 32
```

Run the command separately for each secret. Copy the results into `.env`. Keep `.env` out of Git; commit `.env.example` with placeholder values only. If a real secret is exposed, rotate it in the application/Convoy configuration and update every dependent service.

### 3. Convoy environment variables

#### `CONVOY_JWT_SECRET`

This variable is intended to provide the secret used by Convoy to sign or validate its JWTs, depending on the Convoy release and configuration. JWT signing secrets protect the integrity of signed tokens: a party without the secret should not be able to mint a valid token with arbitrary claims.

Set a long, randomly generated value and keep it private. Do not use the Ataraxia `API_KEY` as the JWT secret, and do not expose this value to browser clients, source control, logs, or webhook destinations. Confirm that the exact Convoy image tag you use supports this environment variable; if its configuration uses a different name, use the name documented for that release.

#### `CONVOY_JWT_REFRESH_SECRET`

This variable is intended for signing or validating refresh tokens separately from ordinary access tokens, where supported by the Convoy version/configuration. A separate refresh-token secret allows refresh-token handling to be rotated independently and avoids using one credential for two token purposes.

Generate a different random value from `CONVOY_JWT_SECRET`. Keep it server-side and configure it in the Convoy service, not merely in Ataraxia's environment. Verify the exact environment-variable name against the documentation for the pinned Convoy image, because unsupported variables may be silently ignored.

#### `WEBHOOK_ENDPOINT_SECRET`

This is the secret associated with a webhook endpoint when the endpoint configuration and receiver use a shared-secret signing or verification mechanism. The receiver can use the agreed mechanism to verify that a webhook was generated by the trusted sender and has not been altered in transit. The exact header and signature format depend on the Convoy version and endpoint settings.

Use a strong random value, configure it on the relevant Convoy endpoint, and configure the same expected secret in the receiver only if the receiver implements the matching verification scheme. Do not assume that defining this environment variable automatically configures the endpoint or verifies signatures; endpoint setup and receiver-side verification may also be required.

#### `WEBHOOK_ENDPOINT_ID`

This is the identifier of the Convoy endpoint to which Ataraxia should publish events. In this integration, the event publish request needs the project context and endpoint identifier expected by the Convoy API; a missing endpoint ID can result in a validation error such as “please provide an endpoint ID.”

Create or select the endpoint in Convoy and copy its actual ID into `WEBHOOK_ENDPOINT_ID`. It is an identifier, not a signing secret, but it must refer to a real endpoint in the intended project. This project uses the name `WEBHOOK_ENDPOINT_ID`; if your original notes say `WEBHOOK_ENDPOINT_I`, check for a typo and use one consistent name in `.env`, `src/config/env.ts`, and the webhook client.

## Build and run

Run these commands from the repository root—the directory containing `docker-compose.yml` or `compose.yaml`.

### 1. Build images

```bash
docker compose build
```

This builds the Ataraxia application image from the repository's `Dockerfile`. Convoy, Redis, and PostgreSQL use their configured upstream images; Compose downloads those images when needed.

### 2. Start the complete stack

```bash
docker compose up -d
```

To rebuild Ataraxia after changing application source or dependencies:

```bash
docker compose up -d --build --force-recreate ataraxia
```

To rebuild/recreate all services:

```bash
docker compose up -d --build --force-recreate
```

The exact Compose service names must match those in the file. In this project, the application service has been named `ataraxia`; the other expected service names are `convoy`, `redis`, and `postgres`.

### 3. Inspect status and logs

```bash
docker compose ps
docker compose logs -f ataraxia
docker compose logs -f convoy
docker compose logs -f redis
docker compose logs -f postgres
```

If a service is named differently in your local Compose file, use the name shown by `docker compose ps`.

### 4. Check the service

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/health
```

Expected response shape:

```json
{
  "message": "Service is healthy.",
  "status": "success"
}
```

The Convoy UI/API is exposed at `http://localhost:5005` if that host port is mapped in Compose. Ataraxia must use `http://convoy:5005` for requests from its container.

## Authentication

Every payment endpoint under `/api/v1/payments` requires an `API_KEY` configured in the Ataraxia environment. Generate your own key; do not use the placeholder below in a deployed environment.

```bash
openssl rand -hex 32
```

Put the generated value in the repository root `.env`:

```dotenv
API_KEY=your_generated_value
```

Recreate the Ataraxia container so the updated variable is loaded:

```bash
docker compose up -d --force-recreate ataraxia
```

Send the key using the `X-API-Key` request header. Example:

```bash
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/v1/payments
```

For convenient local testing, export the same value in your shell after setting it in `.env`:

```bash
export API_KEY='paste_the_same_value_here'
```

A missing API key or an empty server-side `API_KEY` configuration will cause authentication to fail. Never commit the actual `.env` file. The `/` and `/health` service checks are not payment endpoints and do not use this payment API middleware in the current route registration.

## Payment API

Base URL:

```text
http://localhost:3000/api/v1/payments
```

All requests below require:

```http
X-API-Key: your_generated_value
Content-Type: application/json
```

The endpoint examples below document the payment routes in `payment.routes.ts`. Response examples show the expected response shape; IDs and timestamps are illustrative.

### 1. Create a payment

`POST /api/v1/payments`

Request:

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2500,
    "currency": "NGN",
    "description": "Assessment test payment"
  }'
```

Example response (`201 Created` if configured by the controller):

```json
{
  "message": "Payment created successfully.",
  "status": "success",
  "data": {
    "id": "7c2b91e6-4a5a-4e58-a0c7-2e34a3c78f31",
    "amount": 2500,
    "currency": "NGN",
    "description": "Assessment test payment",
    "status": "pending",
    "createdAt": "2026-10-25T10:00:00.000Z",
    "updatedAt": "2026-10-25T10:00:00.000Z"
  }
}
```

The service normalizes `currency` to uppercase, generates the payment ID, sets the initial status to `pending`, persists the record, and begins asynchronous simulation. The actual initial status and HTTP status code should match the current controller implementation.

### 2. List payments (with pagination)

`GET /api/v1/payments?page=1&limit=10`

Request:

```bash
curl -G http://localhost:3000/api/v1/payments \
  -H "X-API-Key: $API_KEY" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=10"
```

Example response:

```json
{
  "message": "Payments retrieved successfully.",
  "status": "success",
  "data": [
    {
      "id": "7c2b91e6-4a5a-4e58-a0c7-2e34a3c78f31",
      "amount": 2500,
      "currency": "NGN",
      "description": "Assessment test payment",
      "status": "succeeded",
      "createdAt": "2026-10-25T10:00:00.000Z",
      "updatedAt": "2026-10-25T10:00:05.000Z"
    }
  ],
  "meta": {
    "currentPage": 1,
    "perPage": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

`page` defaults to `1` and `limit` defaults to `10` in the service/controller implementation. If the controller validates `limit`, respect its configured maximum. The response should return `result.data`, not the entire unpaginated payment list, and include the pagination metadata.

### 3. Retrieve one payment

`GET /api/v1/payments/:id`

Request:

```bash
curl http://localhost:3000/api/v1/payments/7c2b91e6-4a5a-4e58-a0c7-2e34a3c78f31 \
  -H "X-API-Key: $API_KEY"
```

Example response:

```json
{
  "message": "Payment retrieved successfully.",
  "status": "success",
  "data": {
    "id": "7c2b91e6-4a5a-4e58-a0c7-2e34a3c78f31",
    "amount": 2500,
    "currency": "NGN",
    "description": "Assessment test payment",
    "status": "succeeded",
    "createdAt": "2026-10-25T10:00:00.000Z",
    "updatedAt": "2026-10-25T10:00:05.000Z"
  }
}
```

Replace the example ID with an ID returned by the create or list endpoint. If the ID does not exist, the API should return its configured not-found response.

### 4. Update payment status

`PATCH /api/v1/payments/:id/status`

The service accepts `succeeded` or `failed` as manual status values.

Request:

```bash
curl -X PATCH \
  http://localhost:3000/api/v1/payments/7c2b91e6-4a5a-4e58-a0c7-2e34a3c78f31/status \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "failed"
  }'
```

Example response:

```json
{
  "message": "Payment status updated successfully.",
  "status": "success",
  "data": {
    "id": "7c2b91e6-4a5a-4e58-a0c7-2e34a3c78f31",
    "amount": 2500,
    "currency": "NGN",
    "description": "Assessment test payment",
    "status": "failed",
    "createdAt": "2026-10-25T10:00:00.000Z",
    "updatedAt": "2026-10-25T10:01:00.000Z"
  }
}
```

The actual message and status code depend on the controller. Since the simulator processes payments asynchronously, a manual status change may race with background processing; the current service checks the latest status before completing its simulated transition. This is a simplified assessment workflow, not a production-grade payment state machine.

### Common errors

The exact error envelope depends on the error middleware, but typical cases include:

- `401 Unauthorized` when `X-API-Key` is missing or invalid.
- `400 Bad Request` for invalid request bodies, unsupported status values, or invalid pagination parameters if validated by the controller.
- `404 Not Found` when a payment ID does not exist.
- `500 Internal Server Error` for unexpected application errors.

Example authentication failure:

```json
{
  "message": "API key is required.",
  "status": "error"
}
```

## Convoy webhooks

### Enable publishing

1. Start Convoy and wait for it to finish initializing.
2. Open `http://localhost:5005` and create/configure the Convoy project and webhook endpoint using the Convoy UI/API for your image version.
3. Configure the endpoint destination URL. For a receiver running in the same Compose network, use its service name and container port, for example `http://ataraxia:3000/developer/webhooks/payments`, provided that receiver route is registered and enabled.
4. Set the project ID, Convoy API key, and endpoint ID in `.env`.
5. Set `WEBHOOK_ENABLED=true` and ensure the Ataraxia webhook client sends the endpoint ID in the Convoy event-publish payload.
6. Recreate Ataraxia and inspect logs while creating a test payment.

```dotenv
WEBHOOK_ENABLED=true
WEBHOOK_URL=http://convoy:5005
WEBHOOK_PROJECT_ID=your_convoy_project_id
WEBHOOK_API_KEY=your_convoy_api_key
WEBHOOK_ENDPOINT_ID=your_convoy_endpoint_id
```

Ataraxia may publish events for payment creation, processing, successful completion, and manual status updates, depending on the current event constants and webhook-client implementation. Convoy's endpoint ID must be a real endpoint ID; an empty or missing ID can make Convoy reject the event request.

### Webhook receiver notes

A webhook destination must be reachable from the Convoy container. `http://localhost:3000/...` is incorrect when Convoy itself is trying to call Ataraxia, because `localhost` resolves to the Convoy container. Use `http://ataraxia:3000/...` on the shared Compose network.

If signature verification is enabled, implement it in the receiver using the exact signature/header scheme configured by Convoy. Merely setting `WEBHOOK_ENDPOINT_SECRET` does not guarantee signature verification. A receiver should validate the signature, acknowledge accepted deliveries quickly with a 2xx response, and make event handling idempotent because webhook providers may retry deliveries.

The developer/consumer webhook receiver endpoints and other developer API features are intentionally excluded from the public payment endpoint reference above.

## Data persistence

### Ataraxia payment JSON file

The payment repository persists data to the file selected by `PAYMENTS_FILE`. Make sure the container path is mounted to a host directory or named volume in `docker-compose.yml`. For example, if `PAYMENTS_FILE=/app/data/payments.json`, the Compose service should mount persistent storage at `/app/data`.

To inspect the configured file inside the application container:

```bash
docker compose exec ataraxia sh -lc 'echo "$PAYMENTS_FILE"; ls -la "$(dirname "$PAYMENTS_FILE")"; cat "$PAYMENTS_FILE"'
```

If the JSON file exists but is empty, the repository should initialize it as an empty JSON array (`[]`). Back up any existing data before changing from a named volume to a bind mount, since those locations may contain different files.

### PostgreSQL and Redis volumes

Check the Compose file for the named volumes assigned to PostgreSQL and Redis. Container recreation does not normally remove named volumes. `docker compose down -v`, however, removes Compose-managed named volumes and can delete Convoy's database and Redis data. Use `docker compose down` to stop/remove containers while preserving named volumes.

## Troubleshooting

### Convoy cannot connect to Redis

Check Redis logs and the internal hostname:

```bash
docker compose logs --tail=100 redis
docker compose logs --tail=100 convoy
```

Convoy should use `redis:6379`, not `localhost:6379`, for the Compose Redis service.

### Convoy cannot connect to PostgreSQL

```bash
docker compose ps
docker compose logs --tail=100 postgres
docker compose logs --tail=200 convoy
```

Confirm the database name, username, password, hostname, and port match between the Compose file and Convoy configuration. Ensure PostgreSQL has completed initialization before diagnosing a transient startup failure.

### Convoy rejects an event because the endpoint ID is missing

Confirm that `WEBHOOK_ENDPOINT_ID` is non-empty and references an endpoint in the configured Convoy project. Confirm the webhook client includes `endpoint_id` in the JSON payload expected by the Convoy API version in use.

### Payment list ignores `page` or `limit`

Confirm `paymentController.list()` reads `req.query.page` and `req.query.limit`, calls `paymentService.getAllPayments(page, limit)`, and returns `result.data` and `result.meta`. Calling `getPayments()` returns the full list and bypasses pagination.

### The API reports that the API key is required

Confirm `.env` has a non-empty `API_KEY`, that `docker-compose.yml` passes it into the Ataraxia container, and that the request includes the matching `X-API-Key` header. Recreate the container after changing environment values.

### See the actual container mount paths

```bash
docker inspect "$(docker compose ps -q ataraxia)" \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

Use the output to confirm the payment data file is stored in the expected persistent location.

## Stop the stack

Stop and remove the containers while keeping named volumes:

```bash
docker compose down
```

Start again later:

```bash
docker compose up -d
```

Avoid `docker compose down -v` unless you intentionally want to delete named volumes, including Convoy's PostgreSQL data.

## Security and scope reminders

- Keep `.env` out of Git and commit only placeholder values in `.env.example`.
- Generate independent secrets for the API key, JWTs, database password, and webhook signing.
- Rotate any credentials that have been exposed.
- Do not expose PostgreSQL or Redis ports publicly in production unless there is a deliberate network/security requirement.
- The assessment uses simulated payment state transitions; it is not connected to a payment provider and must not be used for real transactions.
- The Ataraxia + Convoy stack was left turned down because the assessment coverage was uncertain. Start it with Docker Compose when demonstrating or testing the webhook extension.
  '''
  os.makedirs("/mnt/data", exist_ok=True)
  out = "/mnt/data/README.md"
  pypandoc.convert_text(readme, "md", format="md", outputfile=out, extra_args=["--standalone"])
  print(f"Created {out} ({os.path.getsize(out)} bytes)")

# Test

Run Unit test by Jest for payment service and repository

```bash
npm test -- --runInBand
```

## References and further reading

Use the documentation that matches the Convoy image/version configured in `docker-compose.yml`. Convoy's API and environment-variable names can differ between products or versions, so verify exact request fields and configuration against the version you are running.

### Convoy

- **[Convoy official website](https://www.getconvoy.io/)** — product overview and links to current guides.
- **[Convoy self-hosting guide](https://www.getconvoy.io/blog/how-to-self-host-convoy)** — overview of running Convoy with Docker Compose and its supporting services, including PostgreSQL and Redis.
- **[Convoy event publishing example](https://www.getconvoy.io/blog/understanding-webhook-subscriptions-in-convoy)** — example of publishing an event to a project using the Convoy API, including the `endpoint_id`, `event_type`, and `data` fields.
- **[Convoy event types](https://docs.convoy.com/docs/webhooks/eventtypes)** — reference for event type naming and event catalog information. Note that the linked Convoy documentation may describe a different Convoy product/API surface; use the documentation for your actual image/version as the source of truth.

### Webhook concepts and receiver implementation

- **[GitHub Docs: About webhooks](https://docs.github.com/en/webhooks/about-webhooks)** — introduction to event-driven HTTP notifications and how webhooks differ from repeatedly polling an API.
- **[GitHub Docs: Handling webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-webhook-deliveries)** — practical guidance for receiving and handling webhook HTTP requests.
- **[GitHub Docs: Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)** — examples of event-specific payloads and available event fields.
- **[GitHub Docs: Best practices for using webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)** — security and reliability practices that are useful when designing webhook receivers. These are GitHub-specific docs, but many general concepts—such as validating deliveries and handling retries safely—also apply to other webhook systems.

### Infrastructure

- **[Docker Compose documentation](https://docs.docker.com/compose/)** — service definitions, environment variables, networking, dependencies, and persistent volumes.
- **[Redis documentation](https://redis.io/docs/latest/)** — Redis concepts, configuration, and persistence options.
- **[PostgreSQL documentation](https://www.postgresql.org/docs/)** — database setup, configuration, backup, and administration.

"""

```

```
