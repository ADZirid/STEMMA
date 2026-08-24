// ---------------------------------------------------------------------------
// Utilitaires export PDF / impression pour STEMMA.
// ---------------------------------------------------------------------------
import { save } from '@tauri-apps/plugin-dialog'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

/**
 * Demande un chemin de sauvegarde via le dialogue Tauri.
 */
async function askSavePath(defaultName: string, ext: string): Promise<string | null> {
  return save({
    title: 'Enregistrer le fichier',
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  })
}

/**
 * Exporte un élément DOM en PDF (paysage, A3 pour les grands arbres).
 */
export async function exportElementToPdf(
  el: HTMLElement,
  filename: string,
  opts?: { landscape?: boolean; scale?: number },
): Promise<void> {
  const landscape = opts?.landscape ?? true
  const scale = opts?.scale ?? 2

  const dataUrl = await toPng(el, {
    pixelRatio: scale,
    backgroundColor: '#ffffff',
    style: { transform: 'none', transformOrigin: 'top left' },
  })

  const img = new Image()
  img.src = dataUrl
  await new Promise<void>((res) => { img.onload = () => res() })

  const pdfW = landscape ? 420 : 210
  const pdfH = 297
  const ratio = Math.min(pdfW / img.width, pdfH / img.height)
  const w = img.width * ratio
  const h = img.height * ratio

  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)

  const path = await askSavePath(`${filename}.pdf`, 'pdf')
  if (!path) return

  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = path.split(/[/\\]/).pop() || `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Imprime un élément DOM.
 */
export function printElement(_el: HTMLElement): void {
  window.print()
}

/**
 * Exporte un élément DOM en PNG avec dialogue de sauvegarde.
 */
export async function exportElementToPng(
  el: HTMLElement,
  filename: string,
  scale = 2,
): Promise<void> {
  const dataUrl = await toPng(el, {
    pixelRatio: scale,
    backgroundColor: '#ffffff',
    style: { transform: 'none', transformOrigin: 'top left' },
  })

  const path = await askSavePath(`${filename}.png`, 'png')
  if (!path) return

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = path.split(/[/\\]/).pop() || `${filename}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
