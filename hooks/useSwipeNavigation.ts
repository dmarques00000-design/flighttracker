/**
 * useSwipeNavigation — DEPRECATED
 *
 * Tab swipe is now handled entirely by the custom pager in
 * app/(tabs)/_layout.tsx. This hook is kept as a no-op so that
 * existing import sites in index.tsx / flights.tsx / profile.tsx
 * continue to compile without changes. It returns an empty object
 * so spreading its result has no effect.
 */
export function useSwipeNavigation(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _currentIndex: 0 | 1 | 2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _enabled = true
): Record<string, never> {
  return {};
}
