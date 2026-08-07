import type { CapturedActionType } from '@reflow/contracts';

export class NavigationTracker {
  #currentUrl: string;

  constructor(initialUrl: string) {
    this.#currentUrl = initialUrl;
  }

  initial(): CapturedActionType {
    return 'navigate';
  }

  observe(nextUrl: string): CapturedActionType | null {
    if (nextUrl === this.#currentUrl) return null;
    const previous = new URL(this.#currentUrl);
    const next = new URL(nextUrl);
    this.#currentUrl = nextUrl;

    if (
      previous.origin === next.origin &&
      previous.pathname === next.pathname &&
      previous.search === next.search &&
      previous.hash !== next.hash
    ) {
      return 'hash_navigate';
    }
    return 'spa_navigate';
  }
}
