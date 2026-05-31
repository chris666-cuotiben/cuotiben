// Tencent Cloud OCR API client
// Uses TC3-HMAC-SHA256 signing via Web Crypto API

const SECRET_ID_KEY = 'cuotiben_ocr_secret_id'
const SECRET_KEY_KEY = 'cuotiben_ocr_secret_key'
const OCR_PROVIDER_KEY = 'cuotiben_ocr_provider'

export type OCRProvider = 'tesseract' | 'tencent' | 'manual'

export interface OCRConfig {
  provider: OCRProvider
  secretId: string
  secretKey: string
}

export interface OCRTextBlock {
  text: string
  confidence: number
  polygon: { x: number; y: number }[]
}

export interface OCRResult {
  textBlocks: OCRTextBlock[]
  fullText: string
  parsed: ParsedQuestion | null
}

export interface ParsedQuestion {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: string
  explanation: string
  confidence: number
}

// ===========================
// Config Management
// ===========================
export function getOCRConfig(): OCRConfig {
  return {
    provider: (localStorage.getItem(OCR_PROVIDER_KEY) as OCRProvider) || 'tesseract',
    secretId: localStorage.getItem(SECRET_ID_KEY) || '',
    secretKey: localStorage.getItem(SECRET_KEY_KEY) || '',
  }
}

export function saveOCRConfig(config: OCRConfig): void {
  localStorage.setItem(OCR_PROVIDER_KEY, config.provider)
  localStorage.setItem(SECRET_ID_KEY, config.secretId)
  localStorage.setItem(SECRET_KEY_KEY, config.secretKey)
}

export function isOCRConfigured(): boolean {
  const config = getOCRConfig()
  // Tesseract is always available (free, no API key needed)
  if (config.provider === 'tesseract') return true
  // Tencent requires API keys
  if (config.provider === 'tencent') {
    return config.secretId.length > 0 && config.secretKey.length > 0
  }
  return false
}

// ===========================
// Image Helpers
// ===========================
export async function imageFileToBase64(file: File): Promise<string> {
  // First, compress the image for faster upload
  const compressed = await compressImage(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:image/...;base64, prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(compressed)
  })
}

async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to compress image'))
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// ===========================
// TC3-HMAC-SHA256 Signing
// ===========================
async function sha256(message: string | ArrayBuffer): Promise<string> {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawKey: ArrayBuffer = (key instanceof Uint8Array ? key.buffer : key) as ArrayBuffer
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const data = new TextEncoder().encode(message)
  return crypto.subtle.sign('HMAC', cryptoKey, data)
}

