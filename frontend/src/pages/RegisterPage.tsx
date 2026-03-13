import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    setLoading(true)
    try {
      await authAPI.register(email, password)
      setSuccess('Đăng ký thành công! Đang chuyển hướng...')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#11998e] via-[#38ef7d] to-[#667eea] relative overflow-hidden items-center justify-center p-12">
        <div className="absolute top-[10%] right-[10%] w-56 h-56 rounded-full bg-white opacity-10 animate-pulse" />
        <div className="absolute bottom-[15%] left-[10%] w-36 h-36 bg-white opacity-10 rounded-[50%] animate-bounce" />
        <div className="relative z-10 text-white text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl">
            🚀
          </div>
          <h1 className="text-4xl font-bold mb-3">Tạo tài khoản</h1>
          <p className="text-white/90 text-lg mb-8">Miễn phí đăng ký, sử dụng ngay</p>
          <div className="space-y-3 text-left">
            {[
              { icon: '✅', title: 'Miễn phí đăng ký' },
              { icon: '💳', title: 'Nạp tiền dễ dàng' },
              { icon: '🔑', title: 'API key miễn phí' },
            ].map(f => (
              <div key={f.title} className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                <span className="text-2xl">{f.icon}</span>
                <p className="font-semibold">{f.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-2xl">
              📝
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Đăng Ký</h2>
            <p className="text-gray-500 text-sm mt-1">Tạo tài khoản miễn phí</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">⚠️ {error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">✅ {success}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-blue-600 transition-all disabled:opacity-60"
            >
              {loading ? '⏳ Đang đăng ký...' : 'Đăng Ký Ngay'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-purple-600 font-semibold hover:underline">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
