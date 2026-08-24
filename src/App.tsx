import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { TreePage } from '@/pages/TreePage'
import { PeoplePage } from '@/pages/PeoplePage'
import { PersonPage } from '@/pages/PersonPage'
import { FamiliesPage } from '@/pages/FamiliesPage'
import { SearchPage } from '@/pages/SearchPage'
import { SourcesPage } from '@/pages/SourcesPage'
import { MediaPage } from '@/pages/MediaPage'
import { EventsPage } from '@/pages/EventsPage'
import { BackupPage } from '@/pages/BackupPage'
import { ImportExportPage } from '@/pages/ImportExportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { HelpPage } from '@/pages/HelpPage'

function Shell() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tree" element={<TreePage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/people/:id" element={<PersonPage />} />
        <Route path="/families" element={<FamiliesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="/import-export" element={<ImportExportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <HashRouter>
          <Shell />
        </HashRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}