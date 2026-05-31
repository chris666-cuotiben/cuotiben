export interface Question {
  id: string
  category_id: string
  question_text: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_answer: string
  user_answer: string | null
  explanation: string | null
  source: string | null
  original_image_urls: string[]
  ocr_processed: boolean
  status: 'active' | 'mastered' | 'archived'
  difficulty: number
  tags: string[]
  wrong_count: number
  mastered_at: string | null
  created_at: string
  updated_at: string
  categories?: {
    name: string
    color: string
    type: string
  }
}

export type QuestionStatus = 'active' | 'mastered' | 'archived'

export interface QuestionFilter {
  search?: string
  category_id?: string
  status?: QuestionStatus
  difficulty?: number
  source?: string
  sort?: 'created_at' | 'difficulty' | 'wrong_count'
  order?: 'asc' | 'desc'
}
