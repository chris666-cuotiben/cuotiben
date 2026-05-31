import { useState } from 'react'
import { Wand2, AlertCircle, Check, ArrowRight } from 'lucide-react'

interface OCRTextEditorProps {
  rawText: string
  imageUrl?: string
  onConfirm: (editedText: string) => void
  onBack: () => void
}

export default function OCRTextEditor({ rawText, imageUrl, onConfirm, onBack }: OCRTextEditorProps) {
  const [text, setText] = useState(rawText)
  const [showGuide, setShowGuide] = useState(false)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mini image for reference */}
      {imageUrl && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <img src={imageUrl} alt="参考原图" className="w-full h-28 object-cover opacity-70" />
          <p className="text-center text-xs text-gray-400 py-1.5">↑ 对照原图检查文字 ↑</p>
        </div>
      )}

      {/* Guide */}
      <div className="bg-blue-50 rounded-xl p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-blue-700">
            <p className="font-medium mb-1">校对并修正识别内容</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              请确保：<br />
              ① 题目正文在第一段，完整无遗漏<br />
              ② 每个选项以字母开头各占一行<br />
              <span className="text-blue-400">例：A. 选项内容<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;B. 选项内容</span><br />
              ③ 多余的说明文字请删除
            </p>
          </div>
        </div>
      </div>

      {/* Editable Text Area */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="w-full text-sm text-gray-900 leading-relaxed focus:outline-none resize-none"
          placeholder="OCR 识别结果将显示在这里..."
          spellCheck={false}
        />
      </div>

      {/* Quick Format Help */}
      <div className="flex flex-wrap gap-2">
        <QuickFix text={text} setText={setText} label="A. B. C. D." find={/[aA]\s*[.．、]/} />
        <QuickFix text={text} setText={setText} label="A、B、C、D、" find={/[aA]\s*[.．、]/} />
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg"
        >
          格式化帮助
        </button>
      </div>

      {showGuide && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-xs text-gray-600 space-y-1">
          <p><strong>正确格式示例：</strong></p>
          <p>以下哪项不是邓小平理论的核心内容？</p>
          <p>A. 解放思想，实事求是</p>
          <p>B. 坚持党的基本路线不动摇</p>
          <p>C. 一国两制，和平统一</p>
          <p>D. 全面协调可持续发展</p>
          <p className="text-gray-400 mt-1">（每行以 A/B/C/D 开头，选项不跨行）</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
        >
          返回拍照
        </button>
        <button
          onClick={() => onConfirm(text)}
          disabled={!text.trim()}
          className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-primary-500 text-white rounded-xl font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          确认，自动拆分题目和选项
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}

// Quick fix button
function QuickFix({ text, setText, label, find }: {
  text: string; setText: (t: string) => void; label: string; find: RegExp
}) {
  const apply = () => {
    // Try to split compact option lines into separate lines
    // e.g. "A.xxx B.xxx" → "A.xxx\nB.xxx"
    const lines = text.split('\n')
    const fixed = lines.map((line) => {
      // Check if this line has multiple option markers
      const matches = [...line.matchAll(new RegExp(find, 'gi'))]
      if (matches.length > 1) {
        // Split on option markers
        const parts: string[] = []
        let lastIdx = 0
        for (const m of matches) {
          if (m.index! > lastIdx) {
            parts.push(line.slice(lastIdx, m.index!).trim())
          }
          lastIdx = m.index!
        }
        parts.push(line.slice(lastIdx).trim())
        return parts.filter(p => p).join('\n')
      }
      return line
    }).join('\n')
    setText(fixed)
  }

  return (
    <button
      onClick={apply}
      className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg font-medium"
    >
      {label} 分行
    </button>
  )
}
