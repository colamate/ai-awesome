import { useEffect, useState } from 'react';

export const ROUTE_HOME = '#/';
export const ROUTE_MATH = '#/math';
export const ROUTE_ENGLISH = '#/english';
export const ROUTE_CHINESE = '#/chinese';

export type Route = typeof ROUTE_HOME | typeof ROUTE_MATH | typeof ROUTE_ENGLISH | typeof ROUTE_CHINESE;

function parseHash(hash: string): Route {
  if (hash === ROUTE_MATH || hash === ROUTE_ENGLISH || hash === ROUTE_CHINESE) return hash;
  return ROUTE_HOME;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(globalThis.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(globalThis.location.hash));
    globalThis.addEventListener('hashchange', onChange);
    return () => globalThis.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(route: Route): void {
  globalThis.location.hash = route;
}
