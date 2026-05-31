import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookOpen, PlusCircle, Brain, Settings } from 'lucide-react'

const tabs = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/questions', icon: BookOpen, label: '题库' },
  { path: '/add', icon: PlusCircle, label: '添加' },
  { path: '/practice', icon: Brain, label: '练习' },
  { path: '/settings', icon: Settings, label: '设置' },
]

export default function BottomTabBar() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = isActive(path)
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                active ? 'text-primary-500' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-xs ${active ? 'font-semibold' : 'font-normal'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
