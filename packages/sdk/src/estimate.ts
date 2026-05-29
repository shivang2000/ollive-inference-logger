/**
 * Rough token estimate (~4 characters per token for English). Used ONLY on the cancel path,
 * where the provider never sends the final usage chunk, so we have no authoritative count.
 * Results carry `tokensEstimated: true` so dashboards can distinguish estimates from exact counts.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}
