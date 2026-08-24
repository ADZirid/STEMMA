// ---------------------------------------------------------------------------
// Coquille applicative : barre latérale + sélecteur de projet + contenu.
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Home, TreePine, Users, HeartHandshake, Search, ScrollText, Image, CalendarDays,
  DatabaseBackup, FileJson, Settings, HelpCircle,
  PanelLeftOpen, PanelLeftClose,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarNavItem } from './SidebarNavItem'
import { ProjectSwitcher } from './ProjectSwitcher'
import { ThemeToggle } from '../ThemeToggle'

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/tree', label: 'Arbre', icon: TreePine },
  { to: '/people', label: 'Personnes', icon: Users },
  { to: '/families', label: 'Familles', icon: HeartHandshake },
  { to: '/search', label: 'Recherche', icon: Search },
  { to: '/sources', label: 'Sources', icon: ScrollText },
  { to: '/media', label: 'Médias', icon: Image },
  { to: '/events', label: 'Événements', icon: CalendarDays },
  { to: '/backup', label: 'Sauvegarde', icon: DatabaseBackup },
  { to: '/import-export', label: 'Import / Export', icon: FileJson },
  { to: '/settings', label: 'Paramètres', icon: Settings },
  { to: '/help', label: 'Aide', icon: HelpCircle },
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Barre latérale */}
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <div className="flex h-12 items-center gap-2 border-b px-2">
          {!collapsed && (
            <span className="min-w-0 truncate px-1 text-sm font-semibold tracking-wide">
              STEMMA
            </span>
          )}
        </div>
        <ProjectSwitcher collapsed={collapsed} />
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((item) => (
            <SidebarNavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={
                item.end
                  ? pathname === '/'
                  : pathname.startsWith(item.to)
              }
              collapsed={collapsed}
            />
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t p-2">
          <ThemeToggle collapsed={collapsed} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            title={collapsed ? 'Ouvrir la barre' : 'Réduire la barre'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

export { Link }