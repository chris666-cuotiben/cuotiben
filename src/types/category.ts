export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  type: '行测' | '申论' | '面试' | 'custom'
  sort_order: number
  color: string
  icon: string
  created_at: string
  updated_at: string
  children?: Category[]
  question_count?: number
}
