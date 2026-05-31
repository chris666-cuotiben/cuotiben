import { create } from 'zustand'

interface UIState {
  activeTab: string
  setActiveTab: (tab: string) => void
  isOnline: boolean
  setOnline: (online: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  isOnline: navigator.onLine,
  setOnline: (online) => set({ isOnline: online }),
}))
