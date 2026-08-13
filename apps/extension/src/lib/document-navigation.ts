export class DocumentNavigationGate {
  readonly #startupTabs = new Set<number>();

  reset(tabIds: number[] = []) {
    this.#startupTabs.clear();
    for (const tabId of tabIds) this.#startupTabs.add(tabId);
  }

  shouldCapture(tabId: number) {
    return !this.#startupTabs.delete(tabId);
  }
}
