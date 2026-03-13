import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard')
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      const msgMap: Record<string, string> = {
        email_not_found: 'Email này chưa được đăng ký. Vui lòng đăng ký tài khoản mới.',
        wrong_password: 'Mật khẩu không đúng. Vui lòng thử lại.',
        account_disabled: 'Tài khoản của bạn đã bị khóa. Liên hệ admin.',
      }
      setError((code && msgMap[code]) || 'Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#667eea] via-[#764ba2] to-[#f093fb] relative overflow-hidden items-center justify-center p-12">
        {/* Floating shapes */}
        <div className="absolute top-[10%] left-[10%] w-64 h-64 rounded-full bg-white opacity-10 animate-pulse" />
        <div className="absolute bottom-[20%] right-[15%] w-40 h-40 bg-white opacity-10 rounded-[30%_70%_70%_30%/30%_30%_70%_70%] animate-bounce" />

        <div className="relative z-10 text-white text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl">
            📱
          </div>
          <h1 className="text-4xl font-bold mb-3">VFRAMOTP</h1>
          <p className="text-white/90 text-lg mb-8">
            Hệ thống thuê SIM nhận OTP uy tín, nhanh chóng và an toàn
          </p>
          <div className="space-y-3 text-left">
            {[
              { icon: '⚡', title: 'Nhanh chóng', desc: 'Nhận OTP trong vài giây' },
              { icon: '🔒', title: 'Bảo mật cao', desc: 'Dữ liệu được mã hóa' },
              { icon: '🌐', title: 'API tích hợp', desc: 'Hỗ trợ REST API đầy đủ' },
            ].map(f => (
              <div key={f.title} className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-white/75 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl">
              🔑
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Đăng Nhập</h2>
            <p className="text-gray-500 text-sm mt-1">Chào mừng bạn quay trở lại!</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 leading-none text-lg font-bold">×</button>
            </div>
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Đang đăng nhập...' : 'Đăng Nhập Ngay'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-purple-600 font-semibold hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
