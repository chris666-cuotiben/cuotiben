import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import QuestionListPage from './pages/QuestionListPage'
import QuestionDetailPage from './pages/QuestionDetailPage'
import AddQuestionPage from './pages/AddQuestionPage'
import PracticePage from './pages/PracticePage'
import SettingsPage from './pages/SettingsPage'
import { ToastProvider } from './components/ui/Toast'
import { seedCategories } from './lib/storage'
import { useUIStore } from './stores/ui-store'

export default function App() {
  const setOnline = useUIStore((s) => s.setOnline)

  useEffect(() => {
    seedCategories()

    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  return (
    <ToastProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/questions" element={<QuestionListPage />} />
          <Route path="/questions/:id" element={<QuestionDetailPage />} />
          <Route path="/add" element={<AddQuestionPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  )
}