async function tc3Sign(secretKey: string, date: string, service: string, stringToSign: string): Promise<string> {
  const kDate = await hmacSha256(new TextEncoder().encode('TC3' + secretKey), date)
  const kService = await hmacSha256(kDate, service)
  const kSigning = await hmacSha256(kService, 'tc3_request')
  const signature = await hmacSha256(kSigning, stringToSign)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ===========================
// OCR API Call
// ===========================
export async function callTencentOCR(imageBase64: string): Promise<OCRResult> {
  const config = getOCRConfig()
  if (!config.secretId || !config.secretKey) {
    throw new Error('请先在设置中配置腾讯云 OCR API 密钥')
  }

  // Check if Web Crypto API is available (requires secure context)
  if (!crypto.subtle) {
    throw new Error(
      'OCR 签名需要安全环境（HTTPS 或 localhost）。\n' +
      '当前网页地址不支持加密操作。\n' +
      '请使用以下方式之一：\n' +
      '1. 部署到 HTTPS 服务器后使用\n' +
      '2. 或在 Mac 本机用 http://localhost:5173 访问'
    )
  }

  const service = 'ocr'
  const host = 'ocr.tencentcloudapi.com'
  const action = 'GeneralAccurateOCR'
  const version = '2018-11-19'
  const region = 'ap-guangzhou'

  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().split('T')[0]

  const payload = JSON.stringify({
    ImageBase64: imageBase64,
    EnableDetectText: true,
  })

  // Step 1: Build canonical request
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedRequestPayload = await sha256(payload)

  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join('\n')

  // Step 2: Build string to sign
  const algorithm = 'TC3-HMAC-SHA256'
  const hashedCanonicalRequest = await sha256(canonicalRequest)
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n')

  // Step 3: Calculate signature
  const signature = await tc3Sign(config.secretKey, date, service, stringToSign)

  // Step 4: Build authorization header
  const authorization = `${algorithm} Credential=${config.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  // Step 5: Make request with 30s timeout
  // Try direct call first, fall back to CORS proxy
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const makeRequest = async (url: string): Promise<Response> => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Region': region,
        'X-TC-Timestamp': String(timestamp),
        'Authorization': authorization,
      },
      body: payload,
      signal: controller.signal,
    })
  }

  try {
    // Try direct API call first
    let response: Response
    try {
      response = await makeRequest(`https://${host}`)
    } catch {
      // If direct call fails (likely CORS), try proxy
      console.log('Direct API call failed, trying CORS proxy...')
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://${host}`)}`
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Host': host,
          'X-TC-Action': action,
          'X-TC-Version': version,
          'X-TC-Region': region,
          'X-TC-Timestamp': String(timestamp),
          'Authorization': authorization,
        },
        body: payload,
        signal: controller.signal,
      })
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`API 请求失败 (${response.status})${errorText ? ': ' + errorText.slice(0, 200) : ''}`)
    }

    const data = await response.json() as {
    Response: {
      TextDetections?: Array<{
        DetectedText: string
        Confidence: number
        Polygon: Array<{ X: number; Y: number }>
      }>
      Error?: { Code: string; Message: string }
    }
  }

    if (data.Response.Error) {
      throw new Error(`OCR 识别错误: ${data.Response.Error.Message}`)
    }

    const rawBlocks: OCRTextBlock[] = (data.Response.TextDetections || []).map((d) => ({
      text: d.DetectedText,
      confidence: d.Confidence / 100,
      polygon: d.Polygon.map((p) => ({ x: p.X, y: p.Y })),
    }))

    // Merge broken lines before parsing
    const rawText = rawBlocks.map((b) => b.text).join('\n')
    const mergedText = mergeBrokenLines(rawText)
    const mergedLines = mergedText.split('\n').filter(l => l.trim())
    const textBlocks: OCRTextBlock[] = mergedLines.map((text, i) => ({
      text,
      confidence: rawBlocks[0]?.confidence ?? 0.9,
      polygon: [{ x: 0, y: i * 20 }, { x: 100, y: i * 20 }, { x: 100, y: (i + 1) * 20 }, { x: 0, y: (i + 1) * 20 }],
    }))

    const fullText = mergedLines.join('\n')
    const parsed = parseQuestionFromOCR(textBlocks)

    return { textBlocks, fullText, parsed }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('OCR 请求超时（30秒），请检查网络连接或重试')
    }
    throw err
  }
}

// ===========================
// OCR → Question Parser
// ===========================
// Public wrapper for parsing user-edited text
export function parseQuestionFromText(rawText: string): ParsedQuestion {
  // First merge broken lines, then parse
  const mergedText = mergeBrokenLines(rawText)
  const blocks: OCRTextBlock[] = mergedText.split('\n')
    .filter(line => line.trim())
    .map(line => ({
      text: line.trim(),
      confidence: 1,
      polygon: [],
    }))
  return parseQuestionFromOCR(blocks) ?? {
    questionText: mergedText,
    optionA: '', optionB: '', optionC: '', optionD: '',
    correctAnswer: '', explanation: '', confidence: 100,
  }
}

/**
 * Merge OCR-broken lines back together.
 * Tesseract often splits a single logical line into multiple text lines.
 * This function uses Chinese text heuristics to rejoin them.
 */
