// Tencent Cloud OCR API client
// Uses TC3-HMAC-SHA256 signing via Web Crypto API

const SECRET_ID_KEY = 'cuotiben_ocr_secret_id'
const SECRET_KEY_KEY = 'cuotiben_ocr_secret_key'
const OCR_PROVIDER_KEY = 'cuotiben_ocr_provider'

export type OCRProvider = 'tencent' | 'manual'

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
    provider: (localStorage.getItem(OCR_PROVIDER_KEY) as OCRProvider) || 'tencent',
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
  return config.secretId.length > 0 && config.secretKey.length > 0
}

// ===========================
// Image Helpers
// ===========================
async function imageFileToBase64(file: File): Promise<string> {
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

  const service = 'ocr'
  const host = 'ocr.tencentcloudapi.com'
  const action = 'GeneralAccurateOCR'
  const version = '2018-11-19'
  const region = 'ap-guangzhou'

  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().split('T')[0]

  const payload = JSON.stringify({
    ImageBase64: imageBase64,
    LanguageType: 'zh',
    EnableDetectText: true,
    ConfigID: 'OCR',
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

  // Step 5: Make request
  const response = await fetch(`https://${host}`, {
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
  })

  if (!response.ok) {
    throw new Error(`OCR API 请求失败: ${response.status}`)
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

  const textBlocks: OCRTextBlock[] = (data.Response.TextDetections || []).map((d) => ({
    text: d.DetectedText,
    confidence: d.Confidence / 100,
    polygon: d.Polygon.map((p) => ({ x: p.X, y: p.Y })),
  }))

  const fullText = textBlocks.map((b) => b.text).join('\n')
  const parsed = parseQuestionFromOCR(textBlocks)

  return { textBlocks, fullText, parsed }
}

// ===========================
// OCR → Question Parser
// ===========================
function parseQuestionFromOCR(blocks: OCRTextBlock[]): ParsedQuestion | null {
  if (blocks.length === 0) return null

  const texts = blocks.map((b) => b.text.trim()).filter((t) => t.length > 0)
  const avgConfidence = blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length

  let questionText = ''
  const options: Record<string, string> = { A: '', B: '', C: '', D: '' }
  let correctAnswer = ''
  let explanation = ''
  let parsingOptions = false
  let parsingAnswer = false
  let parsingExplanation = false

  // Patterns for detecting options, answers, and explanations
  const optionPattern = /^([A-D])[.．、)\s]+(.+)/
  const answerPattern = /^(?:答案|参考答案|正确答案)[：:.\s]*([A-D])\s*$/i
  const answerPatternAlt = /^【(?:答案|解析)】[：:.\s]*([A-D])\s*$/i
  const explanationStartPattern = /^(?:解析|答案解析|试题解析)[：:.\s]*/i
  const fullAnswerPattern = /^([A-D])[.．、)\s]*(.+)/
  // Detect the word "答案" anywhere
  const answerWordPattern = /答案[：:.\s]*([A-D])/i

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]

    // Check for answer/explanation section
    const answerMatch = text.match(answerPattern) || text.match(answerPatternAlt)
    const explanationMatch = text.match(explanationStartPattern)
    const answerWordMatch = text.match(answerWordPattern)

    if (answerMatch && !parsingAnswer) {
      correctAnswer = answerMatch[1]
      parsingAnswer = true
      parsingOptions = false
      continue
    }

    if (explanationMatch && !parsingExplanation) {
      parsingExplanation = true
      parsingAnswer = false
      const afterLabel = text.replace(explanationStartPattern, '').trim()
      if (afterLabel) explanation = afterLabel
      continue
    }

    if (parsingExplanation) {
      explanation += (explanation ? '\n' : '') + text
      continue
    }

    // Check for option patterns (A、xxx, B、xxx, etc.)
    const optionMatch = text.match(optionPattern)
    if (optionMatch && !parsingAnswer) {
      parsingOptions = true
      const optLetter = optionMatch[1]
      const optText = optionMatch[2]
      if (optLetter in options) {
        options[optLetter] = optText
      }
      // Also check if it contains "答案" after the option
      if (!correctAnswer) {
        const embeddedAnswer = text.match(answerWordPattern)
        if (embeddedAnswer) correctAnswer = embeddedAnswer[1]
      }
      continue
    }

    // If we haven't started parsing options yet, this is question text
    if (!parsingOptions) {
      questionText += (questionText ? '\n' : '') + text
    } else if (parsingAnswer) {
      // Additional answer text (handle cases where answer is in its own line)
      const singleLetterMatch = text.match(/^([A-D])\s*$/)
      if (singleLetterMatch) {
        correctAnswer = singleLetterMatch[1]
      }
    }
  }

  // If no answer found via patterns, look for standalone letter at the end
  if (!correctAnswer && texts.length > 0) {
    const lastText = texts[texts.length - 1].trim()
    if (/^[A-D]$/.test(lastText)) {
      correctAnswer = lastText
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
// Full Pipeline
// ===========================
export async function processImageWithOCR(file: File): Promise<OCRResult> {
  const config = getOCRConfig()

  if (config.provider === 'tencent' && isOCRConfigured()) {
    const imageBase64 = await imageFileToBase64(file)
    return callTencentOCR(imageBase64)
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
