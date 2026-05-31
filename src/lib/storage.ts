import { db } from './db'
import type { Question, QuestionFilter, QuestionStatus } from '../types/question'
import type { Category } from '../types/category'
import type { PracticeSession, PracticeAnswer, PracticeConfig, PracticeMode } from '../types/practice'

// ===========================
// Categories
// ===========================
export async function getCategories(): Promise<Category[]> {
  return db.categories.orderBy('sort_order').toArray()
}

export async function getCategoryTree(): Promise<Category[]> {
  const all = await getCategories()
  return buildTree(all)
}

function buildTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>()
  const roots: Category[] = []

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] })
  }

  for (const cat of map.values()) {
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children!.push(cat)
    } else if (!cat.parent_id) {
      roots.push(cat)
    }
  }

  return roots
}

export async function saveCategory(category: Category): Promise<void> {
  await db.categories.put(category)
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id)
}

// ===========================
// Questions
// ===========================
export async function getQuestions(filter?: QuestionFilter): Promise<Question[]> {
  let collection = db.questions.orderBy('created_at')

  const results = await collection.reverse().toArray()

  return results.filter((q) => {
    if (filter?.status && q.status !== filter.status) return false
    if (filter?.category_id && q.category_id !== filter.category_id) return false
    if (filter?.difficulty && q.difficulty !== filter.difficulty) return false
    if (filter?.search) {
      const search = filter.search.toLowerCase()
      const text = `${q.question_text} ${q.option_a ?? ''} ${q.option_b ?? ''} ${q.option_c ?? ''} ${q.option_d ?? ''}`.toLowerCase()
      if (!text.includes(search)) return false
    }
    return true
  })
}

export async function getQuestion(id: string): Promise<Question | undefined> {
  return db.questions.get(id)
}

export async function saveQuestion(question: Question): Promise<void> {
  question.updated_at = new Date().toISOString()
  if (!question.created_at) {
    question.created_at = new Date().toISOString()
  }
  await db.questions.put(question)
}

export async function updateQuestionStatus(id: string, status: QuestionStatus): Promise<void> {
  const updates: Partial<Question> = { status, updated_at: new Date().toISOString() }
  if (status === 'mastered') {
    updates.mastered_at = new Date().toISOString()
  }
  await db.questions.update(id, updates)
}

export async function deleteQuestion(id: string): Promise<void> {
  await db.questions.delete(id)
}

export async function getQuestionCountByCategory(): Promise<Record<string, number>> {
  const questions = await db.questions.where('status').equals('active').toArray()
  const counts: Record<string, number> = {}
  for (const q of questions) {
    counts[q.category_id] = (counts[q.category_id] || 0) + 1
  }
  return counts
}

export async function getTotalActiveQuestions(): Promise<number> {
  return db.questions.where('status').equals('active').count()
}

export async function getTotalMasteredQuestions(): Promise<number> {
  return db.questions.where('status').equals('mastered').count()
}

// ===========================
// Practice Sessions
// ===========================
export async function createPracticeSession(config: PracticeConfig): Promise<PracticeSession> {
  const session: PracticeSession = {
    id: crypto.randomUUID(),
    mode: config.mode,
    filter_params: config as unknown as Record<string, unknown>,
    total_questions: config.count,
    correct_count: 0,
    wrong_count: 0,
    mastered_count: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
  }
  await db.practiceSessions.put(session)
  return session
}

export async function completePracticeSession(id: string, correct: number, wrong: number, mastered: number): Promise<void> {
  await db.practiceSessions.update(id, {
    correct_count: correct,
    wrong_count: wrong,
    mastered_count: mastered,
    completed_at: new Date().toISOString(),
  })
}

export async function getPracticeSessions(limit = 20): Promise<PracticeSession[]> {
  return db.practiceSessions
    .orderBy('started_at')
    .reverse()
    .limit(limit)
    .toArray()
}

export async function savePracticeAnswer(answer: PracticeAnswer): Promise<void> {
  await db.practiceAnswers.put(answer)
}

export async function getPracticeAnswers(sessionId: string): Promise<PracticeAnswer[]> {
  return db.practiceAnswers.where('session_id').equals(sessionId).toArray()
}

