import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, EyeOff, Eye, Star, Copy, ExternalLink } from 'lucide-react'
import { getQuestion, getCategories, updateQuestionStatus, deleteQuestion } from '../lib/storage'
import { formatQuestionForAI, copyToClipboard } from '../lib/clipboard'
import { useToast } from '../components/ui/Toast'
import type { Question } from '../types/question'
import type { Category } from '../types/category'

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [question, setQuestion] = useState<Question | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [showAnswer, setShowAnswer] = useState(false)

  useEffect(() => {
    if (!id) return
    loadData(id)
  }, [id])

  const loadData = async (qid: string) => {
    const [q, cats] = await Promise.all([getQuestion(qid), getCategories()])
    setQuestion(q ?? null)
    setCategories(cats)
  }

  if (!question) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  const category = categories.find((c) => c.id === question.category_id)
  const parentCategory = category?.parent_id ? categories.find((c) => c.id === category.parent_id) : null

  const handleToggleStatus = async () => {
    const newStatus = question.status === 'active' ? 'mastered' : 'active'
    await updateQuestionStatus(question.id, newStatus)
    setQuestion({ ...question, status: newStatus })
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除这道题吗？')) return
    await deleteQuestion(question.id)
    navigate('/questions', { replace: true })
  }

  const hasOptions = question.option_a || question.option_b || question.option_c || question.option_d

  return (
    <div className="min-h-full bg-gray-50 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 safe-area-top">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm font-medium text-gray-700">题目详情</span>
          <div className="flex items-center gap-1">
            <button onClick={handleToggleStatus} className="p-2 text-gray-400 hover:text-green-500">
              {question.status === 'active' ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Category & Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {parentCategory && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
              {parentCategory.name}
            </span>
          )}
          {category && (
            <span
              className="text-xs px-2.5 py-1 rounded-lg text-white"
              style={{ backgroundColor: category.color || '#6366f1' }}
            >
              {category.name}
            </span>
          )}
          <span
            className={`text-xs px-2.5 py-1 rounded-lg ${
              question.status === 'active'
                ? 'bg-orange-100 text-orange-600'
                : question.status === 'mastered'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            {question.status === 'active' ? '待复习' : question.status === 'mastered' ? '已掌握' : '已归档'}
          </span>
          {question.difficulty > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-600 flex items-center gap-1">
              <Star size={12} />
              {question.difficulty}
            </span>
          )}
        </div>

        {/* Question Text */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">题目</h3>
          <p className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap">
            {question.question_text}
          </p>
        </div>

        {/* Options */}
        {hasOptions && (
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">选项</h3>
            <div className="space-y-2.5">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const text = question[`option_${opt.toLowerCase()}` as keyof Question] as string | null
                if (!text) return null
                const isCorrect = question.correct_answer === opt
                const isWrong = question.user_answer === opt
                return (
                  <div
                    key={opt}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      showAnswer && isCorrect
                        ? 'bg-green-50 border border-green-200'
                        : showAnswer && isWrong
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-gray-50'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        showAnswer && isCorrect
                          ? 'bg-green-500 text-white'
                          : showAnswer && isWrong
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {opt}
                    </span>
                    <span className="text-sm text-gray-800 pt-0.5 flex-1">{text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Answer Section */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          {!showAnswer ? (
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full py-3 bg-primary-50 text-primary-600 rounded-xl font-medium text-sm hover:bg-primary-100 transition-colors"
            >
              点击查看答案
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">正确答案：</span>
                <span className="text-base font-bold text-green-600">{question.correct_answer}</span>
              </div>
              {question.user_answer && question.user_answer !== question.correct_answer && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">你的答案：</span>
                  <span className="text-base font-bold text-red-500 line-through">{question.user_answer}</span>
                </div>
              )}
              {question.explanation && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-500 mb-1.5">解析</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{question.explanation}</p>
                </div>
              )}

              {/* Copy to Doubao Button */}
              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={async () => {
                    const text = formatQuestionForAI(question)
                    const success = await copyToClipboard(text)
                    if (success) {
                      showToast('已复制题目，可粘贴到豆包查询解析')
                    } else {
                      showToast('复制失败，请重试', 'error')
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  <Copy size={16} />
                  一键复制，粘贴到豆包查解析
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Source & Date */}
        <div className="text-xs text-gray-400 px-1 space-y-1">
          {question.source && <p>来源：{question.source}</p>}
          <p>添加于 {new Date(question.created_at).toLocaleDateString('zh-CN')}</p>
          {question.wrong_count > 0 && <p className="text-orange-500">累计答错 {question.wrong_count} 次</p>}
        </div>
      </div>
    </div>
  )
}
