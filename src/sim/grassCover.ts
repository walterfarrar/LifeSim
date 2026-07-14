import {
  GRASS_COLD_DRAIN_BASE,
  GRASS_COLD_DRAIN_SCALE,
  GRASS_COLD_EXTREME_DRAIN,
  GRASS_COLD_RAMP_TICKS,
  GRASS_DROUGHT_DRAIN_BASE,
  GRASS_DROUGHT_DRAIN_SCALE,
  GRASS_DROWN_DRAIN_FRACTION,
  GRASS_FLOOD_DRAIN_STRESS_MAX,
  GRASS_FLOOD_DRAIN_STRESS_MIN,
  GRASS_FLOOD_RAIN_STRESS_MULT,
  GRASS_EDIBLE_ENERGY,
  GRASS_EXTREME_COLD_DRAIN,
  GRASS_EXTREME_COLD_KILL_TICKS,
  GRASS_MAX_TICK_LOSS_FRACTION,
  GRASS_MIN_LIVE_ENERGY,
  GRASS_TURF_GROWTH_SCALE,
  PLANT_WATER_PER_ENERGY,
  SOIL_CELL_WATER_CAPACITY,
  SOIL_REPRO_MIN_MOISTURE,
} from './config'
import { cloneDNA } from './dna'
import type { DNA } from './dna'
import { finalizePlantDna } from './entities/plant'
import { createPlantKindDna } from './plantKinds'
import {
  isPlantDormant,
  plantSeasonalGrowthScale,
  plantSeasonalReproductionScale,
} from './plantClimate'
import { moistureGrowthFactor, type SoilAccess } from './soilMoisture'
import { temperatureGrowthFactor } from './temperature'
import { mutatePlant } from './mutation'
import { expressPlant } from './phenotype'
import { pullWaterFromPools } from './waterInit'
import {
  consumeSoilWaterForGrowth,
  plantTissueWaterCapacity,
  uptakeSoilWaterIntoPlant,
  waterUnitsForGrowth,
} from './plantWaterUptake'
import { releaseTranspiredWater, type AtmospherePool } from './transpiration'
import { grassSunlightWithTreeShade } from './grassTreeShade'
import type { Rng } from './rng'
import type { SeasonName } from './seasons'
import type { TerrainWater } from './terrainWater'
import type { Plant } from './types'
import { getWorldBounds } from './worldBounds'
import { computeSoilGridLayout, soilCellAtWorld, soilCellCenterWorld } from './soilGridLayout'

export type GrassCoverSnapshot = {
  cols: number
  rows: number
  cellSize: number
  cellW: number
  cellH: number
  energy: Float32Array
  water: Float32Array
  droughtTicks: Float32Array
  coldTicks: Float32Array
  dna: readonly (DNA | null)[]
  /** Packed RGBA per cell — alpha 0 when bare soil. */
  tint: Uint8ClampedArray
}

/** Total water in a turf cell — tissue plus water bound in biomass. */
export function turfHydricWater(energy: number, water: number): number {
  return water + energy * PLANT_WATER_PER_ENERGY
}

const GRASS_KIND = 'grass' as const

function cellTraits(dna: DNA) {
  return expressPlant(dna)
}

function tissueWaterCapacity(dna: DNA, energy: number): number {
  const traits = cellTraits(dna)
  return plantTissueWaterCapacity(energy, traits.maxEnergy)
}

function grassTintFromDna(dna: DNA, energy: number): [number, number, number, number] {
  const traits = cellTraits(dna)
  const ratio = Math.min(1, energy / Math.max(traits.maxEnergy, 1))
  const lightness = traits.lightness * (0.45 + ratio * 0.55)
  const sat = traits.saturation * (0.55 + ratio * 0.45)
  const hue = traits.greenHue
  // hsl to rgb approximation for canvas
  const l = lightness / 100
  const s = sat / 100
  const h = hue / 360
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const alpha = Math.round(Math.min(1, 0.12 + ratio * 0.72) * 255)
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), alpha]
}

