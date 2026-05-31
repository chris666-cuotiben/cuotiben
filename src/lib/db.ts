import Dexie, { type EntityTable } from 'dexie'
import type { Question } from '../types/question'
import type { Category } from '../types/category'
import type { PracticeSession, PracticeAnswer } from '../types/practice'

const db = new Dexie('cuotiben') as Dexie & {
  questions: EntityTable<Question, 'id'>
  categories: EntityTable<Category, 'id'>
  practiceSessions: EntityTable<PracticeSession, 'id'>
  practiceAnswers: EntityTable<PracticeAnswer, 'id'>
  syncQueue: EntityTable<{ id?: number; table: string; action: 'insert' | 'update' | 'delete'; data: unknown; timestamp: number }, 'id'>
}

db.version(1).stores({
  questions: 'id, category_id, status, difficulty, wrong_count, created_at, *tags',
  categories: 'id, parent_id, type, slug, sort_order',
  practiceSessions: 'id, mode, started_at, completed_at',
  practiceAnswers: 'id, session_id, question_id, answered_at',
  syncQueue: '++id, table, timestamp',
})

export { db }
