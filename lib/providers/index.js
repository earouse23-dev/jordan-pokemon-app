import { AltProvider } from "./alt.js";
import { CardLadderProvider } from "./cardladder.js";
import {
  fetchPkmnPricesLookup,
  normalizePkmnPricesCard,
} from "./pkmnprices.js";
import {
  fetchTcgdexPricingLookup,
  normalizeTcgdexPricingCard,
  searchTcgdexCards,
} from "./tcgdex.js";

export class PkmnPricesProvider {
  constructor({ apiKey, timeoutMs = 8_000 } = {}) {
    this.name = "pkmnprices";
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }
  isEnabled() {
    return Boolean(this.apiKey);
  }
  async searchCards(input) {
    const result = await this.getCard(input);
    return result ? [result] : [];
  }
  async getCard(input) {
    if (!this.isEnabled()) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const result = await fetchPkmnPricesLookup(
        this.apiKey,
        input,
        controller.signal,
      );
      return result.card
        ? normalizePkmnPricesCard(
            result.card,
            result.history,
            new Date().toISOString(),
            input.clientId,
            result.historyStatus,
          )
        : null;
    } finally {
      clearTimeout(timeout);
    }
  }
  async getCurrentPrices(input) {
    return (await this.getCard(input))?.quotes || [];
  }
  async getPriceHistory(input) {
    return (await this.getCard(input))?.history || [];
  }
}

export class TCGdexProvider {
  constructor({ language = "en", timeoutMs = 8_000 } = {}) {
    this.name = "tcgdex";
    this.language = language;
    this.timeoutMs = timeoutMs;
  }
  isEnabled() {
    return true;
  }
  async searchCards(input) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return searchTcgdexCards(
        input.query,
        input.language || this.language,
        input.limit || 12,
        controller.signal,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  async getCard(input) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const card = await fetchTcgdexPricingLookup(
        input,
        controller.signal,
        input.language || this.language,
      );
      return card
        ? normalizeTcgdexPricingCard(
            card,
            new Date().toISOString(),
            input.clientId,
            input.language || this.language,
          )
        : null;
    } finally {
      clearTimeout(timeout);
    }
  }
  async getCurrentPrices(input) {
    return (await this.getCard(input))?.quotes || [];
  }
}

export function providerRegistry(config = {}) {
  return [
    new PkmnPricesProvider({ apiKey: config.pkmnpricesApiKey }),
    new TCGdexProvider({ language: config.language }),
    new AltProvider(),
    new CardLadderProvider(),
  ];
}
