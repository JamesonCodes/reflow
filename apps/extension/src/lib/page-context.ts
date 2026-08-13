import type { ActiveObservationState } from './model';
import { isObservableUrl } from './scope';

export interface PageContextTabCandidate {
  active: boolean;
  id?: number | undefined;
  incognito: boolean;
  url?: string | undefined;
}

export function selectPageContextTab(
  tabs: PageContextTabCandidate[],
  state: Pick<ActiveObservationState, 'domains' | 'exclusions'>,
) {
  return tabs.find(
    (tab) =>
      tab.active === true &&
      typeof tab.id === 'number' &&
      tab.incognito !== true &&
      typeof tab.url === 'string' &&
      isObservableUrl(tab.url, state.domains, state.exclusions),
  );
}
