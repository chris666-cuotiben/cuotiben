import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, BookOpen, Target, Award, Brain, Plus } from 'lucide-react'
import { getDashboardStats, getCategoryTree, getQuestionCountByCategory, type DashboardStats } from '../lib/storage'
import type { Category } from '../types/category'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [countsByCategory, setCountsByCategory] = useState<Record<string, number>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [s, tree, counts] = await Promise.all([
      getDashboardStats(),
      getCategoryTree(),
      getQuestionCountByCategory(),
    ])
    setStats(s)
    setCategories(tree)
    setCountsByCategory(counts)
  }

  const getCategoryCount = (cat: Category): number => {
    let count = countsByCategory[cat.id] || 0
    if (cat.children) {
      for (const child of cat.children) {
        count += getCategoryCount(child)
      }
    }
    return count
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-900">错题本</h1>
        <span className="text-sm text-gray-500">公务员考试</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={BookOpen}
          label="待复习"
          value={stats.totalActive}
          color="text-orange-500"
          bg="bg-orange-50"
        />
        <SummaryCard
          icon={Award}
          label="已掌握"
          value={stats.totalMastered}
          color="text-green-500"
          bg="bg-green-50"
        />
        <SummaryCard
          icon={Target}
          label="正确率"
          value={`${stats.accuracyRate}%`}
          color="text-blue-500"
          bg="bg-blue-50"
        />
        <SummaryCard
          icon={TrendingUp}
          label="今日练习"
          value={stats.todayPracticed}
          color="text-purple-500"
          bg="bg-purple-50"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/add')}
          className="flex-1 flex items-center justify-center gap-2 bg-primary-500 text-white py-3 rounded-xl font-medium active:scale-95 transition-transform"
        >
          <Plus size={18} />
          添加错题
        </button>
        <button
          onClick={() => navigate('/practice')}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl font-medium active:scale-95 transition-transform"
        >
          <Brain size={18} />
          开始练习
        </button>
      </div>

      {/* Category Breakdown */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">分类统计</h2>
        <div className="space-y-2">
          {categories.map((cat) => {
            const count = getCategoryCount(cat)
            const total = stats.totalActive || 1
            const pct = Math.round((count / total) * 100)
            if (count === 0 && cat.type !== '行测' && cat.type !== '申论') return null
            return (
              <div
                key={cat.id}
                onClick={() => navigate(`/questions?category=${cat.id}`)}
                className="bg-white rounded-xl p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                  <span className="text-sm text-gray-500">{count} 题</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {stats.totalQuestions === 0 && (
        <div className="text-center py-8">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-3">还没有错题记录</p>
          <button
            onClick={() => navigate('/add')}
            className="text-primary-500 font-medium text-sm"
          >
            添加第一道错题 →
          </button>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof BookOpen
  label: string
  value: string | number
  color: string
  bg: string
}) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <Icon size={20} className={`${color} mb-2`} />
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
