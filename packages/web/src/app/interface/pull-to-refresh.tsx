'use client'

import { useRef, useCallback, useState, useEffect } from 'react'

const THRESHOLD = 80

export function PullToRefresh({ targetSelector }: { targetSelector: string }) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const isPulling = useRef(false)
  const pullDistanceRef = useRef(0)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const target = document.querySelector(targetSelector)
    if (!target || target.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    isPulling.current = true
  }, [targetSelector])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current) return
    const diff = e.touches[0].clientY - startY.current
    if (diff < 0) { isPulling.current = false; setPulling(false); setPullDistance(0); pullDistanceRef.current = 0; return }
    const clamped = Math.min(diff, THRESHOLD * 1.5)
    pullDistanceRef.current = clamped
    setPulling(true)
    setPullDistance(clamped)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (pullDistanceRef.current >= THRESHOLD) {
      window.location.reload()
    }
    isPulling.current = false
    pullDistanceRef.current = 0
    setPulling(false)
    setPullDistance(0)
  }, [])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  if (!pulling || pullDistance < 10) return null

  return (
    <div className="pull-indicator" style={{ height: pullDistance, opacity: Math.min(pullDistance / THRESHOLD, 1) }}>
      <span className={pullDistanceRef.current >= THRESHOLD ? 'pull-ready' : ''}>
        {pullDistanceRef.current >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
      </span>
    </div>
  )
}
