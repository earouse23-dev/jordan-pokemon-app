export class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ProviderError";
    this.provider = options.provider || "unknown";
    this.status = options.status || 502;
    this.retryable = Boolean(options.retryable);
    this.retryAfter = options.retryAfter || null;
  }
}

export async function withProviderRetry(operation, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 3));
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!error?.retryable || attempt === attempts - 1) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(250 * 2 ** attempt, 2_000)),
      );
    }
  }
  throw lastError;
}

export class DisabledProvider {
  constructor(name, reason) {
    this.name = name;
    this.reason = reason;
  }
  isEnabled() {
    return false;
  }
  async searchCards() {
    return [];
  }
  async getCard() {
    throw new ProviderError(this.reason, { provider: this.name, status: 503 });
  }
  async getCurrentPrices() {
    return [];
  }
  async getPriceHistory() {
    return [];
  }
  status() {
    return { name: this.name, enabled: false, reason: this.reason };
  }
}
