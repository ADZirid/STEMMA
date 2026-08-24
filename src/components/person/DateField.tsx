// ---------------------------------------------------------------------------
// Champ de date flexible : exacte / vers / avant / après / entre / inconnue.
// ---------------------------------------------------------------------------
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { QUALIFIER_LABELS } from '@/lib/dates'
import type { DateQualifier } from '@/types'

export interface DateFieldValue {
  qualifier: DateQualifier
  d1: string
  d2: string
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value?: DateFieldValue
  onChange: (v: DateFieldValue) => void
}) {
  const v: DateFieldValue = value ?? { qualifier: 'exact', d1: '', d2: '' }
  const isBetween = v.qualifier === 'between'
  const isUnknown = v.qualifier === 'unknown'

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Select
          value={v.qualifier}
          onValueChange={(q) => {
            const qualifier = q as DateQualifier
            onChange({ qualifier, d1: v.d1, d2: v.d2 })
          }}
        >
          <SelectTrigger className="w-[112px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(QUALIFIER_LABELS) as DateQualifier[]).map((q) => (
              <SelectItem key={q} value={q}>
                {QUALIFIER_LABELS[q]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isUnknown && (
          <Input
            placeholder="Ex : 1920"
            className="flex-1"
            value={v.d1}
            disabled={isUnknown}
            onChange={(e) => onChange({ ...v, d1: e.target.value })}
          />
        )}
        {isBetween && (
          <Input
            placeholder="d2"
            className="w-28"
            value={v.d2}
            onChange={(e) => onChange({ ...v, d2: e.target.value })}
          />
        )}
      </div>
    </div>
  )
}