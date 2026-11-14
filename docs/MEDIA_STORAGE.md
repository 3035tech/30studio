# Brand media storage

The first media slice stores PNG, JPEG, and WebP brand images in a private S3-compatible bucket. The server uses AWS SDK for JavaScript v3 (Apache-2.0) for presigned uploads/downloads and Sharp (Apache-2.0) for bounded image decoding. It supports logos and visual template references; it does not import editable design templates, video, SVG, or archives. Node.js 20.9 or newer is required by the selected runtime dependencies.

## Request flow

1. An authorized brand manager creates an upload session. The server scopes the brand to the authenticated organization, creates an immutable database record, generates separate keys for the final asset and temporary upload, and returns a five-minute presigned POST restricted to the temporary key.
2. The POST policy limits the object to the declared byte length (maximum 10 MiB), MIME type, generated key, and expected SHA-256 metadata. The browser uploads directly to the private bucket.
3. The authenticated finalize request reads the temporary object through the server SDK, checks size/type/metadata, computes SHA-256 from the stored bytes, decodes the image with Sharp under a 20-megapixel limit, and writes those exact verified bytes to a separate final object key. Only then does the asset enter `pending_review`; the temporary object is deleted best-effort.
4. A brand manager approves or rejects the immutable asset. Each decision is appended to `brand_asset_reviews`. Only approved assets are visible to ordinary brand readers. Authorized previews use a 60-second presigned GET URL.

Invalid bytes are deleted and the pending database record is removed. A still-valid presigned upload can only modify the temporary key; it cannot replace the verified final object after review. Storage outages preserve the pending record so an upload can be finalized after recovery. Abandoned pending uploads and their objects need a scheduled cleanup policy before production.

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

## Remaining media work

- Add a bounded cleanup job for expired `upload_pending` rows and objects.
- Add version grouping, variant generation, usage references, and richer review history to the UI.
- Import official brand kits/templates from user-provided source archives with malware scanning and format-specific parsers.
- Configure the dedicated bucket, CORS, runtime role, encryption, versioning, retention, and recovery through the approved infrastructure process before production.
