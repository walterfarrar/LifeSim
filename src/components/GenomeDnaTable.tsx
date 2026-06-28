import { HERBIVORE_GENE_LABELS } from '../sim/geneLabels'
import type { DNA } from '../sim/dna'

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

type GenomeDnaTableProps = {
  dna: DNA
  labels?: Record<number, string>
}

export function GenomeDnaTable({ dna, labels }: GenomeDnaTableProps) {
  return (
    <div className="dna-table-wrap">
      <table className="dna-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Gene</th>
            <th>Raw</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(dna, (allele, index) => (
            <tr key={index}>
              <td>{index}</td>
              <td>{labels?.[index] ?? HERBIVORE_GENE_LABELS[index] ?? `Gene ${index}`}</td>
              <td>{allele}</td>
              <td>{fmt((allele / 255) * 100, 0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