export class GrassCover {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  readonly cellW: number
  readonly cellH: number
  readonly energy: Float32Array
  readonly water: Float32Array
  readonly age: Float32Array
  readonly droughtTicks: Float32Array
  readonly coldTicks: Float32Array
  readonly dnaByCell: (DNA | null)[]
  private readonly tickLossBudget: Float32Array

  constructor(cellSize: number) {
    const grid = computeSoilGridLayout(cellSize)
    this.cellSize = grid.cellSize
    this.cols = grid.cols
    this.rows = grid.rows
    this.cellW = grid.cellW
    this.cellH = grid.cellH
    const n = this.cols * this.rows
    this.energy = new Float32Array(n)
    this.water = new Float32Array(n)
    this.age = new Float32Array(n)
    this.droughtTicks = new Float32Array(n)
    this.coldTicks = new Float32Array(n)
    this.dnaByCell = new Array(n).fill(null)
    this.tickLossBudget = new Float32Array(n)
  }

  private wrap(value: number, count: number): number {
    return ((value % count) + count) % count
  }

  cellIndex(x: number, y: number): number {
    return soilCellAtWorld(x, y, this.cellW, this.cellH, this.cols, this.rows).index
  }

  cellCenter(index: number): { x: number; y: number; col: number; row: number } {
    const col = index % this.cols
    const row = Math.floor(index / this.cols)
    const center = soilCellCenterWorld(col, row, this.cellW, this.cellH)
    return { col, row, x: center.x, y: center.y }
  }

  /** Crown still alive — may be too thin to graze. */
  isLiveTurf(index: number): boolean {
    return this.energy[index] > GRASS_MIN_LIVE_ENERGY && this.dnaByCell[index] !== null
  }

  /** Enough biomass to browse. */
  isEdibleGrass(index: number): boolean {
    return this.energy[index] > GRASS_EDIBLE_ENERGY && this.dnaByCell[index] !== null
  }

  /**
   * Turf substantial enough to hold the tile against new seeds. Trace turf
   * dying back below the edible threshold no longer blocks reseeding — it can be
   * reclaimed by a fresh seed (its residual water is released first).
   */
  occupiesTile(index: number): boolean {
    return this.isEdibleGrass(index)
  }

  /** @deprecated Prefer isLiveTurf / isEdibleGrass */
  hasGrass(index: number): boolean {
    return this.isLiveTurf(index)
  }

  countEdible(): number {
    let n = 0
    for (let i = 0; i < this.energy.length; i++) {
      if (this.isEdibleGrass(i)) n += 1
    }
    return n
  }

  totalEnergy(): number {
    let sum = 0
    for (let i = 0; i < this.energy.length; i++) sum += this.energy[i]
    return sum
  }

  totalWater(): number {
    let sum = 0
    for (let i = 0; i < this.water.length; i++) {
      sum += turfHydricWater(this.energy[i], this.water[i])
    }
    return sum
  }

