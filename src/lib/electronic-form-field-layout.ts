export type ElectronicFormFieldWidth = 'full' | 'half' | 'third'

export function getElectronicFormFieldWidth(
  config: Record<string, unknown> | undefined
): ElectronicFormFieldWidth {
  const w = config?.width
  if (w === 'half' || w === 'third') return w
  return 'full'
}

/** Builder 畫布：版面由「多欄列」巢狀決定，列本身一律佔滿寬 */
export function electronicFormFieldCanvasColClass(
  _fieldType: string,
  _config: Record<string, unknown> | undefined
): string {
  return 'col-span-12'
}
