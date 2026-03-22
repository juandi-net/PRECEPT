'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Org {
  id: string
  name: string
}

export function OrgSwitcher({ orgs, activeOrg }: { orgs: Org[]; activeOrg: Org }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function switchOrg(orgId: string) {
    document.cookie = `active_org_id=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="org-switcher" ref={ref}>
      <button className="org-switcher-trigger" onClick={() => setOpen(!open)}>
        <strong>{activeOrg.name.toUpperCase()}</strong>
        <span className="org-switcher-chevron">&#9662;</span>
      </button>
      {open && (
        <div className="org-switcher-dropdown">
          {orgs.map((o) => (
            <button
              key={o.id}
              className={`org-switcher-item${o.id === activeOrg.id ? ' org-switcher-item--active' : ''}`}
              onClick={() => switchOrg(o.id)}
            >
              {o.name.toUpperCase()}
            </button>
          ))}
          <div className="org-switcher-divider" />
          <a href="/onboarding" className="org-switcher-item org-switcher-item--add">
            + Add Organization
          </a>
        </div>
      )}
    </div>
  )
}
