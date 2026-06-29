import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type GeneLabelTooltipProps = {
  label: string
  description: string
}

export function GeneLabelTooltip({ label, description }: GeneLabelTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null)

  const show = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const margin = 8
    const maxWidth = 280
    const estimatedHeight = 72

    let left = rect.left
    let top = rect.bottom + margin

    if (left + maxWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - maxWidth - margin)
    }

    if (top + estimatedHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estimatedHeight - margin)
    }

    setTooltip({ left, top })
  }, [])

  const hide = useCallback(() => setTooltip(null), [])

  return (
    <>
      <span
        ref={anchorRef}
        className="gene-label gene-label-has-tooltip"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        aria-describedby={tooltip ? 'gene-tooltip-active' : undefined}
      >
        {label}
      </span>
      {tooltip &&
        createPortal(
          <div
            id="gene-tooltip-active"
            className="gene-tooltip-popup"
            style={{ left: tooltip.left, top: tooltip.top }}
            role="tooltip"
          >
            {description}
          </div>,
          document.body,
        )}
    </>
  )
}
