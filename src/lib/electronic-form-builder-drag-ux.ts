/**
 * 以 1×1 透明 canvas 取代預設拖曳預覽，減少綠色「+」與半透明截圖游標（實際效果依瀏覽器而異）。
 */
export function setElectronicFormBuilderBlankDragImage(e: DragEvent): void {
  const dt = e.dataTransfer
  if (!dt) return
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  dt.setDragImage(canvas, 0, 0)
}
