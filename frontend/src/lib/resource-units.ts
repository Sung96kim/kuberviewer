const MEMORY_UNITS: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  K: 1000,
  M: 1000 ** 2,
  G: 1000 ** 3,
  T: 1000 ** 4,
}

export function parseCpuToMillicores(value: string): number {
  if (value.endsWith('n')) return parseInt(value, 10) / 1_000_000
  if (value.endsWith('m')) return parseInt(value, 10)
  return parseFloat(value) * 1000
}

export function parseCpuToCores(value: string): number {
  return parseCpuToMillicores(value) / 1000
}

export function parseMemoryToBytes(value: string): number {
  for (const [suffix, multiplier] of Object.entries(MEMORY_UNITS)) {
    if (value.endsWith(suffix)) {
      return parseFloat(value.replace(suffix, '')) * multiplier
    }
  }
  return parseFloat(value)
}

export function formatCpu(millicores: number): string {
  if (millicores >= 1000) return `${(millicores / 1000).toFixed(1)} cores`
  return `${Math.round(millicores)}m`
}

export function formatCpuCores(cores: number): string {
  return formatCpu(cores * 1000)
}

export function formatMemory(bytes: number): string {
  const gi = bytes / (1024 ** 3)
  if (gi >= 1) return `${gi.toFixed(1)} GiB`
  const mi = bytes / (1024 ** 2)
  if (mi >= 1) return `${mi.toFixed(0)} MiB`
  return `${(bytes / 1024).toFixed(0)} KiB`
}

export function getUsageBarColor(percentage: number): { bar: string; bg: string; text: string } {
  if (percentage <= 50) return { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' }
  if (percentage <= 80) return { bar: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500' }
  return { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-500' }
}

export function getAllocatableBarColor(percentage: number): { bar: string; bg: string; text: string } {
  if (percentage >= 80) return { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' }
  if (percentage >= 50) return { bar: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500' }
  return { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-500' }
}