function mergeBrokenLines(text: string): string {
  const lines = text.split('\n')
  if (lines.length <= 1) return text

  const merged: string[] = []
  let currentLine = ''

  // Characters that indicate end of a logical sentence/paragraph
  const sentenceEnd = /[。！？!?；;」』）\)""】〗]$/
  // Characters that indicate continuation (line doesn't end properly)
  const continuationEnd = /[，、,：:的了吗着呢过和与及或]$/
  // Option markers - should always start new lines
  const isOptionLine = /^[A-Da-d]\s*[.．、。)）]/
  // Numbered items
  const isNumberedLine = /^\d+[.．、)）]/
  // Answer/explanation markers
  const isMetaLine = /^(?:答案|参考答案|正确答案|解析|答案解析|【答案】|【解析】)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      // Blank line = paragraph break
      if (currentLine) {
        merged.push(currentLine)
        currentLine = ''
      }
      merged.push('')  // preserve blank line
      continue
    }

    // Option markers / Numbered items / Meta lines always start fresh
    if (isOptionLine.test(line) || isNumberedLine.test(line) || isMetaLine.test(line)) {
      if (currentLine) {
        merged.push(currentLine)
        currentLine = ''
      }
      merged.push(line)
      continue
    }

    // First line of text
    if (!currentLine) {
      currentLine = line
      continue
    }

    // Check: should we merge this line with currentLine?
    const prevLine = currentLine
    const prevLastChar = prevLine[prevLine.length - 1]
    const thisFirstChar = line[0]

    // Merge if previous line doesn't end with a sentence terminator
    // AND this line doesn't start a new sentence
    const prevEndsProperly = sentenceEnd.test(prevLastChar) || prevLine.length <= 2
    const prevContinues = continuationEnd.test(prevLastChar) ||
      // Chinese text - if prev line ends with a regular Chinese char (not punctuation), merge
      (/[一-鿿]/.test(prevLastChar) && !/[。！？!?；;」』)\)]/.test(prevLastChar))

    const thisStartsNew = /^[A-Da-d]\s*[.．、]/.test(line) ||  // option
      /^[/d]/.test(line) ||  // number
      /^(?:答案|解析|参考)/.test(line) ||  // meta
      /^[《「『【（(]/.test(line)  // starts with bracket

    if (!prevEndsProperly && !thisStartsNew) {
      // Merge: join without space (Chinese text)
      currentLine += line
    } else {
      // Don't merge: end current line, start new one
      merged.push(currentLine)
      currentLine = line
    }
  }

  // Push the last line
  if (currentLine) {
    merged.push(currentLine)
  }

  return merged.join('\n')
}

