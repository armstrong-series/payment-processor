# Payment Processor API

An Express.js and TypeScript payment-processing API integrated with [Convoy](https://www.getconvoy.io/) for webhook delivery. The application and its supporting infrastructure run using Docker Compose.

## Table of Contents

- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Environment Configuration](#environment-configuration)
- [Docker Services and Images](#docker-services-and-images)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Convoy Dashboard](#convoy-dashboard)
- [Useful Docker Commands](#useful-docker-commands)
- [Troubleshooting](#troubleshooting)

## Architecture

The application uses Docker Compose to run the API, Convoy, PostgreSQL, and Redis.

```text
Client
  |
  v
Express / TypeScript API
  |
  | Payment processing
  |
  v
Convoy Webhook Server
  |
  | Webhook delivery and retry handling
  v
Registered Webhook Endpoints

Convoy
  |
  +---- PostgreSQL (persistent database)
  |
  +---- Redis (cache and supporting operations)
```

### Service responsibilities

- **API:** Accepts HTTP requests and processes payments.
- **Convoy:** Manages webhook projects, endpoints, event delivery, and retries.
- **PostgreSQL:** Stores Convoy's persistent application data.
- **Redis:** Provides caching and other supporting functionality required by Convoy.

## Technology Stack

- Node.js
- TypeScript
- Express.js
- Convoy Webhook Server
- PostgreSQL 15
- Redis 7
- Docker and Docker Compose

## Prerequisites

Install the following before starting:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git
- A terminal

Verify Docker is available:

```bash
docker --version
docker compose version
```

## Project Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd payment-processor
```

Replace `<repository-url>` with the actual Git repository URL.

### 2. Configure environment variables

Create a `.env` file in the project root.

```env
NODE_ENV=development

CONVOY_JWT_SECRET=replace-with-a-long-random-secret

WEBHOOK_ENABLED=false
WEBHOOK_PROJECT_ID=
WEBHOOK_API_KEY=

PAYMENT_PROCESSING_DELAY_MS=5000
```

Generate a random JWT secret using:

```bash
openssl rand -hex 32
```

Use the generated value for `CONVOY_JWT_SECRET`. Add any other variables required by the application's existing configuration.

**Important:** Never commit `.env` or real API keys to version control. Commit a sanitized `.env.example` instead.

## Docker Services and Images

Docker Compose manages the application and its supporting services.

| Service    | Image or build source               | Purpose                         |
| ---------- | ----------------------------------- | ------------------------------- |
| `ataraxia` | Built from the project's Dockerfile | Express/TypeScript API          |
| `convoy`   | `getconvoy/convoy:latest`           | Webhook management and delivery |
| `postgres` | `postgres:15-alpine`                | Convoy's persistent database    |
| `redis`    | `redis:7-alpine`                    | Convoy's Redis service          |

### Image configuration

#### 1. Application API

The `ataraxia` service is built from the local Dockerfile.

It exposes port `3000` and uses a Docker volume to persist payment data.

```yaml
ports:
  - "3000:3000"
volumes:
  - payment_data:/app/data
```

#### 2. Convoy

The Convoy service uses the official Convoy container image.

```yaml
image: getconvoy/convoy:latest
ports:
  - "5005:5005"
```

The dashboard is accessed from the host machine at `http://localhost:5005`.

Inside Docker, the API should use `http://convoy:5005` to communicate with Convoy.

#### 3. PostgreSQL

PostgreSQL stores Convoy's database records.

```yaml
image: postgres:15-alpine
```

The database is available to other containers through the hostname `postgres` on the Compose network.

#### 4. Redis

Redis provides caching and supporting services for Convoy.

```yaml
image: redis:7-alpine
```

The Redis hostname inside Docker Compose is `redis`, and the default port is `6379`.

### Image versioning

For reproducible deployments, consider pinning Convoy to a tested release or image digest instead of relying indefinitely on `latest`.

## Database Setup

### PostgreSQL configuration

The Compose configuration creates a PostgreSQL database named `convoy`.

Example configuration:

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: password
    POSTGRES_DB: convoy
  volumes:
    - pg_data:/var/lib/postgresql/data
```

These example credentials are for local development only. Use secrets or environment variables for deployment environments.

### Initialize Convoy's database tables

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Run Convoy's database migrations:

```bash
docker compose run --rm --no-deps convoy migrate up
```

The migration process creates or updates the tables and other database objects required by Convoy.

After successful migration, start Convoy:

```bash
docker compose up -d convoy
```

### Verify the database

List the PostgreSQL schemas:

```bash
docker compose exec postgres \
  psql -U postgres -d convoy -c '\dn'
```

List tables in Convoy's schema:

```bash
docker compose exec postgres \
  psql -U postgres -d convoy -c '\dt convoy.*'
```

If the schema or tables are missing, inspect the migration output and Convoy logs before attempting to create tables manually.

**Note:** These migrations belong to Convoy. If the payment-processing API later uses PostgreSQL directly, its own application tables should be managed separately through the application's chosen migration tool.

## Running the Application

### Start all services

Build the API image and start the complete stack:

```bash
docker compose up -d --build
```

Check service status:

```bash
docker compose ps -a
```

View application logs:

```bash
docker compose logs -f ataraxia
```

View Convoy logs:

```bash
docker compose logs -f convoy
```

### Access the services

| Service          | Local address           |
| ---------------- | ----------------------- |
| Payment API      | `http://localhost:3000` |
| Convoy dashboard | `http://localhost:5005` |
| PostgreSQL       | Internal Docker network |
| Redis            | Internal Docker network |

PostgreSQL and Redis do not need host port mappings unless you specifically require access from outside the Compose network.

## Convoy Dashboard

Once Convoy is running:

1. Open `http://localhost:5005`.
2. Sign in using the initial superuser credentials printed in the Convoy startup logs, if initial setup created them.
3. Change any default credentials before using the environment beyond local development.
4. Create or select the organization and project required by the assessment.
5. Configure the relevant webhook endpoint and event subscriptions.
6. Copy the project's ID and API key into the API's environment configuration.
7. Enable webhook integration only after the application has been configured correctly.

Set the following variables using the actual values from Convoy:

```env
WEBHOOK_ENABLED=true
WEBHOOK_PROJECT_ID=your-project-id
WEBHOOK_API_KEY=your-project-api-key
```

The API's environment variable names must match the names used in the application's TypeScript configuration.

Inside Docker Compose, the application should use the Convoy service hostname, not `localhost`:

```env
WEBHOOK_URL=http://convoy:5005
```

`localhost` inside the API container refers to the API container itself.

## Useful Docker Commands

### Start the stack

```bash
docker compose up -d
```

### Rebuild the API

```bash
docker compose up -d --build ataraxia
```

### Restart Convoy

```bash
docker compose up -d --force-recreate convoy
```

### Inspect service status

```bash
docker compose ps -a
```

### View recent logs

```bash
docker compose logs --tail=100 convoy
docker compose logs --tail=100 postgres
docker compose logs --tail=100 redis
```

### Stop services

```bash
docker compose down
```

This stops and removes the containers but preserves named volumes.

### Reset local development data

**Warning:** The following command permanently removes the named Compose volumes and the data stored in them, including PostgreSQL data.

```bash
docker compose down -v
```

Do not run this command if you need to preserve your existing data.

## Troubleshooting

### Convoy cannot connect to Redis

If the logs contain an error such as:

```text
dial tcp [::1]:6379: connect: connection refused
```

Convoy is attempting to connect to the local loopback address instead of the Redis container.

Check that Convoy's effective Redis configuration uses:

- Host: `redis`
- Port: `6379`
- Scheme: `redis`

Then recreate the Convoy container and inspect its logs.

### PostgreSQL tables are missing

Run the migration command again and inspect its output:

```bash
docker compose run --rm --no-deps convoy migrate up
```

Confirm that PostgreSQL is running and that Convoy is configured to use the intended database.

### Convoy keeps restarting

Inspect the logs:

```bash
docker compose logs --tail=100 convoy
```

Check database connectivity, Redis configuration, JWT secrets, and migration status.

### API cannot connect to Convoy

Use `http://convoy:5005` from the API container. Confirm that both services are attached to the same Docker Compose network.

## Data Persistence

Named Docker volumes are used to retain data across container restarts.

| Volume         | Purpose                     |
| -------------- | --------------------------- |
| `payment_data` | Application payment data    |
| `convoy_data`  | Convoy-related mounted data |
| `pg_data`      | PostgreSQL database files   |
| `redis_data`   | Redis persistence data      |

Container recreation does not normally delete these named volumes. Removing volumes with `docker compose down -v` does.

## Security Notes

- Do not commit real secrets or credentials.
- Replace default passwords before deploying.
- Restrict PostgreSQL and Redis to trusted networks.
- Pin and regularly update container image versions.
- Use HTTPS and appropriate authentication for deployed services.
- Keep payment processing and webhook delivery credentials separate.
