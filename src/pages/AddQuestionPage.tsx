import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, ChevronDown, Plus, X, Camera, Check, AlertCircle, Loader, Crop } from 'lucide-react'
import { saveQuestion, getCategories } from '../lib/storage'
import { processImageWithOCR, createImagePreview, revokeImagePreview, isOCRConfigured, parseQuestionFromText, getOCRConfig } from '../lib/ocr-service'
import ImageUploader from '../components/ocr/ImageUploader'
import OCRReviewForm from '../components/ocr/OCRReviewForm'
import ImageCropper from '../components/ocr/ImageCropper'
import OCRTextEditor from '../components/ocr/OCRTextEditor'
import type { Question } from '../types/question'
import type { Category } from '../types/category'
import type { ParsedQuestion, UploadedImage } from '../lib/ocr-service'

type AddStep = 'upload' | 'edit-text' | 'review' | 'metadata'

export default function AddQuestionPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<AddStep>('upload')
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrStatus, setOcrStatus] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [ocrRawText, setOcrRawText] = useState('')
  const [ocrParsed, setOcrParsed] = useState<ParsedQuestion | null>(null)
  const [ocrConfigured, setOcrConfigured] = useState(false)
  const [croppingImage, setCroppingImage] = useState<UploadedImage | null>(null)

  const [form, setForm] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: '',
    user_answer: '',
    explanation: '',
    source: '',
    category_id: '',
    difficulty: 0,
    tags: [] as string[],
  })

  const [tagInput, setTagInput] = useState('')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [activeOcrTab, setActiveOcrTab] = useState<'ocr' | 'manual'>('ocr')

  useEffect(() => {
    getCategories().then(setCategories)
    setOcrConfigured(isOCRConfigured())
  }, [])

  const handleStartOCR = async () => {
    if (images.length === 0) return
    setIsProcessing(true)
    setOcrError('')
    setOcrStatus('正在识别文字...')

    try {
      const config = getOCRConfig()

      // For Tesseract: use processImageWithOCR which returns fullText
      // For Tencent: use callTencentOCR which also returns fullText
      setOcrStatus('正在识别文字...（可能需要 5-20 秒）')
      const result = await processImageWithOCR(images[0].file)

      if (result.textBlocks.length === 0 && !result.fullText) {
        setOcrError('OCR 未识别到任何文字。请确认照片清晰、光线充足。')
        setIsProcessing(false)
        return
      }

      setOcrStatus('识别完成！')
      setOcrRawText(result.fullText || result.textBlocks.map(b => b.text).join('\n'))
      setStep('edit-text')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setOcrError(`识别失败：${msg}`)
    } finally {
      setIsProcessing(false)
      setOcrStatus('')
    }
  }

  const handleTextConfirm = (editedText: string) => {
    const parsed = parseQuestionFromText(editedText)
    setOcrParsed(parsed)
    setStep('review')
  }

  const handleOCRConfirm = (data: ParsedQuestion) => {
    setForm({
      ...form,
      question_text: data.questionText,
      option_a: data.optionA,
      option_b: data.optionB,
      option_c: data.optionC,
      option_d: data.optionD,
      correct_answer: data.correctAnswer,
      explanation: data.explanation,
    })
    setStep('metadata')
  }

  const handleSkipOCR = () => {
    setStep('metadata')
  }

  const handleCropImage = (img: UploadedImage) => {
    setCroppingImage(img)
  }

  const handleCropDone = (croppedBlob: Blob) => {
    if (!croppingImage) return
    // Replace the original image with the cropped version
    const croppedFile = new File([croppedBlob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' })
    URL.revokeObjectURL(croppingImage.previewUrl)
    const newImage: UploadedImage = {
      file: croppedFile,
      previewUrl: URL.createObjectURL(croppedBlob),
      id: croppingImage.id,
    }
    setImages(images.map((img) => (img.id === croppingImage.id ? newImage : img)))
    setCroppingImage(null)
  }

  const handleCropCancel = () => {
    setCroppingImage(null)
  }

  const parentCategories = categories.filter((c) => !c.parent_id)
  const getChildren = (parentId: string) => categories.filter((c) => c.parent_id === parentId)
  const selectedCategory = categories.find((c) => c.id === form.category_id)

  const handleSave = async () => {
    if (!form.question_text.trim()) return
    if (!form.correct_answer.trim()) {
      alert('请填写正确答案')
      return
    }

    setSaving(true)
    const question: Question = {
      id: crypto.randomUUID(),
      category_id: form.category_id || 'changshi-zz',
      question_text: form.question_text.trim(),
      option_a: form.option_a.trim() || null,
      option_b: form.option_b.trim() || null,
      option_c: form.option_c.trim() || null,
      option_d: form.option_d.trim() || null,
      correct_answer: form.correct_answer.trim(),
      user_answer: form.user_answer.trim() || null,
      explanation: form.explanation.trim() || null,
      source: form.source.trim() || null,
      original_image_urls: images.map((img) => img.previewUrl),
      ocr_processed: ocrParsed !== null,
      status: 'active',
      difficulty: form.difficulty,
      tags: form.tags,
      wrong_count: 0,
      mastered_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveQuestion(question)
    // Clean up preview URLs
    images.forEach((img) => revokeImagePreview(img.previewUrl))
    navigate('/questions', { replace: true })
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] })
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })
  }

  // Step indicator labels
  const steps: { key: AddStep; label: string }[] = [
    { key: 'upload', label: '拍照' },
    { key: 'edit-text', label: '校对' },
    { key: 'review', label: '确认' },
    { key: 'metadata', label: '信息' },
  ]

  return (
    <div className="min-h-full bg-gray-50 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 safe-area-top">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => {
            if (step === 'metadata') setStep('review')
            else if (step === 'review') setStep('edit-text')
            else if (step === 'edit-text') setStep('upload')
            else navigate(-1)
          }} className="p-2 -ml-2 text-gray-600">
            <ArrowLeft size={20} />
          </button>

          {/* Step Indicator */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === s.key
                      ? 'bg-primary-500 text-white'
                      : steps.findIndex((x) => x.key === step) > i
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {steps.findIndex((x) => x.key === step) > i ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs ${
                  step === s.key ? 'text-primary-600 font-medium' : 'text-gray-400'
                }`}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <div className="w-4 h-px bg-gray-200" />}
              </div>
            ))}
          </div>

          {step === 'metadata' && (
            <button
              onClick={handleSave}
              disabled={saving || !form.question_text.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 active:scale-95 transition-all"
            >
              <Save size={16} />
              保存
            </button>
          )}
          {step !== 'metadata' && <div className="w-16" />}
        </div>
      </div>

      <div className="p-4 space-y-4 pb-8">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            {!ocrConfigured && (
              <div className="bg-yellow-50 rounded-xl p-4 text-sm text-yellow-700">
                <p className="font-medium mb-1">提示：OCR 功能未配置</p>
                <p className="text-xs text-yellow-600">
                  你可以先拍照记录题目图片，然后手动填写题目内容。如需自动识别，请前往
                  <button
                    onClick={() => navigate('/settings')}
                    className="text-primary-500 underline mx-1"
                  >
                    设置 → OCR 配置
                  </button>
                  填入腾讯云 API 密钥。
                </p>
              </div>
            )}

            {ocrConfigured && !ocrError && !isProcessing && (
              <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3 text-sm text-green-700">
                <Check size={18} className="text-green-500" />
                <span>OCR 已配置，拍照后点击「开始 OCR 识别」即可</span>
              </div>
            )}

            {/* Processing Status */}
            {isProcessing && (
              <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3 text-sm text-blue-700">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <p className="font-medium">{ocrStatus}</p>
                  <p className="text-xs text-blue-500 mt-0.5">请稍候，识别可能需要几秒钟...</p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {ocrError && (
              <div className="bg-red-50 rounded-xl p-4 text-sm">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-red-700 whitespace-pre-line">{ocrError}</div>
                </div>
                <button
                  onClick={() => setOcrError('')}
                  className="text-xs text-red-500 underline"
                >
                  关闭
                </button>
              </div>
            )}

            <ImageUploader
              images={images}
              onImagesChange={setImages}
              onCropImage={handleCropImage}
              onStartOCR={ocrConfigured ? handleStartOCR : handleSkipOCR}
              isProcessing={isProcessing}
            />

            {!ocrConfigured && images.length > 0 && (
              <button
                onClick={handleSkipOCR}
                className="w-full py-3.5 bg-white border-2 border-primary-200 text-primary-600 rounded-xl font-medium active:scale-[0.98] transition-all"
              >
                跳过 OCR，手动输入题目
              </button>
            )}
          </>
        )}

        {/* Step 2: Edit raw OCR text */}
        {step === 'edit-text' && (
          <OCRTextEditor
            rawText={ocrRawText}
            imageUrl={images[0]?.previewUrl}
            onConfirm={handleTextConfirm}
            onBack={() => setStep('upload')}
          />
        )}

        {/* Step 3: Review structured fields */}
        {step === 'review' && (
          <OCRReviewForm
            parsed={ocrParsed}
            imageUrl={images[0]?.previewUrl}
            onConfirm={handleOCRConfirm}
            onBack={() => setStep('edit-text')}
          />
        )}

        {/* Step 3: Metadata */}
        {step === 'metadata' && (
          <>
            {/* Image preview reminder */}
            {images.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                <img
                  src={images[0].previewUrl}
                  alt=""
                  className="w-12 h-12 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">已附加 {images.length} 张图片</p>
                  {ocrParsed && (
                    <p className="text-xs text-green-500">OCR 已识别 · 置信度 {ocrParsed.confidence}%</p>
                  )}
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="text-xs text-primary-500"
                >
                  重拍
                </button>
              </div>
            )}

            {/* Category Picker */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedCategory?.color || '#6366f1' }}
                  />
                  <span className="text-sm text-gray-700">
                    {selectedCategory ? selectedCategory.name : '选择分类'}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform ${showCategoryPicker ? 'rotate-180' : ''}`}
                />
              </button>
              {showCategoryPicker && (
                <div className="border-t border-gray-100 p-3 space-y-2 max-h-64 overflow-y-auto">
                  {parentCategories.map((parent) => (
                    <div key={parent.id}>
                      <p className="text-xs font-semibold text-gray-400 px-2 py-1">{parent.name}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {getChildren(parent.id).map((child) => (
                          <button
                            key={child.id}
                            onClick={() => {
                              setForm({ ...form, category_id: child.id })
                              setShowCategoryPicker(false)
                            }}
                            className={`text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
                              form.category_id === child.id
                                ? 'bg-primary-50 text-primary-600 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {child.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Question Text */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <label className="text-xs font-medium text-gray-500 mb-2 block">题目内容 *</label>
              <textarea
                value={form.question_text}
                onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                placeholder="输入题目内容..."
                rows={4}
                className="w-full text-sm text-gray-900 placeholder-gray-300 focus:outline-none resize-none"
              />
            </div>

            {/* Options A/B/C/D */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
              <label className="text-xs font-medium text-gray-500 block">选项</label>
              {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                <div key={opt} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                    {opt}
                  </span>
                  <input
                    type="text"
                    value={form[`option_${opt.toLowerCase()}` as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [`option_${opt.toLowerCase()}`]: e.target.value })}
                    placeholder={`选项 ${opt}`}
                    className="flex-1 text-sm bg-gray-50 rounded-lg px-3 py-2.5 focus:outline-none focus:bg-gray-100"
                  />
                </div>
              ))}
            </div>

            {/* Answer */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
              <label className="text-xs font-medium text-gray-500 block">答案</label>
              <div className="flex gap-2">
                {(['A', 'B', 'C', 'D', '其他'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setForm({ ...form, correct_answer: opt === '其他' ? '' : opt })}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                      (opt === '其他' && !['A', 'B', 'C', 'D'].includes(form.correct_answer) && form.correct_answer)
                        ? 'bg-green-500 text-white'
                        : form.correct_answer === opt
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {(!['A', 'B', 'C', 'D'].includes(form.correct_answer) || !form.correct_answer) && (
                <input
                  type="text"
                  value={['A', 'B', 'C', 'D'].includes(form.correct_answer) ? '' : form.correct_answer}
                  onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}
                  placeholder="输入正确答案（申论题目可填写文字答案）"
                  className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 focus:outline-none focus:bg-gray-100"
                />
              )}
              <div className="pt-2 border-t border-gray-100">
                <label className="text-xs font-medium text-gray-500 block mb-2">我的错误答案（可选）</label>
                <input
                  type="text"
                  value={form.user_answer}
                  onChange={(e) => setForm({ ...form, user_answer: e.target.value })}
                  placeholder="你当时选的答案"
                  className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 focus:outline-none focus:bg-gray-100"
                />
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <label className="text-xs font-medium text-gray-500 mb-2 block">解析（可选）</label>
              <textarea
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                placeholder="输入题目解析..."
                rows={3}
                className="w-full text-sm text-gray-900 placeholder-gray-300 focus:outline-none resize-none"
              />
            </div>

            {/* Source & Difficulty */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">来源（可选）</label>
                <input
                  type="text"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="如：2024国考真题、华图模拟卷"
                  className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 focus:outline-none focus:bg-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">难度</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      onClick={() => setForm({ ...form, difficulty: form.difficulty === d ? 0 : d })}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        d <= form.difficulty ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <label className="text-xs font-medium text-gray-500 block mb-2">标签</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg text-xs"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="输入标签按回车"
                  className="flex-1 text-sm bg-gray-50 rounded-lg px-3 py-2 focus:outline-none focus:bg-gray-100"
                />
                <button
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Image Cropper (full-screen overlay) */}
      {croppingImage && (
        <ImageCropper
          imageUrl={croppingImage.previewUrl}
          onCrop={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}
