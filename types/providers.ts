export type ProviderCapabilities = {
  catalog: boolean; currentPrices: boolean; priceHistory: boolean; transactionHistory: boolean;
  outboundLinks: boolean; gradedPrices: boolean; regionalPrices: boolean;
};
export type NormalizedPriceQuote = {
  provider: string; providerProductId: string; currency: string; region: string; condition: string | null;
  finish: string | null; gradingCompany: string | null; grade: number | null;
  priceType: 'market'|'low'|'mid'|'high'|'trend'|'latest_sale'|'average'; amount: number;
  observedAt: string | null; retrievedAt: string; providerUrl: string | null; attribution: string;
  derivation: 'direct'|'aggregated'|'estimated'; quality: { stale: boolean; note?: string };
};
export type CardSearchInput = { query: string; language?: string; collectorNumber?: string; setId?: string; limit?: number };
export type CardSearchResult = { providerCardId: string; canonicalName: string; setName: string; collectorNumber: string; language: string; imageUrl: string | null };
export type IdentificationInput = { privateImageUrl: string; mimeType: string; allowedCandidateIds?: string[] };
export type CardCandidate = { providerCardId: string; confidence: number; signals: string[] };
export interface CardCatalogProvider { readonly capabilities: ProviderCapabilities; searchCards(input: CardSearchInput): Promise<CardSearchResult[]>; }
export interface CardIdentificationProvider { readonly capabilities: ProviderCapabilities; identifyCard(input: IdentificationInput): Promise<CardCandidate[]>; }
export interface PricingProvider { readonly capabilities: ProviderCapabilities; getCurrentPrices(input: { providerCardId: string; variant?: string }): Promise<NormalizedPriceQuote[]>; }
