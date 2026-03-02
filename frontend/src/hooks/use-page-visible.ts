import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

function getSnapshot() {
  return !document.hidden
}

export function usePageVisible() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
