/** The JSON object in a reply, code fences and prose aside; else null */
export function parseJsonReply(reply: string): Record<string, unknown> | null {
  const cleaned = reply
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  for (const candidate of [cleaned, /\{[\s\S]*\}/.exec(cleaned)?.[0]]) {
    if (!candidate) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}
