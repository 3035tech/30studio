# Brand media storage

The brand library stores PNG, JPEG, and WebP brand images in a private S3-compatible bucket. The server uses AWS SDK for JavaScript v3 (Apache-2.0) for presigned uploads/downloads and Sharp (Apache-2.0) for bounded image decoding. It supports logos and visual template references; it does not import editable design templates, video, SVG, or archives. Node.js 20.9 or newer is required by the selected runtime dependencies.

## Request flow

1. An authorized brand manager creates an upload session. The server scopes the brand to the authenticated organization, creates an immutable database record, generates separate keys for the final asset and temporary upload, and returns a five-minute presigned POST restricted to the temporary key.
2. The POST policy limits the object to the declared byte length (maximum 10 MiB), MIME type, generated key, and expected SHA-256 metadata. The browser uploads directly to the private bucket.
3. The authenticated finalize request reads the temporary object through the server SDK, checks size/type/metadata, computes SHA-256 from the stored bytes, decodes the image with Sharp under a 20-megapixel limit, and writes those exact verified bytes to a separate final object key. Only then does the asset enter `pending_review`; the temporary object is deleted best-effort.
4. A brand manager approves or rejects the immutable asset. Each decision is appended to `brand_asset_reviews`. Only approved assets are visible to ordinary brand readers. Authorized previews use a 60-second presigned GET URL.

Invalid bytes are deleted and the pending database record is removed. A still-valid presigned upload can only modify the temporary key; it cannot replace the verified final object after review. Storage outages preserve the pending record so an upload can be finalized after recovery. Abandoned uploads are eligible for cleanup after 24 hours.

Run `npm run maintenance:cleanup-brand-assets` daily with the application database and storage credentials. The bounded job processes at most 100 records per run, deletes each staging object before removing its still-pending database record, and leaves failures for a later retry. Schedule it from the deployment environment; multiple copies are safe because the final database delete rechecks the pending state and age.

## Runtime configuration

- `AWS_REGION`: bucket region.
- `STUDIO_ASSET_BUCKET`: dedicated bucket name for 30studio.
- `STUDIO_ASSET_ENDPOINT`: optional endpoint for a local S3 emulator only. Leave empty in AWS production.
- Use the AWS SDK default credential provider chain. On Dublin, prefer a dedicated workload role/identity or secret-manager integration. Do not add static AWS credentials to `.env`, GitOps ConfigMaps, or the repository.

The application does not create buckets or IAM users. Infrastructure provisioning and runtime identity are separate authorized GitOps/AWS work. The bucket must remain private with S3 Block Public Access enabled and ACLs disabled. Enable default encryption and versioning according to the account's retention policy.

Grant the runtime identity only `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::<dedicated-bucket>/tenants/*`. The application does not need `ListBucket`, bucket administration, or public access. If the bucket uses a customer-managed KMS key, add only the required key permissions to that identity and key policy.

The browser uploads with a presigned POST, so configure bucket CORS for the exact 30studio HTTPS origin and `POST` only. Permit the headers sent by the browser form, and do not use a wildcard origin. Preview uses a short-lived signed URL opened as a document; it does not expose bucket listing or credentials.

## LocalStack

See [tests/localstack/README.md](../tests/localstack/README.md). The compose file pins the image version, binds the gateway to loopback, and requires a LocalStack auth token through the shell. The test uses dummy AWS credentials, rejects non-loopback endpoints, and creates/deletes a uniquely named temporary bucket.

LocalStack verifies SDK request signing and S3 API behavior. It does not prove AWS IAM policy correctness, S3 CORS behavior in a real browser, lifecycle rules, backup/restore, or production encryption settings.

## Generated content images

Image generation is separate from the brand library. Each job is stored in PostgreSQL and is bound by composite tenant, brand, post, and immutable content-version keys. Requests require a tenant idempotency key and each content version is limited to three image jobs. A worker claims due jobs with row locks, recovers expired leases, retries a bounded number of times, and marks exhausted jobs failed. Workers can run in parallel because each claim is leased to one process.

The worker uses AI SDK's OpenAI image provider and Sharp to decode, resize/normalize as WebP, enforce a 20-megapixel/10 MiB bound, calculate SHA-256, and write to the same private bucket under `tenants/<organization>/brands/<brand>/content/<item>/<version>/`. Generated images enter `pending_review`; content approvers can approve or reject them. This media review does not approve the copy or authorize publication. Images stay private and previews use short-lived signed URLs. The AI image path still asks for no text/logos.

The media queue also supports a local text-card template. It renders saved channel copy with an approved Brand Kit accent color through SVG and Sharp, without an external model, logo, or invented brand mark. Cards use a neutral composition and enter the same private-storage and human-review flow as generated images. This is a starter template; it is not a substitute for an imported official logo or final Brand Kit design system. A three-page static carousel splits the saved channel copy across ordered square cards; its pages share an idempotent group and can only be reviewed together. Platform-specific export sizes and editable page copy remain unimplemented.

The AI image path sends the saved channel copy and approved Brand Kit snapshot to the configured image provider only after a user requests it. Configure `OPENAI_API_KEY` and `OPENAI_IMAGE_MODEL` in the runtime secret/config system. The local Docker worker stack is documented in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md); production deployment wiring, autoscaling, resource limits, alerts and credential provisioning remain backlog work. Provider cost, retention terms and rights for generated images require review before production.

## Remaining media work

- Configure production scheduling and monitoring for the bounded cleanup job.
- Add usage references and richer review history to the UI. Carousel page copy editing and channel export presets are implemented.
- Add deletion/retention of generated images, retry/review audit views, worker observability, and cost/usage accounting.
- Import official brand kits/templates from user-provided source archives with malware scanning and format-specific parsers.
- Configure the dedicated bucket, CORS, runtime role, encryption, versioning, retention, and recovery through the approved infrastructure process before production.
