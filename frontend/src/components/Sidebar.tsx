import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const userNav = [
  { to: '/dashboard',     icon: '🏠', label: 'Tổng quan' },
  { to: '/otp',           icon: '📱', label: 'Thuê SIM nhận OTP' },
  { to: '/transactions',  icon: '📋', label: 'Lịch sử giao dịch' },
  { to: '/balance',       icon: '💰', label: 'Biến động số dư' },
  { to: '/api-docs',      icon: '🔌', label: 'API tích hợp' },
  { to: '/profile',       icon: '⚙️', label: 'Cài đặt tài khoản' },
]

const adminNav = [
  { to: '/admin/dashboard',     icon: '📊', label: 'Thống kê' },
  { to: '/admin/users',         icon: '👥', label: 'Người dùng' },
  { to: '/admin/providers',     icon: '🛍️', label: 'Product' },
  { to: '/admin/transactions',  icon: '📋', label: 'Giao dịch' },
]

interface Props {
  mobileOpen: boolean
  onClose: () => void
}

export default function Sidebar({ mobileOpen, onClose }: Props) {
  const { user, logout, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const isAdminMode = pathname.startsWith('/admin')

  const theme = isAdminMode
    ? { bg: 'from-[#1a1a2e] to-[#16213e]', accent: 'from-red-400 to-orange-400', text: 'text-red-300', activeNav: 'bg-white/20 text-white', inactiveNav: 'text-gray-300 hover:bg-white/10 hover:text-white' }
    : { bg: 'from-[#2d1b69] to-[#1a0e3d]', accent: 'from-purple-400 to-pink-400', text: 'text-purple-300', activeNav: 'bg-white/20 text-white', inactiveNav: 'text-purple-200 hover:bg-white/10 hover:text-white' }

  const navItems = isAdminMode ? adminNav : userNav

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-screen w-60 bg-gradient-to-b ${theme.bg}
        flex flex-col z-40 shadow-2xl transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Merged profile card */}
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          {/* App name + mode badge */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-bold text-sm tracking-wide">VFRAMOTP</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 ${theme.text}`}>
              {isAdminMode ? 'ADMIN' : 'USER'}
            </span>
          </div>

          {/* Avatar + info centered */}
          <div className="flex flex-col items-center gap-2">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${theme.accent} shadow-lg ring-2 ring-white/20 overflow-hidden shrink-0`}>
              <img
                src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(user?.email ?? 'user')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                alt="avatar"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <div className="text-center min-w-0 w-full">
              <p className="text-white text-xs font-medium truncate px-1">{user?.email}</p>
              <p className={`text-xs font-semibold mt-0.5 ${isAdminMode ? 'text-red-300' : 'text-yellow-300'}`}>
                {isAdminMode ? '👑 Admin' : `💰 ${(user?.balance ?? 0).toLocaleString('vi-VN')} đ`}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive ? theme.activeNav + ' font-semibold shadow-lg' : theme.inactiveNav
                }`
              }
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Switch panel link */}
        <div className="px-3 pt-2 border-t border-white/10">
          {isAdminMode ? (
            <NavLink to="/dashboard" onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white transition-all">
              <span>👤</span><span>Về trang user</span>
            </NavLink>
          ) : isAdmin ? (
            <NavLink to="/admin/dashboard" onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-orange-300 hover:bg-orange-500/20 hover:text-orange-200 transition-all">
              <span>👑</span><span>Quản trị Admin</span>
            </NavLink>
          ) : null}
        </div>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-white/10">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all">
            <span>🚪</span><span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
      aria-label="Toggle menu">
      ☰
    </button>
  )
}
