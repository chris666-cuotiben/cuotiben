export type PracticeMode = 'random' | 'category' | 'difficulty' | 'weakest'

export interface PracticeSession {
  id: string
  mode: PracticeMode
  filter_params: Record<string, unknown> | null
  total_questions: number
  correct_count: number
  wrong_count: number
  mastered_count: number
  started_at: string
  completed_at: string | null
}

export interface PracticeAnswer {
  id: string
  session_id: string
  question_id: string
  user_answer: string | null
  is_correct: boolean | null
  time_spent_ms: number | null
  answered_at: string
}

export interface PracticeConfig {
  mode: PracticeMode
  category_ids?: string[]
  difficulty?: number
  count: number
}

export type PracticeStep = 'setup' | 'session' | 'result'
