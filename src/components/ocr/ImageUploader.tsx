import { useState, useRef } from 'react'
import { Camera, Image as ImageIcon, X, Upload } from 'lucide-react'
import type { UploadedImage } from '../../lib/ocr-service'

interface ImageUploaderProps {
  images: UploadedImage[]
  onImagesChange: (images: UploadedImage[]) => void
  onStartOCR: () => void
  isProcessing: boolean
  maxImages?: number
}

export default function ImageUploader({
  images,
  onImagesChange,
  onStartOCR,
  isProcessing,
  maxImages = 3,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const newImages: UploadedImage[] = []
    for (let i = 0; i < files.length; i++) {
      if (images.length + newImages.length >= maxImages) break
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      newImages.push({
        file,
        previewUrl: URL.createObjectURL(file),
        id: crypto.randomUUID(),
      })
    }
    onImagesChange([...images, ...newImages])
  }

  const removeImage = (id: string) => {
    const img = images.find((i) => i.id === id)
    if (img) URL.revokeObjectURL(img.previewUrl)
    onImagesChange(images.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Capture Buttons */}
      {images.length < maxImages && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-8 bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-300 active:scale-[0.98] transition-all"
          >
            <Camera size={28} className="text-primary-500" />
            <span className="text-sm font-medium text-gray-600">拍照</span>
            <span className="text-xs text-gray-400">直接拍摄题目</span>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-8 bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-300 active:scale-[0.98] transition-all"
          >
            <ImageIcon size={28} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-600">相册</span>
            <span className="text-xs text-gray-400">从相册选取</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={maxImages > 1}
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </button>
        </div>
      )}

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.previewUrl}
                  alt="题目图片"
                  className="w-full h-40 object-cover rounded-xl border border-gray-200"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
                {images.indexOf(img) === 0 && images.length > 1 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full">
                    主图
                  </span>
                )}
              </div>
            ))}

            {/* Add more button */}
            {images.length < maxImages && (
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="h-40 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-300 active:scale-[0.98] transition-all"
              >
                <Camera size={20} className="text-gray-400" />
                <span className="text-xs text-gray-400">添加更多</span>
              </button>
            )}
          </div>

          {/* OCR Button */}
          <button
            onClick={onStartOCR}
            disabled={isProcessing || images.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-500 text-white rounded-xl font-medium disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                正在识别中...
              </>
            ) : (
              <>
                <Upload size={18} />
                开始 OCR 识别
              </>
            )}
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 rounded-xl p-3">
        <p className="text-xs text-blue-600 leading-relaxed">
          <span className="font-semibold">拍摄建议：</span>
          确保光线充足、题目清晰完整。OCR 识别后可以手动修改识别结果。初次使用需要在「设置」中配置 OCR 密钥。
        </p>
      </div>
    </div>
  )
}

export type { UploadedImage }
