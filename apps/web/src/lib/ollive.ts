import { createOlliveClient, type OlliveClient } from '@ollive/sdk';
import { env } from './env';

// One SDK client per server process. redactPII is left to the ingestion worker (centralized
// policy), so the SDK ships truncated-but-unredacted previews over the internal network.
let client: OlliveClient | undefined;

export function ollive(): OlliveClient {
  if (!client) {
    client = createOlliveClient({
      ingestionUrl: env.ingestionUrl,
      openrouterApiKey: env.openrouterApiKey,
      defaultModel: env.defaultModel,
      redactPII: false,
    });
  }
  return client;
}
