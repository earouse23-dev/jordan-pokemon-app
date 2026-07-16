import { DisabledProvider } from "./base.js";

export class AltProvider extends DisabledProvider {
  constructor() {
    super(
      "alt",
      "Alt requires authorized API or licensed data access. Scraping is not supported.",
    );
  }
}
