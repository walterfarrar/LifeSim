# LifeSim

Evolution simulator — herbivores with DNA, plants as food, and room to grow.

## Run locally

```bash
npm install
npm run dev
```

## Live demo

**Auto-updates on every push (use this on your phone):**  
https://walterfarrar.github.io/LifeSim/

**Netlify mirror (same app, deploys when pushed to `master` via GitHub Actions):**  
https://lifesim-walterfarrar.netlify.app/

Pushes to `master` deploy to GitHub Pages automatically. If the site looks stale on your phone, hard-refresh or clear the browser cache — bookmark the GitHub Pages URL above.

## Architecture

- `src/sim/` — simulation engine (DNA, entities, world tick loop)
- `src/components/` — React + canvas UI

Herbivores inherit half their alleles from each parent (random per gene), with occasional mutation. Plants grow over time and regrow via ambient spawning.

Future: carnivores, plant DNA, spatial indexing, and more species plug into the same layers.
