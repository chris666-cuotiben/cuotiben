import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Edit3 } from 'lucide-react'
import type { ParsedQuestion } from '../../lib/ocr-service'

interface OCRReviewFormProps {
  parsed: ParsedQuestion | null
  imageUrl?: string
  onConfirm: (data: ParsedQuestion) => void
  onBack: () => void
}

export default function OCRReviewForm({ parsed, imageUrl, onConfirm, onBack }: OCRReviewFormProps) {
  const [editData, setEditData] = useState<ParsedQuestion>({
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    explanation: '',
    confidence: 0,
  })

  useEffect(() => {
    if (parsed) {
      setEditData(parsed)
    }
  }, [parsed])

  const handleChange = (field: keyof ParsedQuestion, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  const hasOptions = editData.optionA || editData.optionB || editData.optionC || editData.optionD

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Confidence Indicator */}
      {parsed && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            parsed.confidence >= 80
              ? 'bg-green-50 text-green-700'
              : parsed.confidence >= 50
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-orange-50 text-orange-700'
          }`}
        >
          {parsed.confidence >= 80 ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>
            OCR 识别置信度：{parsed.confidence}%
            {parsed.confidence < 80 && ' — 建议仔细核对'}
          </span>
        </div>
      )}

      {!parsed && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-blue-50 text-blue-700">
          <Edit3 size={16} />
          <span>未检测到 OCR 结果，请手动输入题目内容</span>
        </div>
      )}

      {/* Image Preview (small) */}
      {imageUrl && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <img
            src={imageUrl}
            alt="原始题目"
            className="w-full h-32 object-cover"
          />
        </div>
      )}

      {/* Question Text */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          题目内容 *
        </label>
        <textarea
          value={editData.questionText}
          onChange={(e) => handleChange('questionText', e.target.value)}
          rows={4}
          placeholder="题目正文（可编辑修改 OCR 结果）"
          className="w-full text-sm text-gray-900 placeholder-gray-300 focus:outline-none resize-none"
        />
      </div>

      {/* Options */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <label className="text-xs font-semibold text-gray-500 mb-3 block">
          选项 {hasOptions ? '(已识别)' : '(手动输入)'}
        </label>
        <div className="space-y-2.5">
          {(['A', 'B', 'C', 'D'] as const).map((opt) => {
            const fieldKey = `option${opt}` as keyof ParsedQuestion
            const value = editData[fieldKey]
            return (
              <div key={opt} className="flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                  {opt}
                </span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleChange(fieldKey, e.target.value)}
                  placeholder={`选项 ${opt}${value ? '' : '（未识别到）'}`}
                  className={`flex-1 text-sm rounded-lg px-3 py-2.5 focus:outline-none transition-colors ${
                    value ? 'bg-green-50 focus:bg-green-50' : 'bg-gray-50 focus:bg-gray-100'
                  }`}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Answer */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <label className="text-xs font-semibold text-gray-500 mb-3 block">
          正确答案 {editData.correctAnswer && <span className="text-green-500">(已识别)</span>}
        </label>
        <div className="flex gap-2 mb-3">
          {(['A', 'B', 'C', 'D', '其他'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                if (opt === '其他') {
                  handleChange('correctAnswer', editData.correctAnswer === '其他' ? '' : '')
                } else {
                  handleChange('correctAnswer', editData.correctAnswer === opt ? '' : opt)
                }
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                opt === '其他'
                  ? !['A', 'B', 'C', 'D'].includes(editData.correctAnswer) && editData.correctAnswer
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                  : editData.correctAnswer === opt
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {(!['A', 'B', 'C', 'D'].includes(editData.correctAnswer) || !editData.correctAnswer) && (
          <input
            type="text"
            value={['A', 'B', 'C', 'D'].includes(editData.correctAnswer) ? '' : editData.correctAnswer}
            onChange={(e) => handleChange('correctAnswer', e.target.value)}
            placeholder="手动输入答案（如申论题）"
            className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 focus:outline-none focus:bg-gray-100"
          />
        )}
      </div>

      {/* Explanation (from OCR) */}
      {editData.explanation && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">
            解析 (OCR 识别)
          </label>
          <textarea
            value={editData.explanation}
            onChange={(e) => handleChange('explanation', e.target.value)}
            rows={3}
            className="w-full text-sm text-gray-900 focus:outline-none resize-none"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
        >
          返回拍照
        </button>
        <button
          onClick={() => onConfirm(editData)}
          disabled={!editData.questionText.trim()}
          className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          确认，继续填信息
        </button>
      </div>
    </div>
  )
}
