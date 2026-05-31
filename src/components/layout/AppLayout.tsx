import { Outlet } from 'react-router-dom'
import BottomTabBar from './BottomTabBar'

export default function AppLayout() {
  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      <main className="flex-1 overflow-y-auto pb-20 safe-area-top">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  )
}
