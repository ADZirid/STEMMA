import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  to: string
  label: string
  icon: LucideIcon
  active: boolean
  collapsed: boolean
}

export function SidebarNavItem({ to, label, icon: Icon, active, collapsed }: Props) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={cn(
        'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}