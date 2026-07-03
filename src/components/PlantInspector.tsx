import { GenomeDnaTable } from './GenomeDnaTable'
import { plantLineageLabel, plantRadius, plantTraits } from '../sim/entities/plant'
import { PLANT_GENE_LABELS } from '../sim/geneLabels'
import { isPlantDormant } from '../sim/plantClimate'
import { moistureGrowthFactor } from '../sim/soilMoisture'
import { formatYears } from '../sim/timeScale'
import type { SeasonName } from '../sim/seasons'
import { temperatureComfortFactor } from '../sim/temperature'
import type { Plant } from '../sim/types'

type PlantInspectorProps = {
  plant: Plant
  soilMoisture: number
  temperature: number
  season: SeasonName
  onClose: () => void
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function PlantInspector({
  plant,
  soilMoisture,
  temperature,
  season,
  onClose,
}: PlantInspectorProps) {
  const traits = plantTraits(plant)
  const dormant = isPlantDormant(plant.dna, season, temperature)
  const moistureFactor = moistureGrowthFactor(soilMoisture, traits.moistureNeed)
  const tempComfort = dormant
    ? 0.72
    : temperatureComfortFactor(
        temperature,
        traits.idealTemp,
        traits.tempGrowthHalfWidth,
        traits.tempSurvivalHalfWidth,
      )
  const radius = plantRadius(plant)

  return (
    <section className="map-inspector">
      <header className="inspector-header">
        <div className="inspector-title-row">
          <h2>
            {plantLineageLabel(plant)} #{plant.id}
          </h2>
        </div>
        <button type="button" className="inspector-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <dl className="inspector-grid">
        <div>
          <dt>Lineage</dt>
          <dd>{plantLineageLabel(plant)}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{formatYears(plant.age)}</dd>
        </div>
        <div>
          <dt>Energy</dt>
          <dd>
            {fmt(plant.energy)} / {fmt(traits.maxEnergy, 0)}
          </dd>
        </div>
        <div>
          <dt>Tissue water</dt>
          <dd>{fmt(plant.water)}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{fmt(radius)} radius</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            {fmt(plant.x, 0)}, {fmt(plant.y, 0)}
          </dd>
        </div>
        <div>
          <dt>Local soil moisture</dt>
          <dd>{fmt(soilMoisture * 100, 0)}%</dd>
        </div>
        <div>
          <dt>Moisture growth</dt>
          <dd>{fmt(moistureFactor * 100, 0)}%</dd>
        </div>
        <div>
          <dt>Temperature comfort</dt>
          <dd>{fmt(tempComfort * 100, 0)}%</dd>
        </div>
        <div>
          <dt>Seasonal state</dt>
          <dd>{dormant ? `Dormant (${season})` : `Active (${season})`}</dd>
        </div>
        <div>
          <dt>Drought stress</dt>
          <dd>{plant.droughtTicks > 0 ? `${plant.droughtTicks} ticks` : 'None'}</dd>
        </div>
      </dl>

      <h3>Expressed traits</h3>
      <dl className="inspector-traits">
        <div>
          <dt>Max energy</dt>
          <dd>{fmt(traits.maxEnergy, 0)}</dd>
        </div>
        <div>
          <dt>Growth rate</dt>
          <dd>{fmt(traits.growthRate, 2)}</dd>
        </div>
        <div>
          <dt>Reproduction</dt>
          <dd>{fmt(traits.reproductionRate, 2)}</dd>
        </div>
        <div>
          <dt>Moisture need</dt>
          <dd>{fmt(traits.moistureNeed * 100, 0)}%</dd>
        </div>
        <div>
          <dt>Hardiness</dt>
          <dd>{fmt(traits.hardiness * 100, 0)}%</dd>
        </div>
        <div>
          <dt>Ideal temp</dt>
          <dd>{fmt(traits.idealTemp, 0)}°C</dd>
        </div>
        <div>
          <dt>Spread range</dt>
          <dd>
            {fmt(traits.spreadMin, 0)}–{fmt(traits.spreadMax, 0)}
          </dd>
        </div>
        <div>
          <dt>Max age</dt>
          <dd>{formatYears(traits.maxAge)}</dd>
        </div>
      </dl>

      <h3>DNA (raw genes)</h3>
      <GenomeDnaTable dna={plant.dna} labels={PLANT_GENE_LABELS} />
    </section>
  )
}
