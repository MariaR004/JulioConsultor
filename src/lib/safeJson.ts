export function safeJsonScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
