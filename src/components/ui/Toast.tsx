import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

interface ToastMessage {
  id: string
  text: string
  type: 'success' | 'error'
}

interface ToastContextType {
  showToast: (text: string, type?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, text, type }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${
        toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'
      }`}
    >
      {toast.type === 'success' ? (
        <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
      ) : (
        <AlertCircle size={16} className="flex-shrink-0" />
      )}
      <span>{toast.text}</span>
      <button onClick={onDismiss} className="ml-2 flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}
