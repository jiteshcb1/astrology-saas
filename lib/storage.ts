import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

// Thin, mockable storage client for Cloudflare R2 via the S3-compatible API.
// STUB: when R2 creds are absent, methods log and return placeholders instead of hitting R2.
// TODO: wire to the Workers R2 binding (env.R2) when running on Cloudflare, falling back to
// these S3-compatible credentials for local/dev.

const isConfigured = Boolean(
  env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET,
);

const client: S3Client | null = isConfigured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

export interface PutObjectInput {
  key: string;
  body: Uint8Array | string | Buffer;
  contentType?: string;
}

export async function putObject(input: PutObjectInput): Promise<{ ok: boolean; key: string }> {
  if (!client) {
    console.log("[storage:stub] would put object", { key: input.key, contentType: input.contentType });
    return { ok: true, key: input.key };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return { ok: true, key: input.key };
}

export async function getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  if (!client) {
    console.log("[storage:stub] would sign url", { key, expiresInSeconds });
    return `https://stub.local/${key}`;
  }

  return awsGetSignedUrl(
    client,
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}