function parseQuestionFromOCR(blocks: OCRTextBlock[]): ParsedQuestion | null {
  if (blocks.length === 0) return null

  const texts = blocks.map((b) => b.text.trim()).filter((t) => t.length > 0)
  const avgConfidence = blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length

  let questionText = ''
  const options: Record<string, string> = { A: '', B: '', C: '', D: '' }
  let correctAnswer = ''
  let explanation = ''
  let inAnswerSection = false
  let inExplanationSection = false
  let firstOptionIndex = -1

  // === PHASE 1: First pass - find option lines and answer lines ===
  // More flexible option pattern: matches "A.xxx", "A、xxx", "A．xxx", "A)xxx", "A ）xxx", "A xxx"
  const optionPatterns = [
    /^([A-D])\s*[.．、。)）]\s*(.+)/,
    /^([A-D])\s{2,}(.+)/,           // "A  xxx" with multiple spaces
    /^([A-D])\s(.{2,})/,             // "A xxx" with single space but content
    /^（?([A-D])）?\s*[.．、]\s*(.+)/,  // "(A) xxx" or "（A）xxx"
  ]

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]
    let matched = false

    // Try each option pattern
    for (const pattern of optionPatterns) {
      const match = text.match(pattern)
      if (match && match[1] in options) {
        const optLetter = match[1]
        const optText = match[2]?.trim() || text.replace(match[0], '').trim()
        // Don't overwrite if already set (first occurrence wins)
        if (!options[optLetter]) {
          options[optLetter] = optText
        }
        if (firstOptionIndex < 0) firstOptionIndex = i
        matched = true
        break
      }
    }

    // Compact format: "A文字B文字C文字D文字" on a single line (no separators)
    if (!matched) {
      const compactMatch = text.match(/A(.+?)B(.+?)C(.+?)D(.+)$/)
      if (compactMatch) {
        options.A = compactMatch[1].trim()
        options.B = compactMatch[2].trim()
        options.C = compactMatch[3].trim()
        options.D = compactMatch[4].trim()
        if (firstOptionIndex < 0) firstOptionIndex = i
        matched = true
      }
    }
  }

  // === PHASE 2: Build question text from lines before the first option ===
  const optionStart = firstOptionIndex >= 0 ? firstOptionIndex : texts.length
  for (let i = 0; i < optionStart; i++) {
    const text = texts[i]
    // Skip answer/explanation keywords in question area
    if (/^(?:答案|参考答案|正确答案|解析|答案解析|试题解析)[：:.\s]*/.test(text)) {
      const answerVal = text.match(/(?:答案|参考答案|正确答案)[：:.\s]*([A-D])/i)
      if (answerVal) correctAnswer = answerVal[1]
      const afterLabel = text.replace(/^(?:答案|参考答案|正确答案|解析|答案解析|试题解析)[：:.\s]*/i, '').trim()
      if (afterLabel) {
        if (text.match(/^解析/)) {
          inExplanationSection = true
          explanation = afterLabel
        } else if (!correctAnswer) {
          correctAnswer = afterLabel
        }
      }
      continue
    }
    questionText += (questionText ? '\n' : '') + text
  }

  // === PHASE 3: Parse post-option content for answers/explanations ===
  for (let i = optionStart; i < texts.length; i++) {
    const text = texts[i]

    // Skip lines that are already captured as options
    let isOption = false
    for (const pattern of optionPatterns) {
      if (pattern.test(text)) { isOption = true; break }
    }
    if (isOption) continue

    // Check for answer line
    const answerMatch = text.match(/(?:答案|参考答案|正确答案)[：:.\s]*([A-D])/i)
    if (answerMatch) {
      correctAnswer = answerMatch[1]
      inAnswerSection = true
      continue
    }

    // Check for standalone answer letter
    if (/^([A-D])\s*$/.test(text.trim()) && !correctAnswer) {
      correctAnswer = text.trim()
      continue
    }

    // Check for explanation start
    if (/^(?:解析|答案解析|试题解析)[：:.\s]*/i.test(text)) {
      inExplanationSection = true
      const expText = text.replace(/^(?:解析|答案解析|试题解析)[：:.\s]*/i, '').trim()
      if (expText) explanation = expText
      continue
    }

    // If in explanation, append
    if (inExplanationSection) {
      explanation += (explanation ? '\n' : '') + text
    }
  }

  // === PHASE 4: If no structured options found, try to split inline ===
  // Handles case like "A.xxx B.xxx C.xxx D.xxx" all on one line
  if (!options.A && !options.B && !options.C && !options.D) {
    const fullText = texts.join(' ')
    const inlinePattern = /([A-D])\s*[.．、。)）]\s*(.*?)(?=\s*[A-D]\s*[.．、。)）]|$)/g
    let match
    while ((match = inlinePattern.exec(fullText)) !== null) {
      const letter = match[1]
      const content = match[2].trim()
      if (letter in options && !options[letter] && content) {
        options[letter] = content
      }
    }
  }

  // === PHASE 4.5: Compact format — "A选项一B选项二C选项三D选项四" (no separator) ===
  if (!options.A && !options.B && !options.C && !options.D) {
    const fullText = texts.join('')
    // Match: A<content>B<content>C<content>D<content>
    // Content between A and B, B and C, C and D, and after D
    const compactMatch = fullText.match(/A(.+?)B(.+?)C(.+?)D(.+)$/)
    if (compactMatch) {
      options.A = compactMatch[1].trim()
      options.B = compactMatch[2].trim()
      options.C = compactMatch[3].trim()
      options.D = compactMatch[4].trim()
    } else {
      // Try alternative: split on standalone A B C D that appear mid-text
      // Pattern: look for "AxxxByyyCzzzDwww" where xxx doesn't contain B/C/D
      const parts = fullText.split(/(?=[A-D])/).filter(s => s.length > 0)
      const found: Record<string, string> = {}
      for (const part of parts) {
        const m = part.match(/^([A-D])(.*)$/)
        if (m && m[1] in options && !found[m[1]]) {
          found[m[1]] = m[2].trim()
        }
      }
      if (Object.keys(found).length >= 2) {
        for (const [k, v] of Object.entries(found)) {
          options[k] = v
        }
      }
    }
  }

  // === PHASE 5: Try to detect answer from "【答案】A" patterns ===
  if (!correctAnswer) {
    for (const text of texts) {
      const m = text.match(/【答案】\s*([A-D])/i)
      if (m) { correctAnswer = m[1]; break }
    }
  }

  return {
    questionText: questionText.trim(),
    optionA: options.A,
    optionB: options.B,
    optionC: options.C,
    optionD: options.D,
    correctAnswer,
    explanation: explanation.trim(),
    confidence: Math.round(avgConfidence * 100),
  }
}

