import type { Question } from '../types/question'

/**
 * Format a question for pasting into Doubao (豆包) or other AI assistants.
 * Produces a clean, structured format optimized for answer lookup.
 */
export function formatQuestionForAI(question: Question): string {
  const parts: string[] = []

  parts.push('请帮我解析以下公务员考试题目：')
  parts.push('')
  parts.push(`【题目】${question.question_text}`)

  // Options
  if (question.option_a || question.option_b || question.option_c || question.option_d) {
    const opts: string[] = []
    if (question.option_a) opts.push(`A. ${question.option_a}`)
    if (question.option_b) opts.push(`B. ${question.option_b}`)
    if (question.option_c) opts.push(`C. ${question.option_c}`)
    if (question.option_d) opts.push(`D. ${question.option_d}`)
    if (opts.length > 0) {
      parts.push(`【选项】${opts.join('；')}`)
    }
  }

  // Correct answer
  if (question.correct_answer) {
    parts.push(`【正确答案】${question.correct_answer}`)
  }

  // User's wrong answer
  if (question.user_answer && question.user_answer !== question.correct_answer) {
    parts.push(`【我的答案】${question.user_answer}`)
  }

  // Explanation (if exists)
  if (question.explanation) {
    parts.push(`【已有解析】${question.explanation}`)
  }

  parts.push('')
  parts.push('请详细解析这道题的解题思路和每个选项的分析。')

  return parts.join('\n')
}

/**
 * Format just the question text for quick copy
 */
export function formatQuestionQuick(question: Question): string {
  const parts: string[] = [question.question_text]

  if (question.option_a) parts.push(`A. ${question.option_a}`)
  if (question.option_b) parts.push(`B. ${question.option_b}`)
  if (question.option_c) parts.push(`C. ${question.option_c}`)
  if (question.option_d) parts.push(`D. ${question.option_d}`)

  return parts.join('\n')
}

/**
 * Copy text to clipboard with toast feedback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}
