import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Filter, ChevronRight, Trash2, Eye, EyeOff } from 'lucide-react'
import { getQuestions, getCategories, updateQuestionStatus, deleteQuestion } from '../lib/storage'
import type { Question, QuestionFilter, QuestionStatus } from '../types/question'
import type { Category } from '../types/category'

export default function QuestionListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [questions, setQuestions] = useState<Question[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | ''>('active')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [swipedId, setSwipedId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    const cat = searchParams.get('category')
    if (cat) setCategoryFilter(cat)
  }, [searchParams])

  const loadData = async () => {
    const [qs, cats] = await Promise.all([getQuestions(), getCategories()])
    setQuestions(qs)
    setCategories(cats)
  }

  const filtered = questions.filter((q) => {
    if (statusFilter && q.status !== statusFilter) return false
    if (categoryFilter && q.category_id !== categoryFilter) return false
    if (search) {
      const s = search.toLowerCase()
      const text = `${q.question_text} ${q.source ?? ''}`.toLowerCase()
      if (!text.includes(s)) return false
    }
    return true
  })

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '未分类'

  const statusBadge = (status: QuestionStatus) => {
    switch (status) {
      case 'active':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">待复习</span>
      case 'mastered':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">已掌握</span>
      case 'archived':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">已归档</span>
    }
  }

  const handleToggleStatus = async (q: Question) => {
    const newStatus: QuestionStatus = q.status === 'active' ? 'mastered' : 'active'
    await updateQuestionStatus(q.id, newStatus)
    setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, status: newStatus } : item)))
    setSwipedId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这道题吗？')) return
    await deleteQuestion(id)
    setQuestions((prev) => prev.filter((item) => item.id !== id))
    setSwipedId(null)
  }

  return (
    <div className="p-4 animate-fade-in">
      <h1 className="text-xl font-bold text-gray-900 mb-4 pt-2">题库</h1>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索题目、来源..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-300"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${showFilters ? 'bg-primary-50 text-primary-500' : 'text-gray-400'}`}
        >
          <Filter size={18} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl p-3 mb-3 space-y-3 animate-fade-in border border-gray-200">
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">状态</label>
            <div className="flex gap-2">
              {[
                { value: '', label: '全部' },
                { value: 'active', label: '待复习' },
                { value: 'mastered', label: '已掌握' },
                { value: 'archived', label: '已归档' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value as QuestionStatus | '')}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilter === value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">分类</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-sm bg-gray-100 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="">全部分类</option>
              {categories.filter((c) => !c.parent_id).map((cat) => (
                <optgroup key={cat.id} label={cat.name}>
                  {categories.filter((c) => c.parent_id === cat.id).map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Question List */}
      <div className="space-y-2">
        {filtered.map((q) => (
          <div
            key={q.id}
            className="bg-white rounded-xl overflow-hidden"
          >
            <div
              className="flex items-center p-4 active:bg-gray-50"
              onClick={() => navigate(`/questions/${q.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {statusBadge(q.status)}
                  <span className="text-xs text-gray-400">{getCategoryName(q.category_id)}</span>
                </div>
                <p className="text-sm text-gray-800 line-clamp-2">{q.question_text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {q.source && <span className="text-xs text-gray-400">来源：{q.source}</span>}
                  {q.wrong_count > 1 && (
                    <span className="text-xs text-danger-500">错过 {q.wrong_count} 次</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(q) }}
                  className="p-2 text-gray-400 hover:text-green-500 active:scale-90 transition-all"
                  title={q.status === 'active' ? '标记为已掌握' : '标记为待复习'}
                >
                  {q.status === 'active' ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(q.id) }}
                  className="p-2 text-gray-400 hover:text-red-500 active:scale-90 transition-all"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">没有找到匹配的题目</p>
        </div>
      )}
    </div>
  )
}
