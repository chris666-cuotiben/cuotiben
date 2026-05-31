import { useState, useRef, useEffect, useCallback } from 'react'
import { Crop, Check, X, RotateCcw, Maximize } from 'lucide-react'

interface ImageCropperProps {
  imageUrl: string
  onCrop: (croppedBlob: Blob) => void
  onCancel: () => void
}

interface CropRect {
  x: number  // percentage 0-100
  y: number  // percentage 0-100
  w: number  // percentage 0-100
  h: number  // percentage 0-100
}

export default function ImageCropper({ imageUrl, onCrop, onCancel }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<CropRect>({ x: 5, y: 5, w: 90, h: 90 })
  const [dragging, setDragging] = useState<'move' | 'tl' | 'tr' | 'bl' | 'br' | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, crop: { x: 0, y: 0, w: 0, h: 0 } })

  const handlePointerDown = (e: React.PointerEvent, action: 'move' | 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(action)
    setDragStart({ x: e.clientX, y: e.clientY, crop: { ...crop } })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    const dx = ((e.clientX - dragStart.x) / window.innerWidth) * 100
    const dy = ((e.clientY - dragStart.y) / window.innerHeight) * 100

    const newCrop = { ...crop }
    const minSize = 15

    switch (dragging) {
      case 'move':
        newCrop.x = Math.max(0, Math.min(100 - newCrop.w, dragStart.crop.x + dx))
        newCrop.y = Math.max(0, Math.min(100 - newCrop.h, dragStart.crop.y + dy))
        break
      case 'br':
        newCrop.w = Math.max(minSize, Math.min(100 - dragStart.crop.x, dragStart.crop.w + dx))
        newCrop.h = Math.max(minSize, Math.min(100 - dragStart.crop.y, dragStart.crop.h + dy))
        break
      case 'tl':
        newCrop.w = Math.max(minSize, Math.min(dragStart.crop.x + dragStart.crop.w, dragStart.crop.w - dx))
        newCrop.h = Math.max(minSize, Math.min(dragStart.crop.y + dragStart.crop.h, dragStart.crop.h - dy))
        newCrop.x = Math.max(0, dragStart.crop.x + dx)
        newCrop.y = Math.max(0, dragStart.crop.y + dy)
        break
      case 'tr':
        newCrop.w = Math.max(minSize, Math.min(100 - dragStart.crop.x, dragStart.crop.w + dx))
        newCrop.h = Math.max(minSize, Math.min(dragStart.crop.y + dragStart.crop.h, dragStart.crop.h - dy))
        newCrop.y = Math.max(0, dragStart.crop.y + dy)
        break
      case 'bl':
        newCrop.w = Math.max(minSize, Math.min(dragStart.crop.x + dragStart.crop.w, dragStart.crop.w - dx))
        newCrop.h = Math.max(minSize, Math.min(100 - dragStart.crop.y, dragStart.crop.h + dy))
        newCrop.x = Math.max(0, dragStart.crop.x + dx)
        break
    }
    setCrop(newCrop)
  }, [dragging, dragStart, crop])

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  const doCrop = () => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return

    const iw = img.naturalWidth
    const ih = img.naturalHeight

    const sx = (crop.x / 100) * iw
    const sy = (crop.y / 100) * ih
    const sw = (crop.w / 100) * iw
    const sh = (crop.h / 100) * ih

    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob)
    }, 'image/jpeg', 0.85)
  }

  const resetCrop = () => setCrop({ x: 5, y: 5, w: 90, h: 90 })

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col safe-area-top safe-area-bottom">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/95" style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={onCancel} className="p-3 -ml-1 text-white">
          <X size={24} />
        </button>
        <span className="text-white text-base font-medium">拖动蓝色角标调整范围</span>
        <button onClick={resetCrop} className="p-3 -mr-1 text-white">
          <RotateCcw size={22} />
        </button>
      </div>

      {/* Image + Crop Overlay */}
      <div
        className="flex-1 relative overflow-hidden touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="裁剪"
          onLoad={() => setImgLoaded(true)}
          className="w-full h-full object-contain"
        />

        {imgLoaded && (
          <>
            {/* Dark overlay outside crop area */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/60" />
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.w}%`,
                  height: `${crop.h}%`,
                }}
              />
            </div>

            {/* Crop frame with handles */}
            <div
              className="absolute border-2 border-blue-400"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.w}%`,
                height: `${crop.h}%`,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              {/* Corner handles */}
              <Handle pos="tl" onDown={(e) => handlePointerDown(e, 'tl')} />
              <Handle pos="tr" onDown={(e) => handlePointerDown(e, 'tr')} />
              <Handle pos="bl" onDown={(e) => handlePointerDown(e, 'bl')} />
              <Handle pos="br" onDown={(e) => handlePointerDown(e, 'br')} />
            </div>
          </>
        )}
      </div>

      {/* Bottom bar - with enough padding for iPhone home indicator */}
      <div
        className="flex items-center gap-4 px-4 py-5 bg-black/95"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 16px))' }}
      >
        <button
          onClick={onCancel}
          className="flex-1 py-4 bg-white/20 text-white rounded-2xl font-medium text-base active:bg-white/30 transition-colors"
        >
          取消
        </button>
        <button
          onClick={doCrop}
          className="flex-[2] flex items-center justify-center gap-2 py-4 bg-blue-500 text-white rounded-2xl font-bold text-base active:bg-blue-600 transition-colors"
        >
          <Crop size={20} />
          确认裁剪
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

// Corner drag handle - large touch targets for iPhone
function Handle({ pos, onDown }: { pos: 'tl' | 'tr' | 'bl' | 'br'; onDown: (e: React.PointerEvent) => void }) {
  const positionClass = {
    tl: '-top-5 -left-5',
    tr: '-top-5 -right-5',
    bl: '-bottom-5 -left-5',
    br: '-bottom-5 -right-5',
  }[pos]

  return (
    <div
      className={`absolute ${positionClass} w-12 h-12 flex items-center justify-center z-10`}
      onPointerDown={onDown}
    >
      <div className="w-5 h-5 rounded-full bg-blue-400 border-[3px] border-white shadow-lg" />
    </div>
  )
}
