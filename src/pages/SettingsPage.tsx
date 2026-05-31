import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderTree, Trash2, Download, Wifi, WifiOff,
  Info, ChevronRight, BookOpen, Key, Eye, EyeOff, ScanText
} from 'lucide-react'
import {
  getDashboardStats,
  getCategoryTree,
  getQuestions,
  getPracticeSessions,
} from '../lib/storage'
import { useUIStore } from '../stores/ui-store'
import { getOCRConfig, saveOCRConfig, isOCRConfigured } from '../lib/ocr-service'
import type { DashboardStats } from '../lib/storage'
import type { OCRConfig } from '../lib/ocr-service'

export default function SettingsPage() {
  const navigate = useNavigate()
  const isOnline = useUIStore((s) => s.isOnline)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [categoryCount, setCategoryCount] = useState(0)

  // OCR Config
  const [ocrConfig, setOcrConfig] = useState<OCRConfig>(getOCRConfig())
  const [showKey, setShowKey] = useState(false)
  const [showOCRConfig, setShowOCRConfig] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [s, cats] = await Promise.all([getDashboardStats(), getCategoryTree()])
    setStats(s)
    setCategoryCount(cats.length)
  }

  const handleExport = async () => {
    const [questions, categories, sessions] = await Promise.all([
      getQuestions(),
      getCategoryTree(),
      getPracticeSessions(100),
    ])
    const data = { questions, categories, sessions, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cuotiben-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearAll = async () => {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) return
    if (!confirm('再次确认：清除全部题目、分类和练习记录？')) return

    const { db } = await import('../lib/db')
    await db.questions.clear()
    await db.practiceSessions.clear()
    await db.practiceAnswers.clear()
    alert('数据已清除')
    loadData()
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-gray-900 pt-2 mb-2">设置</h1>

      {/* Network Status */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${isOnline ? 'bg-green-50' : 'bg-orange-50'}`}>
        {isOnline ? (
          <Wifi size={20} className="text-green-500" />
        ) : (
          <WifiOff size={20} className="text-orange-500" />
        )}
        <div>
          <p className={`text-sm font-medium ${isOnline ? 'text-green-700' : 'text-orange-700'}`}>
            {isOnline ? '在线' : '离线'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isOnline ? '所有功能可用' : '可在本地使用，联网后同步'}
          </p>
        </div>
      </div>

      {/* OCR Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowOCRConfig(!showOCRConfig)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <ScanText size={18} className={isOCRConfigured() ? 'text-green-500' : 'text-gray-400'} />
            <div className="text-left">
              <span className="text-sm text-gray-700">OCR 拍照识别</span>
              <p className="text-xs text-gray-400 mt-0.5">
                {isOCRConfigured() ? '已配置（腾讯云 OCR）' : '未配置'}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 transition-transform ${showOCRConfig ? 'rotate-180' : ''}`}>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </button>
        {showOCRConfig && (
          <div className="border-t border-gray-100 p-4 space-y-3 animate-fade-in">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">SecretId</label>
              <input
                type="text"
                value={ocrConfig.secretId}
                onChange={(e) => {
                  const updated = { ...ocrConfig, secretId: e.target.value }
                  setOcrConfig(updated)
                  saveOCRConfig(updated)
                }}
                placeholder="输入腾讯云 SecretId"
                className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 focus:outline-none focus:bg-gray-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">SecretKey</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={ocrConfig.secretKey}
                  onChange={(e) => {
                    const updated = { ...ocrConfig, secretKey: e.target.value }
                    setOcrConfig(updated)
                    saveOCRConfig(updated)
                  }}
                  placeholder="输入腾讯云 SecretKey"
                  className="w-full text-sm bg-gray-50 rounded-lg pl-3 pr-10 py-2.5 focus:outline-none focus:bg-gray-100"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-600 leading-relaxed">
                <span className="font-semibold">如何获取密钥？</span><br />
                1. 登录腾讯云控制台 → 访问管理 → API密钥管理<br />
                2. 创建密钥，获取 SecretId 和 SecretKey<br />
                3. 开通「通用印刷体识别」服务（每月 1000 次免费）<br />
                4. 密钥仅保存在本地浏览器中，不会上传
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Data Overview */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <BookOpen size={18} className="text-primary-500" />
            <span className="text-sm text-gray-700">总题目数</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{stats?.totalQuestions ?? 0}</span>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-[18px] h-[18px] rounded-full bg-orange-500" />
            <span className="text-sm text-gray-700">待复习</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{stats?.totalActive ?? 0}</span>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-[18px] h-[18px] rounded-full bg-green-500" />
            <span className="text-sm text-gray-700">已掌握</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{stats?.totalMastered ?? 0}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <button
          onClick={() => navigate('/settings/categories')}
          className="w-full flex items-center justify-between p-4 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <FolderTree size={18} className="text-gray-400" />
            <span className="text-sm text-gray-700">分类管理</span>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>

        <button
          onClick={handleExport}
          className="w-full flex items-center justify-between p-4 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Download size={18} className="text-gray-400" />
            <span className="text-sm text-gray-700">导出数据</span>
          </div>
          <span className="text-xs text-gray-400">JSON 备份</span>
        </button>

        <button
          onClick={handleClearAll}
          className="w-full flex items-center justify-between p-4 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Trash2 size={18} className="text-red-400" />
            <span className="text-sm text-red-500">清除所有数据</span>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      </div>

      {/* About */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <Info size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">关于</span>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <p>错题本 v1.0.0</p>
          <p>公务员考试错题记录与练习工具</p>
          <p>数据存储于本地 IndexedDB</p>
        </div>
      </div>
    </div>
  )
}
