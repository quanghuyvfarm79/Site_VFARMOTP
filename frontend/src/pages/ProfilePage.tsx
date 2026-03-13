import { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

export default function ProfilePage() {
  const { user } = useAuth()
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (newPass !== confirm) {
      setMsg({ type: 'err', text: 'Mật khẩu xác nhận không khớp' })
      return
    }
    if (newPass.length < 6) {
      setMsg({ type: 'err', text: 'Mật khẩu mới phải ít nhất 6 ký tự' })
      return
    }
    setLoading(true)
    try {
      const r = await api.post('/user/change-password', {
        old_password: oldPass,
        new_password: newPass,
      })
      setMsg({ type: 'ok', text: r.data.message || 'Đổi mật khẩu thành công!' })
      setOldPass('')
      setNewPass('')
      setConfirm('')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setMsg({ type: 'err', text: e.response?.data?.error || 'Lỗi khi đổi mật khẩu' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚙️ Cài đặt tài khoản</h1>
          <p className="text-gray-500 text-sm">Quản lý thông tin và bảo mật tài khoản</p>
        </div>

        {/* Account info */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <h2 className="font-bold text-gray-700 mb-4">👤 Thông tin tài khoản</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <span className="text-gray-500 text-sm">Email</span>
              <span className="font-medium text-gray-800">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <span className="text-gray-500 text-sm">Vai trò</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {user?.role === 'admin' ? '👑 Admin' : '👤 User'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-500 text-sm">Số dư</span>
              <span className="font-bold text-green-600">
                {(user?.balance ?? 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <h2 className="font-bold text-gray-700 mb-4">🔒 Đổi mật khẩu</h2>

          {msg && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              msg.type === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {msg.type === 'ok' ? '✅' : '⚠️'} {msg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
              <input
                type="password"
                value={oldPass}
                onChange={e => setOldPass(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
              <input
                type="password"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-60"
            >
              {loading ? '⏳ Đang lưu...' : '💾 Lưu mật khẩu mới'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
