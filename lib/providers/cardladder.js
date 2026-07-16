import { DisabledProvider } from "./base.js";

export class CardLadderProvider extends DisabledProvider {
  constructor() {
    super(
      "cardladder",
      "Card Ladder requires authorized API or licensed data access. Scraping is not supported.",
    );
  }
}
