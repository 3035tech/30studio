# Docker development

The development stack keeps application services in Docker. The default stack starts PostgreSQL 18, a one-shot migration job, a local demo-account seed, and the Next.js app. LocalStack S3, bucket initialization, and the media worker are opt-in under the `media` profile.

## Configure

Copy `.env.example` to the ignored `.env` file and set:

- `LOCAL_POSTGRES_PASSWORD`: a URL-safe local database password.
- `BETTER_AUTH_SECRET`: a private development secret.
- `STUDIO_LOCAL_PORT`: optional host port for the app (defaults to `3000`).
- `LOCALSTACK_AUTH_TOKEN`: required only when starting the `media` profile. Keep it out of Git.
- `OPENAI_API_KEY` and `OPENAI_MODEL`: optional, for AI copy, review, and competitor analysis. `OPENAI_IMAGE_MODEL` is optional for AI image jobs. Local text-card rendering does not call an AI provider.

The development compose file exposes the web app on loopback port 3000 by default. Set `STUDIO_LOCAL_PORT=3001` if another app already uses 3000. LocalStack, when enabled, binds to loopback port 4566. PostgreSQL has no host port. Its named volume persists between runs.

The `seed-local-user` one-shot creates a verified local demo owner after migrations. Sign in with:

- Email: `demo@30studio.local`
- Password: `30studio-local-only`

This account is intentionally public and restricted to the Docker development stack. The seed refuses non-development mode and non-loopback/non-Compose database hosts. It never resets an existing account's password. Do not use these credentials outside local development.

## Start the app

```sh
docker compose -f compose.dev.yaml up --build
```

Open `http://localhost:3000`. Migrations run before the app starts. S3 objects use the private `30studio-media` bucket inside LocalStack.

To run local object storage and the durable media worker too, set `LOCALSTACK_AUTH_TOKEN` first:

```sh
docker compose -f compose.dev.yaml --profile media up --build
```

To populate the demo workspace with synthetic records and locally generated artwork, set `LOCALSTACK_AUTH_TOKEN` and run:

```sh
docker compose -f compose.dev.yaml --profile media --profile demo-data run --rm seed-demo-data
```

The sample dataset adds 100 brands, 200 social profiles, 100 campaigns, 200 content items and versions, 200 review requests, 100 publication jobs, analytics, competitor-monitoring records, team history, and 300 generated local artwork files. Sample competitor sources stay paused or archived, and publication jobs use terminal states so no worker contacts a social network or feed. The script only accepts the explicitly enabled local Docker database and LocalStack bucket. It does not create login credentials, sessions, OAuth state, or social tokens. Re-running it detects the existing sample brand and leaves the dataset unchanged.

The worker accepts local text-card jobs without an OpenAI key. AI image jobs require `OPENAI_API_KEY` and `OPENAI_IMAGE_MODEL` to be set in `.env`.

To run public competitor RSS/Atom collection, start the `competitors` profile:

```sh
docker compose -f compose.dev.yaml --profile competitors up --build
```

The collector only reads configured HTTPS feeds, checks them about hourly, limits each response to 1 MB and 50 entries, and stores feed metadata with source links. It does not collect engagement metrics or generate AI themes.

Stop containers with `docker compose -f compose.dev.yaml down`. This preserves the named PostgreSQL volume. Use `docker compose -f compose.dev.yaml down --volumes` only when intentionally deleting this local 30studio database.

## Storage endpoint protection

The S3 client accepts the exact `http://localstack:4566` Docker service endpoint only when `NODE_ENV=development`. Existing loopback-only endpoints remain available for LocalStack tests. Production continues to use AWS's default endpoint or an explicitly configured loopback test endpoint; it does not accept arbitrary private-network hosts.
