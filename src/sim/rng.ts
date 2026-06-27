/** Small deterministic PRNG for reproducible runs. */
export class Rng {
  private state: number

  constructor(seed = Date.now()) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Rng.pick called with empty array')
    }
    return items[this.int(0, items.length - 1)]
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }
}