// ===========================
// Tesseract.js (Free, Browser-based OCR)
// ===========================
let tesseractWorker: Worker | null = null

async function callTesseractOCR(file: File): Promise<OCRResult> {
  // Dynamic import to avoid bundling Tesseract in the main chunk
  const Tesseract = await import('tesseract.js')

  // Use the image URL directly to avoid re-compression
  const imageUrl = URL.createObjectURL(file)

  try {
    const result = await Tesseract.recognize(imageUrl, 'chi_sim+eng', {
      logger: (info: { status: string; progress: number }) => {
        // Progress can be used to update UI
        console.log('Tesseract:', info.status, Math.round(info.progress * 100) + '%')
      },
    })

    URL.revokeObjectURL(imageUrl)

    // Parse the lines from Tesseract
    const lines = result.data.text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    const textBlocks: OCRTextBlock[] = lines.map((text: string, i: number) => ({
      text,
      confidence: result.data.confidence / 100,
      polygon: [{ x: 0, y: i * 20 }, { x: 100, y: i * 20 }, { x: 100, y: (i + 1) * 20 }, { x: 0, y: (i + 1) * 20 }],
    }))

    const mergedText = mergeBrokenLines(lines.join('\n'))
    const mergedLines = mergedText.split('\n').filter(l => l.trim())
    const mergedBlocks: OCRTextBlock[] = mergedLines.map((text: string, i: number) => ({
      text,
      confidence: result.data.confidence / 100,
      polygon: [{ x: 0, y: i * 20 }, { x: 100, y: i * 20 }, { x: 100, y: (i + 1) * 20 }, { x: 0, y: (i + 1) * 20 }],
    }))

    const fullText = mergedLines.join('\n')
    const parsed = parseQuestionFromOCR(mergedBlocks)

    return { textBlocks: mergedBlocks, fullText, parsed }
  } catch (err) {
    URL.revokeObjectURL(imageUrl)
    throw err
  }
}

// ===========================
// Full Pipeline
// ===========================
export async function processImageWithOCR(file: File): Promise<OCRResult> {
  const config = getOCRConfig()

  if (config.provider === 'tencent' && isOCRConfigured()) {
    const imageBase64 = await imageFileToBase64(file)
    return callTencentOCR(imageBase64)
  }

  // Tesseract (default): free, browser-based, no API key needed
  if (config.provider === 'tesseract') {
    return callTesseractOCR(file)
  }

  // Manual mode: just return the image, user types manually
  return {
    textBlocks: [],
    fullText: '',
    parsed: null,
  }
}

// Uploaded image type (used across components)
export interface UploadedImage {
  file: File
  previewUrl: string
  id: string
}

// Generate a local preview URL for an image file
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file)
}

export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url)
}
