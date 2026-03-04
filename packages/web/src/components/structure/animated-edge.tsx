'use client'

import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export const AnimatedEdge = memo(function AnimatedEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  const isAnimated = (data as { animated?: boolean })?.animated ?? false

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: isAnimated ? '#3b82f6' : '#d1d5db',
          strokeWidth: isAnimated ? 2 : 1,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
        {...props}
      />
      {isAnimated && (
        <circle r="4" fill="#3b82f6">
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  )
})