  snapshot(): GrassCoverSnapshot {
    const tint = new Uint8ClampedArray(this.energy.length * 4)
    for (let i = 0; i < this.energy.length; i++) {
      const dna = this.dnaByCell[i]
      const base = i * 4
      if (!dna || this.energy[i] <= GRASS_MIN_LIVE_ENERGY) {
        tint[base + 3] = 0
        continue
      }
      const [r, g, b, a] = grassTintFromDna(dna, this.energy[i])
      tint[base] = r
      tint[base + 1] = g
      tint[base + 2] = b
      tint[base + 3] = a
    }
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize,
      cellW: this.cellW,
      cellH: this.cellH,
      energy: this.energy,
      water: this.water,
      droughtTicks: this.droughtTicks,
      coldTicks: this.coldTicks,
      dna: this.dnaByCell,
      tint,
    }
  }

  seedCell(index: number, dna: DNA, rng: Rng, initialEnergy?: number): void {
    const traits = cellTraits(dna)
    const energy = initialEnergy ?? rng.range(8, traits.maxEnergy * 0.55)
    this.dnaByCell[index] = cloneDNA(dna)
    this.energy[index] = energy
    this.water[index] = 0
    this.age[index] = 0
    this.droughtTicks[index] = 0
    this.coldTicks[index] = 0
  }

  seedInitial(rng: Rng, count: number, championDna?: DNA | null): number {
    let placed = 0
    const bounds = getWorldBounds()
    const margin = Math.min(40, bounds.width * 0.02)
    for (let i = 0; i < count; i++) {
      const x = rng.range(margin, bounds.width - margin)
      const y = rng.range(margin, bounds.height - margin)
      const idx = this.cellIndex(x, y)
      if (this.occupiesTile(idx)) continue
      const dna =
        i === 0 && championDna
          ? cloneDNA(championDna)
          : createPlantKindDna(GRASS_KIND, rng)
      this.seedCell(idx, dna, rng)
      placed += 1
    }
    return placed
  }

  fundStructuralWaterFromSoil(index: number, soil: SoilAccess, atmosphere: AtmospherePool): void {
    const need = this.energy[index] * PLANT_WATER_PER_ENERGY
    if (need <= 0) return
    const { x, y } = this.cellCenter(index)
    const funded = pullWaterFromPools(x, y, need, soil, atmosphere)
    if (funded < need) {
      this.energy[index] *= funded / need
    }
  }

  /** Return structural water when biomass energy is lost (spread, stress, etc.). */
  releaseStructuralWater(
    index: number,
    energyLost: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
  ): void {
    if (energyLost <= 0) return
    this.releaseTranspiration(index, energyLost * PLANT_WATER_PER_ENERGY, soil, atmosphere)
  }

  absorbWaterFromSoil(index: number, soil: SoilAccess, atmosphere: AtmospherePool): void {
    const dna = this.dnaByCell[index]
    if (!dna) return
    const reserveCap = tissueWaterCapacity(dna, this.energy[index])
    if (reserveCap <= 0 || this.water[index] >= reserveCap) return

    const { x, y } = this.cellCenter(index)
    const need = reserveCap - this.water[index]
    const taken = soil.consume(x, y, need / SOIL_CELL_WATER_CAPACITY)
    const waterUnits = taken * SOIL_CELL_WATER_CAPACITY
    const stored = Math.min(waterUnits, reserveCap - this.water[index])
    this.water[index] += stored
    releaseTranspiredWater(atmosphere, soil, x, y, waterUnits - stored)
  }

  private uptakeSoilWater(
    index: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
    season: SeasonName,
    temperature: number,
  ): void {
    const dna = this.dnaByCell[index]
    if (!dna || !this.isLiveTurf(index)) return
    const traits = cellTraits(dna)
    const { x, y } = this.cellCenter(index)
    this.water[index] = uptakeSoilWaterIntoPlant({
      x,
      y,
      energy: this.energy[index],
      maxEnergy: traits.maxEnergy,
      water: this.water[index],
      maxStoredWater: tissueWaterCapacity(dna, this.energy[index]),
      moistureNeed: traits.moistureNeed,
      soil,
      atmosphere,
      dormant: isPlantDormant(dna, season, temperature),
    })
  }

  clearCell(index: number): void {
    this.energy[index] = 0
    this.water[index] = 0
    this.age[index] = 0
    this.droughtTicks[index] = 0
    this.coldTicks[index] = 0
    this.dnaByCell[index] = null
  }

  tick(
    rng: Rng,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
    season: SeasonName,
    sunlight: number,
    temperature: number,
    maxCells: number,
    shadeTrees: readonly Plant[] = [],
  ): number {
    let primaryProduction = 0
    const beforeEnergy = this.totalEnergy()
    this.tickLossBudget.fill(0)

    for (let i = 0; i < this.energy.length; i++) {
      if (!this.dnaByCell[i]) continue
      this.age[i] += 1
      this.applyTemperatureStress(i, season, temperature, soil, atmosphere)
      this.uptakeSoilWater(i, soil, atmosphere, season, temperature)
      primaryProduction += this.growCell(
        i,
        soil,
        sunlight,
        temperature,
        season,
        shadeTrees,
        atmosphere,
      )
      this.applyDrought(i, soil, atmosphere, season, temperature)
    }

    this.cullBare(soil, atmosphere)
    this.tickSpread(rng, soil, atmosphere, season, maxCells)
    this.cullBare(soil, atmosphere)

    return Math.max(0, this.totalEnergy() - beforeEnergy) + primaryProduction
  }

  private growCell(
    index: number,
    soil: SoilAccess,
    sunlight: number,
    temperature: number,
    season: SeasonName,
    shadeTrees: readonly Plant[],
    atmosphere: AtmospherePool,
  ): number {
    const dna = this.dnaByCell[index]
    if (!dna) return 0
    const traits = cellTraits(dna)
    const before = this.energy[index]
    const dormant = isPlantDormant(dna, season, temperature)

    if (this.energy[index] <= GRASS_MIN_LIVE_ENERGY || this.energy[index] >= traits.maxEnergy) return 0

    const { x, y } = this.cellCenter(index)
    const localSunlight = grassSunlightWithTreeShade(x, y, sunlight, shadeTrees)
    if (localSunlight <= 0 || dormant) return 0

    const moisture = soil.sample(x, y)
    const moistureFactor = moistureGrowthFactor(moisture, traits.moistureNeed)
    if (moistureFactor <= 0) return 0

    const tempFactor = temperatureGrowthFactor(temperature, traits.idealTemp, traits.tempGrowthHalfWidth)
    if (tempFactor <= 0) return 0

    const seasonal = plantSeasonalGrowthScale(GRASS_KIND, season, dormant)
    const potentialGrowth =
      traits.growthRate *
      moistureFactor *
      localSunlight *
      tempFactor *
      seasonal *
      GRASS_TURF_GROWTH_SCALE
    if (potentialGrowth <= 0) return 0

    // Only pull soil water for biomass that fits; unused pull was vanishing from the totals.
    const room = Math.max(0, traits.maxEnergy - this.energy[index])
    if (room <= 0) return 0
    const desiredGrowth = Math.min(room, potentialGrowth)
    const demand = waterUnitsForGrowth(desiredGrowth)
    const available = consumeSoilWaterForGrowth(x, y, demand, soil)
    if (available <= 0 || demand <= 0) return 0
    const growth = desiredGrowth * (available / demand)
    this.energy[index] += growth
    const reserveCap = tissueWaterCapacity(dna, this.energy[index])
    if (this.water[index] > reserveCap) {
      releaseTranspiredWater(atmosphere, soil, x, y, this.water[index] - reserveCap)
      this.water[index] = reserveCap
    }
    return Math.max(0, this.energy[index] - before)
  }

  /** Percentage biomass loss — capped per tick so stress never zeroes a cell at once. */
  private drainBiomass(
    index: number,
    fraction: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
  ): void {
    if (fraction <= 0 || this.energy[index] <= GRASS_MIN_LIVE_ENERGY) return
    const budgetLeft = GRASS_MAX_TICK_LOSS_FRACTION - this.tickLossBudget[index]
    if (budgetLeft <= 0) return
    const applied = Math.min(budgetLeft, fraction)
    this.tickLossBudget[index] += applied
    this.applyBiomassLoss(index, applied, soil, atmosphere)
  }

  /** Passive drain outside the grass tick (e.g. pond drowning) — still percentage-only. */
  private drainBiomassDirect(
    index: number,
    fraction: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
  ): void {
    if (fraction <= 0 || this.energy[index] <= GRASS_MIN_LIVE_ENERGY) return
    this.applyBiomassLoss(index, Math.min(GRASS_MAX_TICK_LOSS_FRACTION, fraction), soil, atmosphere)
  }

  private applyBiomassLoss(
    index: number,
    fraction: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
  ): void {
    if (fraction <= 0 || this.energy[index] <= GRASS_MIN_LIVE_ENERGY) return
    const beforeEnergy = this.energy[index]
    const afterEnergy = Math.max(0, beforeEnergy * (1 - fraction))
    const energyLost = beforeEnergy - afterEnergy
    const structuralReleased = energyLost * PLANT_WATER_PER_ENERGY
    const tissueLost = beforeEnergy > 0 ? this.water[index] * (energyLost / beforeEnergy) : 0
    this.energy[index] = afterEnergy
    this.water[index] = Math.max(0, this.water[index] - tissueLost)
    const dna = this.dnaByCell[index]
    if (dna) {
      const cap = tissueWaterCapacity(dna, this.energy[index])
      if (this.water[index] > cap) {
        const overflow = this.water[index] - cap
        this.water[index] = cap
        this.releaseTranspiration(index, structuralReleased + tissueLost + overflow, soil, atmosphere)
        return
      }
    }
    if (structuralReleased + tissueLost > 0) {
      this.releaseTranspiration(index, structuralReleased + tissueLost, soil, atmosphere)
    }
  }

  private applyTemperatureStress(
    index: number,
    season: SeasonName,
    temperature: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
  ): void {
    const dna = this.dnaByCell[index]
    if (!dna || this.energy[index] <= GRASS_MIN_LIVE_ENERGY) return

    const traits = cellTraits(dna)
    const delta = Math.abs(temperature - traits.idealTemp)
    const dormant = isPlantDormant(dna, season, temperature)

    if (delta <= traits.tempGrowthHalfWidth) {
      this.coldTicks[index] = 0
      return
    }

    if (dormant) {
      if (delta < traits.tempSurvivalHalfWidth) {
        this.coldTicks[index] = 0
        return
      }
      this.coldTicks[index] += 1
      const ramp = Math.min(1, this.coldTicks[index] / GRASS_EXTREME_COLD_KILL_TICKS)
      const hardiness = 0.35 + traits.hardiness * 0.55
      const drainFraction =
        GRASS_EXTREME_COLD_DRAIN * ramp * ramp * Math.max(0.15, 1.2 - hardiness)
      this.drainBiomass(index, drainFraction, soil, atmosphere)
      return
    }

    this.coldTicks[index] += 1
    const span = Math.max(0.05, traits.tempSurvivalHalfWidth - traits.tempGrowthHalfWidth)
    const beyondGrowth = delta - traits.tempGrowthHalfWidth
    const severity = Math.min(1.5, beyondGrowth / span)
    const extreme = delta >= traits.tempSurvivalHalfWidth
    const ramp = 1 + Math.min(1.5, this.coldTicks[index] / GRASS_COLD_RAMP_TICKS)
    const hardiness = 0.3 + traits.hardiness * 0.5

    let drainFraction =
      (GRASS_COLD_DRAIN_BASE + severity * GRASS_COLD_DRAIN_SCALE) *
      ramp *
      Math.max(0.25, 1.1 - hardiness)

    if (extreme) {
      const extremeRamp = Math.min(1, this.coldTicks[index] / GRASS_EXTREME_COLD_KILL_TICKS)
      const overshoot =
        (delta - traits.tempSurvivalHalfWidth) / Math.max(1, traits.tempSurvivalHalfWidth)
      drainFraction += GRASS_COLD_EXTREME_DRAIN * extremeRamp * (1 + overshoot)
    }

    this.drainBiomass(index, drainFraction, soil, atmosphere)
  }

  private applyDrought(
    index: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
    season: SeasonName,
    temperature: number,
  ): void {
    const dna = this.dnaByCell[index]
    if (!dna || this.energy[index] <= GRASS_MIN_LIVE_ENERGY) return
    if (isPlantDormant(dna, season, temperature)) {
      this.droughtTicks[index] = 0
      return
    }

    const traits = cellTraits(dna)
    const { x, y } = this.cellCenter(index)
    const moisture = soil.sample(x, y)
    const moistureFactor = moistureGrowthFactor(moisture, traits.moistureNeed)
    const safeMoisture = 0.14

    if (moistureFactor >= safeMoisture) {
      this.droughtTicks[index] = 0
      return
    }

    this.droughtTicks[index] += 1
    const ramp = 1 + Math.min(3, this.droughtTicks[index] / 75)
    const severity =
      moistureFactor < safeMoisture * 0.35
        ? 1
        : (safeMoisture - moistureFactor) / Math.max(0.05, safeMoisture * 0.65)
    const droughtTolerance = 0.25 + traits.hardiness * 0.5 + 0.22
    const thirst = 0.55 + traits.moistureNeed * 0.45
    const drainFraction =
      severity *
      ramp *
      (GRASS_DROUGHT_DRAIN_BASE + thirst * GRASS_DROUGHT_DRAIN_SCALE) *
      Math.max(0.15, 1.05 - droughtTolerance)

    this.drainBiomass(index, drainFraction, soil, atmosphere)
  }

  private releaseTranspiration(
    index: number,
    waterUnits: number,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
  ): void {
    if (waterUnits <= 0) return
    const { x, y } = this.cellCenter(index)
    releaseTranspiredWater(atmosphere, soil, x, y, waterUnits)
  }

  private cullBare(soil: SoilAccess, atmosphere: AtmospherePool): void {
    for (let i = 0; i < this.energy.length; i++) {
      if (this.isLiveTurf(i)) continue
      if (this.water[i] > 0 || this.energy[i] > 0 || this.dnaByCell[i]) {
        this.releaseDeadWater(i, soil, atmosphere)
      }
    }
  }

  private spreadAttempts(occupied: number, season: SeasonName): number {
    if (occupied <= 0) return 0
    const seasonal = plantSeasonalReproductionScale(GRASS_KIND, season)
    if (seasonal <= 0) return 0
    const base = Math.max(1, Math.round(Math.sqrt(occupied) / 2.5))
    let cap = 18
    if (season === 'summer') cap = 36
    else if (season === 'spring') cap = 26
    return Math.max(1, Math.min(cap, base))
  }

  private reproductionChance(index: number, season: SeasonName): number {
    const dna = this.dnaByCell[index]
    if (!dna) return 0
    const traits = cellTraits(dna)
    const seasonal = plantSeasonalReproductionScale(GRASS_KIND, season)
    if (seasonal <= 0) return 0
    const maturity = Math.min(1, this.age[index] / traits.maturationAge)
    const energyRatio = Math.min(1, this.energy[index] / traits.maxEnergy)
    const readiness = maturity * 0.58 + energyRatio * 0.42
    const spreadDrive = 0.55 + Math.min(1, traits.spreadMax / 140) * 0.45
    return Math.min(1, readiness * traits.reproductionRate * spreadDrive * 0.034 * seasonal)
  }

  private tickSpread(
    rng: Rng,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
    season: SeasonName,
    maxCells: number,
  ): void {
    const occupied = this.countEdible()
    if (occupied >= maxCells) return

    const attempts = this.spreadAttempts(occupied, season)
    const occupiedIndices: number[] = []
    for (let i = 0; i < this.energy.length; i++) {
      if (this.hasGrass(i)) occupiedIndices.push(i)
    }
    if (occupiedIndices.length === 0) return

    const spreadParentsThisTick = new Set<number>()

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (this.countEdible() >= maxCells) return

      const parentIdx = this.pickSpreadParent(rng, occupiedIndices)
      if (spreadParentsThisTick.has(parentIdx)) continue
      if (!this.rngChance(rng, this.reproductionChance(parentIdx, season))) continue

      const parentDna = this.dnaByCell[parentIdx]
      if (!parentDna) continue
      const parentTraits = cellTraits(parentDna)
      const { x, y } = this.cellCenter(parentIdx)
      const localMoisture = soil.sample(x, y)
      const reproMoistureFloor = SOIL_REPRO_MIN_MOISTURE * (1 - parentTraits.moistureNeed * 0.35)
      if (localMoisture < reproMoistureFloor) continue

      const seedCost = Math.min(
        this.energy[parentIdx] * 0.08,
        parentTraits.maxEnergy * 0.06,
        Math.max(0, this.energy[parentIdx] - GRASS_MIN_LIVE_ENERGY - 0.2),
      )
      if (this.energy[parentIdx] < seedCost + 0.25) continue

      const neighborIdx = this.pickNeighborIndex(rng, parentIdx)
      if (neighborIdx < 0) continue
      if (this.occupiesTile(neighborIdx)) continue
      // Trace turf dying back can be reclaimed — return its residual water first.
      if (this.dnaByCell[neighborIdx]) this.releaseDeadWater(neighborIdx, soil, atmosphere)

      const childDna = finalizePlantDna(mutatePlant(cloneDNA(parentDna), rng))
      this.energy[parentIdx] -= seedCost
      this.releaseStructuralWater(parentIdx, seedCost, soil, atmosphere)
      const seedWater = Math.min(this.water[parentIdx], seedCost * PLANT_WATER_PER_ENERGY)
      this.water[parentIdx] = Math.max(0, this.water[parentIdx] - seedWater)
      atmosphere.vent(x, y, seedWater * 0.05)

      this.dnaByCell[neighborIdx] = childDna
      this.energy[neighborIdx] = seedCost * 0.95
      this.fundStructuralWaterFromSoil(neighborIdx, soil, atmosphere)
      this.water[neighborIdx] = seedWater * 0.95
      this.age[neighborIdx] = 0
      this.droughtTicks[neighborIdx] = 0
      this.coldTicks[neighborIdx] = 0
      spreadParentsThisTick.add(parentIdx)
    }
  }

  private pickSpreadParent(rng: Rng, occupied: number[]): number {
    let total = 0
    const weights: number[] = []
    for (const idx of occupied) {
      const dna = this.dnaByCell[idx]
      if (!dna) {
        weights.push(0)
        continue
      }
      const traits = cellTraits(dna)
      const w = traits.reproductionRate * (0.35 + traits.spreadMax / 180)
      weights.push(w)
      total += w
    }
    if (total <= 0) return occupied[rng.int(0, occupied.length - 1)]
    let roll = rng.range(0, total)
    for (let i = 0; i < occupied.length; i++) {
      roll -= weights[i]
      if (roll <= 0) return occupied[i]
    }
    return occupied[occupied.length - 1]
  }

  private pickNeighborIndex(rng: Rng, index: number): number {
    const col = index % this.cols
    const row = Math.floor(index / this.cols)
    const options = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ]
    const [dc, dr] = options[rng.int(0, options.length - 1)]
    const nc = this.wrap(dc, this.cols)
    const nr = this.wrap(dr, this.rows)
    return nr * this.cols + nc
  }

  private rngChance(rng: Rng, probability: number): boolean {
    return rng.range(0, 1) < probability
  }

  tryWindReseed(
    rng: Rng,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
    chance: number,
    maxCells: number,
  ): boolean {
    if (this.countEdible() > 0) return false
    if (maxCells <= 0) return false
    if (!this.rngChance(rng, chance)) return false
    const bounds = getWorldBounds()
    const idx = this.cellIndex(
      rng.range(0, bounds.width),
      rng.range(0, bounds.height),
    )
    if (this.dnaByCell[idx]) this.releaseDeadWater(idx, soil, atmosphere)
    this.seedCell(idx, createPlantKindDna(GRASS_KIND, rng), rng)
    this.fundStructuralWaterFromSoil(idx, soil, atmosphere)
    return true
  }

  applyDrowning(
    terrain: TerrainWater,
    soil: SoilAccess,
    atmosphere: AtmospherePool,
    raining = false,
  ): void {
    for (let i = 0; i < this.energy.length; i++) {
      if (!this.isLiveTurf(i)) continue
      let stress = terrain.grassFloodStressAtCell(i)
      if (stress <= 0) continue
      if (raining) stress *= GRASS_FLOOD_RAIN_STRESS_MULT
      const stressMult =
        GRASS_FLOOD_DRAIN_STRESS_MIN +
        stress * (GRASS_FLOOD_DRAIN_STRESS_MAX - GRASS_FLOOD_DRAIN_STRESS_MIN)
      this.drainBiomassDirect(i, GRASS_DROWN_DRAIN_FRACTION * stressMult, soil, atmosphere)
    }
  }

  releaseDeadWater(index: number, soil: SoilAccess, atmosphere: AtmospherePool): void {
    const hydric = turfHydricWater(this.energy[index], this.water[index])
    if (hydric <= 0) {
      this.clearCell(index)
      return
    }
    const { x, y } = this.cellCenter(index)
    const toSoil = hydric * 0.1
    const toAir = hydric * 0.9
    const soilApplied = soil.depositWater(x, y, toSoil)
    atmosphere.vent(x, y, toAir + (toSoil - soilApplied))
    this.clearCell(index)
  }
}
