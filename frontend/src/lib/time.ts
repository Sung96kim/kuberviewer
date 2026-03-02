const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffSeconds = Math.floor((now - then) / 1000)

  if (diffSeconds < 0) return 'just now'
  if (diffSeconds < MINUTE) return `${diffSeconds}s`
  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE)
    return `${minutes}m`
  }
  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR)
    const minutes = Math.floor((diffSeconds % HOUR) / MINUTE)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  const days = Math.floor(diffSeconds / DAY)
  const hours = Math.floor((diffSeconds % DAY) / HOUR)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}
