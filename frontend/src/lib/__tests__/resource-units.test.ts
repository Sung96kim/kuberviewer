import { describe, it, expect } from 'vitest'
import {
  parseCpuToMillicores,
  parseCpuToCores,
  parseMemoryToBytes,
  formatCpu,
  formatCpuCores,
  formatMemory,
  getUsageBarColor,
  getAllocatableBarColor,
} from '../resource-units'

describe('parseCpuToMillicores', () => {
  it('parses nanocores', () => {
    expect(parseCpuToMillicores('500000000n')).toBe(500)
  })

  it('parses millicores', () => {
    expect(parseCpuToMillicores('250m')).toBe(250)
  })

  it('parses whole cores', () => {
    expect(parseCpuToMillicores('2')).toBe(2000)
  })

  it('parses fractional cores', () => {
    expect(parseCpuToMillicores('0.5')).toBe(500)
  })
})

describe('parseCpuToCores', () => {
  it('converts millicores string to cores', () => {
    expect(parseCpuToCores('500m')).toBe(0.5)
  })

  it('converts whole core string', () => {
    expect(parseCpuToCores('2')).toBe(2)
  })
})

describe('parseMemoryToBytes', () => {
  it('parses Ki (kibibytes)', () => {
    expect(parseMemoryToBytes('1024Ki')).toBe(1024 * 1024)
  })

  it('parses Mi (mebibytes)', () => {
    expect(parseMemoryToBytes('512Mi')).toBe(512 * 1024 ** 2)
  })

  it('parses Gi (gibibytes)', () => {
    expect(parseMemoryToBytes('2Gi')).toBe(2 * 1024 ** 3)
  })

  it('parses Ti (tebibytes)', () => {
    expect(parseMemoryToBytes('1Ti')).toBe(1024 ** 4)
  })

  it('parses decimal K', () => {
    expect(parseMemoryToBytes('1000K')).toBe(1000 * 1000)
  })

  it('parses decimal M', () => {
    expect(parseMemoryToBytes('500M')).toBe(500 * 1000 ** 2)
  })

  it('parses raw bytes', () => {
    expect(parseMemoryToBytes('1048576')).toBe(1048576)
  })
})

describe('formatCpu', () => {
  it('formats as millicores when < 1000', () => {
    expect(formatCpu(250)).toBe('250m')
  })

  it('formats as cores when >= 1000', () => {
    expect(formatCpu(2000)).toBe('2.0 cores')
  })

  it('formats fractional cores', () => {
    expect(formatCpu(1500)).toBe('1.5 cores')
  })

  it('rounds millicores to integers', () => {
    expect(formatCpu(99.7)).toBe('100m')
  })
})

describe('formatCpuCores', () => {
  it('converts cores to formatted string', () => {
    expect(formatCpuCores(0.5)).toBe('500m')
  })

  it('formats multi-core values', () => {
    expect(formatCpuCores(2)).toBe('2.0 cores')
  })
})

describe('formatMemory', () => {
  it('formats as GiB for large values', () => {
    expect(formatMemory(2 * 1024 ** 3)).toBe('2.0 GiB')
  })

  it('formats as MiB for medium values', () => {
    expect(formatMemory(512 * 1024 ** 2)).toBe('512 MiB')
  })

  it('formats as KiB for small values', () => {
    expect(formatMemory(512 * 1024)).toBe('512 KiB')
  })
})

describe('getUsageBarColor', () => {
  it('returns green for <= 50%', () => {
    expect(getUsageBarColor(30).bar).toBe('bg-emerald-500')
    expect(getUsageBarColor(50).bar).toBe('bg-emerald-500')
  })

  it('returns amber for 51-80%', () => {
    expect(getUsageBarColor(51).bar).toBe('bg-amber-500')
    expect(getUsageBarColor(80).bar).toBe('bg-amber-500')
  })

  it('returns red for > 80%', () => {
    expect(getUsageBarColor(81).bar).toBe('bg-red-500')
  })
})

describe('getAllocatableBarColor', () => {
  it('returns green for >= 80%', () => {
    expect(getAllocatableBarColor(80).bar).toBe('bg-emerald-500')
    expect(getAllocatableBarColor(95).bar).toBe('bg-emerald-500')
  })

  it('returns amber for 50-79%', () => {
    expect(getAllocatableBarColor(50).bar).toBe('bg-amber-500')
    expect(getAllocatableBarColor(79).bar).toBe('bg-amber-500')
  })

  it('returns red for < 50%', () => {
    expect(getAllocatableBarColor(49).bar).toBe('bg-red-500')
  })
})
