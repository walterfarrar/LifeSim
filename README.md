# LifeSim

Evolution simulator — herbivores with DNA, plants as food, and room to grow.

## Run locally

```bash
npm install
npm run dev
```

## Architecture

- `src/sim/` — simulation engine (DNA, entities, world tick loop)
- `src/components/` — React + canvas UI

Herbivores inherit half their alleles from each parent (random per gene), with occasional mutation. Plants grow over time and regrow via ambient spawning.

Future: carnivores, plant DNA, spatial indexing, and more species plug into the same layers.
