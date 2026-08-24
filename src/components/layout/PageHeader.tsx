// En-tête de page : titre + actions.
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  backTo?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {backTo}
        <div>
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}