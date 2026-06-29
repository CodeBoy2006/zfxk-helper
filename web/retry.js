const DEFAULT_RETRY_DELAYS = [250, 500, 1000];

export async function withRetry(task, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRY_DELAYS.length;
  const delays = options.delays ?? DEFAULT_RETRY_DELAYS;
  const wait = options.wait ?? delay;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task({ attempt });
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await wait(delays[Math.min(attempt, delays.length - 1)]);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
