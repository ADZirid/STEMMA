import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  if (collapsed) {
    return (
      <button
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        title={dark ? 'Mode clair' : 'Mode sombre'}
      >
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    )
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {dark ? 'Mode clair' : 'Mode sombre'}
    </Button>
  )
}