// ===========================
// Dashboard Stats
// ===========================
export interface DashboardStats {
  totalActive: number
  totalMastered: number
  totalQuestions: number
  todayAdded: number
  todayPracticed: number
  accuracyRate: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [active, mastered, allQuestions, sessions] = await Promise.all([
    db.questions.where('status').equals('active').count(),
    db.questions.where('status').equals('mastered').count(),
    db.questions.count(),
    getPracticeSessions(50),
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  const allQ = await db.questions.toArray()
  const todayAdded = allQ.filter((q) => q.created_at >= todayStr).length

  const completedSessions = sessions.filter((s) => s.completed_at)
  const totalAnswered = completedSessions.reduce((sum, s) => sum + s.correct_count + s.wrong_count, 0)
  const totalCorrect = completedSessions.reduce((sum, s) => sum + s.correct_count, 0)

  const todaySessions = completedSessions.filter((s) => s.completed_at! >= todayStr)
  const todayPracticed = todaySessions.reduce((sum, s) => sum + s.correct_count + s.wrong_count, 0)

  return {
    totalActive: active,
    totalMastered: mastered,
    totalQuestions: allQuestions,
    todayAdded,
    todayPracticed,
    accuracyRate: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
  }
}

// ===========================
// Seed Data
// ===========================
export async function seedCategories(): Promise<void> {
  const existing = await db.categories.count()
  if (existing > 0) return

  const categories: Category[] = [
    { id: 'xingce', name: '行测', slug: 'xingce', parent_id: null, type: '行测', sort_order: 1, color: '#6366f1', icon: 'target', created_at: now(), updated_at: now() },
    { id: 'shenlun', name: '申论', slug: 'shenlun', parent_id: null, type: '申论', sort_order: 2, color: '#f59e0b', icon: 'file-text', created_at: now(), updated_at: now() },

    // 行测 subcategories
    { id: 'changshi', name: '常识判断', slug: 'common-knowledge', parent_id: 'xingce', type: '行测', sort_order: 1, color: '#8b5cf6', icon: 'lightbulb', created_at: now(), updated_at: now() },
    { id: 'yanyu', name: '言语理解与表达', slug: 'verbal', parent_id: 'xingce', type: '行测', sort_order: 2, color: '#06b6d4', icon: 'message-square', created_at: now(), updated_at: now() },
    { id: 'shuliang', name: '数量关系', slug: 'quantitative', parent_id: 'xingce', type: '行测', sort_order: 3, color: '#10b981', icon: 'calculator', created_at: now(), updated_at: now() },
    { id: 'panduan', name: '判断推理', slug: 'reasoning', parent_id: 'xingce', type: '行测', sort_order: 4, color: '#f43f5e', icon: 'brain', created_at: now(), updated_at: now() },
    { id: 'ziliao', name: '资料分析', slug: 'data-analysis', parent_id: 'xingce', type: '行测', sort_order: 5, color: '#f97316', icon: 'bar-chart', created_at: now(), updated_at: now() },

    // 常识判断 children
    { id: 'changshi-zz', name: '政治常识', slug: 'politics', parent_id: 'changshi', type: '行测', sort_order: 1, color: '#a78bfa', icon: 'landmark', created_at: now(), updated_at: now() },
    { id: 'changshi-jj', name: '经济常识', slug: 'economics', parent_id: 'changshi', type: '行测', sort_order: 2, color: '#a78bfa', icon: 'trending-up', created_at: now(), updated_at: now() },
    { id: 'changshi-fl', name: '法律常识', slug: 'law', parent_id: 'changshi', type: '行测', sort_order: 3, color: '#a78bfa', icon: 'scale', created_at: now(), updated_at: now() },
    { id: 'changshi-ls', name: '历史常识', slug: 'history', parent_id: 'changshi', type: '行测', sort_order: 4, color: '#a78bfa', icon: 'clock', created_at: now(), updated_at: now() },
    { id: 'changshi-kj', name: '科技常识', slug: 'technology', parent_id: 'changshi', type: '行测', sort_order: 5, color: '#a78bfa', icon: 'cpu', created_at: now(), updated_at: now() },

    // 言语理解 children
    { id: 'yanyu-ljtk', name: '逻辑填空', slug: 'logic-fill', parent_id: 'yanyu', type: '行测', sort_order: 1, color: '#22d3ee', icon: 'type', created_at: now(), updated_at: now() },
    { id: 'yanyu-pdyd', name: '片段阅读', slug: 'passage-reading', parent_id: 'yanyu', type: '行测', sort_order: 2, color: '#22d3ee', icon: 'book-open', created_at: now(), updated_at: now() },
    { id: 'yanyu-yjbd', name: '语句表达', slug: 'sentence-expression', parent_id: 'yanyu', type: '行测', sort_order: 3, color: '#22d3ee', icon: 'align-left', created_at: now(), updated_at: now() },

    // 数量关系 children
    { id: 'shuliang-sxys', name: '数学运算', slug: 'math-calc', parent_id: 'shuliang', type: '行测', sort_order: 1, color: '#34d399', icon: 'divide', created_at: now(), updated_at: now() },
    { id: 'shuliang-sztl', name: '数字推理', slug: 'number-reasoning', parent_id: 'shuliang', type: '行测', sort_order: 2, color: '#34d399', icon: 'hash', created_at: now(), updated_at: now() },

    // 判断推理 children
    { id: 'panduan-txtl', name: '图形推理', slug: 'figure-reasoning', parent_id: 'panduan', type: '行测', sort_order: 1, color: '#fb7185', icon: 'shapes', created_at: now(), updated_at: now() },
    { id: 'panduan-dypd', name: '定义判断', slug: 'definition-judgment', parent_id: 'panduan', type: '行测', sort_order: 2, color: '#fb7185', icon: 'bookmark', created_at: now(), updated_at: now() },
    { id: 'panduan-lbtl', name: '类比推理', slug: 'analogy', parent_id: 'panduan', type: '行测', sort_order: 3, color: '#fb7185', icon: 'git-compare', created_at: now(), updated_at: now() },
    { id: 'panduan-ljpd', name: '逻辑判断', slug: 'logic-judgment', parent_id: 'panduan', type: '行测', sort_order: 4, color: '#fb7185', icon: 'workflow', created_at: now(), updated_at: now() },

    // 资料分析 children
    { id: 'ziliao-wzcl', name: '文字材料', slug: 'text-material', parent_id: 'ziliao', type: '行测', sort_order: 1, color: '#fb923c', icon: 'file-text', created_at: now(), updated_at: now() },
    { id: 'ziliao-bgcl', name: '表格材料', slug: 'table-material', parent_id: 'ziliao', type: '行测', sort_order: 2, color: '#fb923c', icon: 'table', created_at: now(), updated_at: now() },
    { id: 'ziliao-tbcl', name: '图表材料', slug: 'chart-material', parent_id: 'ziliao', type: '行测', sort_order: 3, color: '#fb923c', icon: 'pie-chart', created_at: now(), updated_at: now() },

    // 申论 subcategories
    { id: 'shenlun-gkgn', name: '概括归纳题', slug: 'summary', parent_id: 'shenlun', type: '申论', sort_order: 1, color: '#fbbf24', icon: 'list', created_at: now(), updated_at: now() },
    { id: 'shenlun-zhfx', name: '综合分析题', slug: 'comprehensive', parent_id: 'shenlun', type: '申论', sort_order: 2, color: '#fbbf24', icon: 'search', created_at: now(), updated_at: now() },
    { id: 'shenlun-tcdc', name: '提出对策题', slug: 'proposal', parent_id: 'shenlun', type: '申论', sort_order: 3, color: '#fbbf24', icon: 'lightbulb', created_at: now(), updated_at: now() },
    { id: 'shenlun-gczx', name: '贯彻执行题', slug: 'implementation', parent_id: 'shenlun', type: '申论', sort_order: 4, color: '#fbbf24', icon: 'clipboard-check', created_at: now(), updated_at: now() },
    { id: 'shenlun-wzxz', name: '文章写作', slug: 'essay-writing', parent_id: 'shenlun', type: '申论', sort_order: 5, color: '#fbbf24', icon: 'pen-tool', created_at: now(), updated_at: now() },
  ]

  await db.categories.bulkPut(categories)
}

function now(): string {
  return new Date().toISOString()
}
