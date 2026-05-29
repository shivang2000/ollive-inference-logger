// @ollive/sdk — lightweight LLM wrapper that captures inference metadata and ships logs
// to the ingestion endpoint without ever blocking the chat path.
export const SDK_VERSION = '0.1.0';

export { createOlliveClient, type OlliveClient } from './client.js';
export { LogShipper, type ShipperOptions } from './shipper.js';
export { estimateTokens } from './estimate.js';
export {
  callOpenRouter,
  parseSseStream,
  providerFromModel,
  OPENROUTER_DEFAULT_BASE,
} from './openrouter.js';
export type {
  OlliveClientOptions,
  ChatParams,
  ChatOutcome,
  OlliveChatResult,
  FetchLike,
} from './types.js';
