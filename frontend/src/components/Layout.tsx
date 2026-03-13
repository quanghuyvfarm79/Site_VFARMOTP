import { useState } from 'react'
import Sidebar, { SidebarToggle } from './Sidebar'

interface Props {
  children: React.ReactNode
}

export default function Layout({ children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
          <SidebarToggle onClick={() => setMobileOpen(true)} />
          <span className="font-bold text-gray-700">VFRAMOTP</span>
        </div>

        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
