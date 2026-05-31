import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Brain, CheckCircle, XCircle, RotateCcw, Zap,
  BookOpen, Star, Trophy, ThumbsUp, ThumbsDown, Copy
} from 'lucide-react'
import {
  getQuestions, getCategories, createPracticeSession,
  completePracticeSession, savePracticeAnswer, updateQuestionStatus,
} from '../lib/storage'
import { formatQuestionQuick, copyToClipboard } from '../lib/clipboard'
import { useToast } from '../components/ui/Toast'
import type { Question } from '../types/question'
import type { Category } from '../types/category'
import type { PracticeMode, PracticeStep } from '../types/practice'

export default function PracticePage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [step, setStep] = useState<PracticeStep>('setup')

  // Setup state
  const [mode, setMode] = useState<PracticeMode>('random')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(10)
  const [categories, setCategories] = useState<Category[]>([])
  const [availableCount, setAvailableCount] = useState(0)

  // Session state
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [results, setResults] = useState<{ questionId: string; isCorrect: boolean; timeMs: number }[]>([])
  const [startTime, setStartTime] = useState<number>(0)
  const [questionStartTime, setQuestionStartTime] = useState<number>(0)
  const [sessionId, setSessionId] = useState<string>('')

  useEffect(() => {
    loadSetup()
  }, [])

  const loadSetup = async () => {
    const cats = await getCategories()
    const allActive = await getQuestions({ status: 'active' })
    setCategories(cats)
    setAvailableCount(allActive.length)
  }

  const handleStart = useCallback(async () => {
    let pool = await getQuestions({ status: 'active' })

    if (mode === 'category' && selectedCategories.length > 0) {
      pool = pool.filter((q) => selectedCategories.includes(q.category_id))
    }

    if (mode === 'weakest') {
      pool.sort((a, b) => b.wrong_count - a.wrong_count)
    } else if (mode === 'difficulty') {
      pool.sort((a, b) => b.difficulty - a.difficulty)
    } else {
      // random
      pool = pool.sort(() => Math.random() - 0.5)
    }

    const selected = pool.slice(0, questionCount)
    if (selected.length === 0) {
      alert('没有可练习的题目，请先添加错题！')
      return
    }

    const session = await createPracticeSession({
      mode,
      category_ids: selectedCategories,
      count: selected.length,
    })

    setQuestions(selected)
    setCurrentIndex(0)
    setResults([])
    setShowAnswer(false)
    setSessionId(session.id)
    setStartTime(Date.now())
    setQuestionStartTime(Date.now())
    setStep('session')
  }, [mode, selectedCategories, questionCount])

  const currentQuestion = questions[currentIndex]
  const isLast = currentIndex >= questions.length - 1

  const handleAnswer = async (isCorrect: boolean) => {
    const timeMs = Date.now() - questionStartTime
    const newResult = { questionId: currentQuestion.id, isCorrect, timeMs }
    const newResults = [...results, newResult]
    setResults(newResults)

    await savePracticeAnswer({
      id: crypto.randomUUID(),
      session_id: sessionId,
      question_id: currentQuestion.id,
      user_answer: isCorrect ? 'CORRECT' : 'WRONG',
      is_correct: isCorrect,
      time_spent_ms: timeMs,
      answered_at: new Date().toISOString(),
    })

    if (isCorrect) {
      // If user got it right, optionally mark as mastered after enough correct answers
      await updateQuestionStatus(currentQuestion.id, 'mastered')
    }

    if (isLast) {
      // Complete session
      const correct = newResults.filter((r) => r.isCorrect).length
      const wrong = newResults.filter((r) => !r.isCorrect).length
      const mastered = newResults.filter((r) => r.isCorrect).length
      await completePracticeSession(sessionId, correct, wrong, mastered)
      setStep('result')
      return
    }

    setShowAnswer(false)
    setCurrentIndex(currentIndex + 1)
    setQuestionStartTime(Date.now())
  }

  const handleRestart = () => {
    setStep('setup')
    setQuestions([])
    setResults([])
    setShowAnswer(false)
    setCurrentIndex(0)
  }

  const parentCategories = categories.filter((c) => !c.parent_id)
  const getChildren = (parentId: string) => categories.filter((c) => c.parent_id === parentId)

  // SETUP SCREEN
  if (step === 'setup') {
    return (
      <div className="min-h-full bg-gray-50 animate-fade-in">
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 safe-area-top">
          <div className="flex items-center px-4 h-14">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600">
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-medium text-gray-700 ml-2">练习设置</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode Selection */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">练习模式</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'random' as PracticeMode, icon: Zap, label: '随机刷题', desc: '随机抽取题目' },
                { value: 'category' as PracticeMode, icon: BookOpen, label: '按分类刷', desc: '选择特定分类' },
                { value: 'difficulty' as PracticeMode, icon: Star, label: '按难度刷', desc: '从难到易' },
                { value: 'weakest' as PracticeMode, icon: Brain, label: '薄弱项优先', desc: '错最多的优先' },
              ].map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors text-left ${
                    mode === value
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} className={mode === value ? 'text-primary-500' : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${mode === value ? 'text-primary-600' : 'text-gray-700'}`}>
                    {label}
                  </span>
                  <span className="text-xs text-gray-400">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection (only for category mode) */}
          {mode === 'category' && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 animate-fade-in">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">选择分类</h3>
              <div className="space-y-3">
                {parentCategories.map((parent) => (
                  <div key={parent.id}>
                    <p className="text-xs font-semibold text-gray-400 mb-1.5">{parent.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getChildren(parent.id).map((child) => (
                        <button
                          key={child.id}
                          onClick={() => {
                            setSelectedCategories((prev) =>
                              prev.includes(child.id)
                                ? prev.filter((c) => c !== child.id)
                                : [...prev, child.id]
                            )
                          }}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            selectedCategories.includes(child.id)
                              ? 'text-white font-medium'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                          style={{
                            backgroundColor: selectedCategories.includes(child.id)
                              ? child.color
                              : undefined,
                          }}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Count */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              题目数量：<span className="text-primary-500">{questionCount}</span> 题
            </h3>
            <input
              type="range"
              min={5}
              max={Math.min(50, availableCount)}
              step={5}
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5</span>
              <span>{Math.min(50, availableCount)}</span>
            </div>
          </div>

          {/* Available */}
          <p className="text-center text-sm text-gray-400">
            题库共有 <span className="text-primary-500 font-semibold">{availableCount}</span> 道待复习题目
          </p>

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={availableCount === 0}
            className="w-full py-4 bg-primary-500 text-white rounded-xl font-bold text-base disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Brain size={20} />
            开始练习
          </button>
        </div>
      </div>
    )
  }

  // SESSION SCREEN
  if (step === 'session' && currentQuestion) {
    const hasOptions = currentQuestion.option_a || currentQuestion.option_b || currentQuestion.option_c || currentQuestion.option_d
    const progress = ((currentIndex + 1) / questions.length) * 100

    return (
      <div className="min-h-full bg-gray-50 flex flex-col animate-fade-in">
        {/* Progress Bar */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 safe-area-top">
          <div className="flex items-center justify-between px-4 h-14">
            <button onClick={handleRestart} className="p-2 -ml-2 text-gray-600">
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-medium text-gray-600">
              {currentIndex + 1} / {questions.length}
            </span>
            <div className="w-8" />
          </div>
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="flex-1 p-4 flex flex-col">
          <div className={`flip-card flex-1 ${showAnswer ? 'flipped' : ''}`}>
            <div className="flip-card-inner relative w-full h-full">
              {/* Front: Question */}
              <div className="flip-card-front absolute inset-0 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col overflow-y-auto">
                <div className="flex-1">
                  <p className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap mb-4">
                    {currentQuestion.question_text}
                  </p>
                  {hasOptions && (
                    <div className="space-y-2.5">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const text = currentQuestion[`option_${opt.toLowerCase()}` as keyof Question] as string | null
                        if (!text) return null
                        return (
                          <div
                            key={opt}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50"
                          >
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                              {opt}
                            </span>
                            <span className="text-sm text-gray-800">{text}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-3.5 bg-primary-500 text-white rounded-xl font-medium mt-4 active:scale-[0.98] transition-transform"
                >
                  查看答案
                </button>
              </div>

              {/* Back: Answer */}
              <div className="flip-card-back absolute inset-0 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col overflow-y-auto">
                <div className="flex-1 space-y-4">
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs text-green-600 font-medium mb-1">正确答案</p>
                    <p className="text-xl font-bold text-green-700">{currentQuestion.correct_answer}</p>
                  </div>
                  {currentQuestion.user_answer && currentQuestion.user_answer !== currentQuestion.correct_answer && (
                    <div className="bg-red-50 rounded-xl p-4">
                      <p className="text-xs text-red-600 font-medium mb-1">你的答案</p>
                      <p className="text-lg font-bold text-red-500 line-through">{currentQuestion.user_answer}</p>
                    </div>
                  )}
                  {currentQuestion.explanation && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">解析</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{currentQuestion.explanation}</p>
                    </div>
                  )}

                  {/* Copy to Doubao Button */}
                  <button
                    onClick={async () => {
                      const text = formatQuestionQuick(currentQuestion)
                      const success = await copyToClipboard(text)
                      if (success) {
                        showToast('已复制，可粘贴到豆包查询解析')
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium active:scale-[0.98] transition-transform"
                  >
                    <Copy size={14} />
                    复制题目到豆包查解析
                  </button>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleAnswer(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-red-50 text-red-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
                  >
                    <ThumbsDown size={18} />
                    还是不会
                  </button>
                  <button
                    onClick={() => handleAnswer(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-500 text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
                  >
                    <ThumbsUp size={18} />
                    已经会了
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // RESULT SCREEN
  if (step === 'result') {
    const correct = results.filter((r) => r.isCorrect).length
    const wrong = results.filter((r) => !r.isCorrect).length
    const total = results.length
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    const totalTime = results.reduce((sum, r) => sum + r.timeMs, 0)
    const avgTime = total > 0 ? Math.round(totalTime / total / 1000) : 0

    return (
      <div className="min-h-full bg-gray-50 animate-fade-in">
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 safe-area-top">
          <div className="flex items-center px-4 h-14">
            <span className="text-sm font-medium text-gray-700">练习结果</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Score Circle */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-primary-50 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-600">{accuracy}%</p>
                <p className="text-xs text-primary-400">正确率</p>
              </div>
            </div>
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <div className="flex items-center gap-1.5 text-green-600 mb-1">
                  <CheckCircle size={16} />
                  <span className="text-lg font-bold">{correct}</span>
                </div>
                <p className="text-xs text-gray-400">正确</p>
              </div>
              {wrong > 0 && (
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-red-500 mb-1">
                    <XCircle size={16} />
                    <span className="text-lg font-bold">{wrong}</span>
                  </div>
                  <p className="text-xs text-gray-400">错误</p>
                </div>
              )}
              <div className="text-center">
                <div className="flex items-center gap-1.5 text-gray-600 mb-1">
                  <Trophy size={16} />
                  <span className="text-lg font-bold">{correct}</span>
                </div>
                <p className="text-xs text-gray-400">已掌握</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              总用时 {Math.round(totalTime / 1000)}秒 · 平均每题 {avgTime}秒
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRestart}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary-500 text-white rounded-xl font-bold active:scale-[0.98] transition-transform"
            >
              <RotateCcw size={18} />
              再来一组
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 text-gray-500 font-medium text-sm"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
