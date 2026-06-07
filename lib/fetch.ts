/**
 * fetchWithTimeout — drop-in wrapper around fetch() that aborts and throws
 * a TypeError('Request timed out') if the server does not respond within
 * `timeoutMs` milliseconds (default: 10 000 ms).
 *
 * Usage:
 *   import { fetchWithTimeout } from "@/lib/fetch";
 *   const res = await fetchWithTimeout(url, { method: "POST", body: ... });
 *
 * On timeout the underlying AbortController aborts the request so the TCP
 * connection is also released — there is no zombie request hanging in the
 * background.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, signal: callerSignal, ...rest } = init;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller passed their own signal, abort our controller when it fires.
  callerSignal?.addEventListener("abort", () => controller.abort());

  try {
    const response = await fetch(input, { ...rest, signal: controller.signal });
    return response;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new TypeError(`Request timed out after ${timeoutMs} ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
