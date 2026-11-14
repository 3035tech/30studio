# Local S3 integration test

The storage integration test uses LocalStack's S3 API. It will only connect to a loopback endpoint and skips when `STUDIO_ASSET_ENDPOINT` is unset.

Use a LocalStack auth token from the operator's local shell; do not save it in this repository or `.env.example`:

```sh
docker compose -f tests/localstack/docker-compose.yml up -d
STUDIO_ASSET_ENDPOINT=http://127.0.0.1:4566 npm run test:localstack
docker compose -f tests/localstack/docker-compose.yml down
```

The compose service binds only to loopback and exposes S3. The test creates a unique temporary bucket, uploads a valid image through a presigned POST, verifies its hash and decoded dimensions, promotes verified bytes to the immutable final key, replays the temporary upload URL with different bytes, and confirms that the final object checksum remains unchanged. It also rejects a mismatched checksum and removes the bucket. AWS credentials in the test process are fixed dummy values and the test rejects remote endpoints.

The current LocalStack Docker setup requires `LOCALSTACK_AUTH_TOKEN`; obtain it from LocalStack and provide it only in the shell environment.
