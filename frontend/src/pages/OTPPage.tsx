import { useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { otpAPI } from '../services/api'
import type { OTPSession, Provider } from '../types'

type Phase = 'select' | 'waiting' | 'done_success' | 'done_timeout'

export default function OTPPage() {
  const { apiKey, user, updateBalance } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [session, setSession] = useState<OTPSession | null>(null)
  const [otp, setOtp] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingGet, setLoadingGet] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimers() {
    if (pollRef.current) clearInterval(pollRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
  }

  // Load services
  useEffect(() => {
    if (!apiKey) { setLoadingServices(false); return }
    otpAPI.getServices(apiKey)
      .then(r => {
        setProviders(r.data)
        if (r.data.length > 0) setSelectedId(r.data[0].id)
      })
      .catch(() => setError('Không thể tải danh sách dịch vụ'))
      .finally(() => setLoadingServices(false))
  }, [apiKey])

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [])

  function startPolling(sess: OTPSession) {
    if (!apiKey) return
    // Tick timer
    tickRef.current = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)

    // Poll OTP every 5s
    pollRef.current = setInterval(async () => {
      try {
        const r = await otpAPI.getCode(apiKey, sess.request_id)
        const code = r.data.otp_code
        if (code === 'is_comming') return
        clearTimers()
        if (code === 'timeout') {
          setPhase('done_timeout')
        } else {
          setOtp(code)
          setPhase('done_success')
        }
      } catch {
        // ignore transient errors, keep polling
      }
    }, 5000)
  }

  async function handleGetNumber() {
    if (!apiKey || !selectedId) return
    // Check balance before calling API
    const price = providers.find(p => p.id === selectedId)?.price ?? 0
    if ((user?.balance ?? 0) < price) {
      setError(`insufficient_balance:${price}`)
      return
    }
    setError('')
    setLoadingGet(true)
    try {
      const r = await otpAPI.getNumber(apiKey, selectedId)
      if (!r.data.success) {
        setError(r.data.message || 'Không thể lấy số. Thử lại.')
        return
      }
      updateBalance((user?.balance ?? 0) - price)
      const provider = providers.find(p => p.id === selectedId)!
      const sess: OTPSession = {
        phone: r.data.number,
        request_id: r.data.request_id,
        provider_id: selectedId,
        started_at: Date.now(),
        timeout: provider.timeout,
      }
      setSession(sess)
      setElapsed(0)
      setPhase('waiting')
      startPolling(sess)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Không thể lấy số. Thử lại.')
    } finally {
      setLoadingGet(false)
    }
  }

  async function handleRenew() {
    if (!apiKey || !session) return
    clearTimers()
    setError('')
    setLoadingGet(true)
    const savedSession = session
    try {
      const r = await otpAPI.renew(apiKey, session.request_id)
      if (!r.data.success) {
        // OTP may have arrived before user clicked renew — check one more time
        if (r.data.message === 'transaction already finalized') {
          try {
            const check = await otpAPI.getCode(apiKey, savedSession.request_id)
            if (check.data.otp_code !== 'is_comming' && check.data.otp_code !== 'timeout') {
              setOtp(check.data.otp_code)
              setPhase('done_success')
              return
            }
          } catch { /* ignore */ }
        }
        setError(r.data.message || 'Không thể đổi số')
        setPhase('select')
        return
      }
      const provider = providers.find(p => p.id === session.provider_id)!
      const sess: OTPSession = {
        phone: r.data.number,
        request_id: r.data.request_id,
        provider_id: session.provider_id,
        started_at: Date.now(),
        timeout: provider.timeout,
      }
      setSession(sess)
      setElapsed(0)
      setOtp('')
      setPhase('waiting')
      startPolling(sess)
    } catch {
      setError('Lỗi khi đổi số. Thử lại.')
      // Restart polling for current session so user isn't stranded
      startPolling(savedSession)
    } finally {
      setLoadingGet(false)
    }
  }

  function handleReset() {
    clearTimers()
    setSession(null)
    setOtp('')
    setElapsed(0)
    setPhase('select')
    setError('')
  }

  function copyOTP() {
    navigator.clipboard.writeText(otp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyPhone() {
    if (session) navigator.clipboard.writeText(session.phone)
  }

  const remaining = session ? Math.max(0, session.timeout - elapsed) : 0
  const selected = providers.find(p => p.id === selectedId)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📱 Thuê SIM nhận OTP</h1>
          <p className="text-gray-500 text-sm">Chọn dịch vụ và nhận mã OTP tự động</p>
        </div>

        {/* No API key warning */}
        {!apiKey && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
            <p className="text-yellow-700 font-medium">⚠️ Bạn chưa có API Key</p>
            <p className="text-yellow-600 text-sm mt-1">
              Vào <strong>Tổng quan → Tạo key</strong> để tạo API Key trước khi thuê SIM.
            </p>
          </div>
        )}

        {error && error.startsWith('insufficient_balance:') ? (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-3xl">💸</span>
              <div className="flex-1">
                <p className="font-bold text-orange-700 text-base">Số dư không đủ</p>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="text-orange-600">Số dư hiện tại: <strong>{(user?.balance ?? 0).toLocaleString('vi-VN')}đ</strong></span>
                  <span className="text-gray-400">·</span>
                  <span className="text-orange-600">Cần: <strong>{Number(error.split(':')[1]).toLocaleString('vi-VN')}đ</strong></span>
                </div>
                <p className="text-orange-500 text-xs mt-1">Vui lòng liên hệ admin để nạp thêm tiền vào tài khoản.</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
            ⚠️ {error}
          </div>
        ) : null}

        {/* Select phase */}
        {phase === 'select' && apiKey && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 space-y-5">
            <h2 className="font-semibold text-gray-700">Chọn dịch vụ</h2>

            {loadingServices ? (
              <p className="text-gray-400 text-sm">⏳ Đang tải dịch vụ...</p>
            ) : providers.length === 0 ? (
              <p className="text-gray-400 text-sm">Không có dịch vụ nào khả dụng</p>
            ) : (
              <>
                <div className="grid gap-3">
                  {providers.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedId === p.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="provider"
                        value={p.id}
                        checked={selectedId === p.id}
                        onChange={() => setSelectedId(p.id)}
                        className="accent-purple-500"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">⏱ Timeout: {p.timeout}s</p>
                      </div>
                      <div className="text-right">
                        <p className="text-purple-600 font-bold">{p.price.toLocaleString('vi-VN')}đ</p>
                        <p className="text-xs text-gray-400">/ lần</p>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleGetNumber}
                  disabled={loadingGet || !selectedId}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-60"
                >
                  {loadingGet ? '⏳ Đang lấy số...' : '📱 Lấy Số Ngay'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Waiting phase */}
        {phase === 'waiting' && session && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 space-y-5">
            {/* Phone number display */}
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
              <p className="text-gray-500 text-sm mb-2">Số điện thoại</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-bold text-gray-800 font-mono tracking-wider">{session.phone}</p>
                <button onClick={copyPhone} className="text-gray-400 hover:text-gray-600">📋</button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Dùng số này để đăng ký OTP</p>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-sm text-gray-600 font-medium">Đang chờ OTP...</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-bold text-gray-700">
                  {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                </p>
                <p className="text-xs text-gray-400">còn lại</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(remaining / (session?.timeout ?? 1)) * 100}%` }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRenew}
                disabled={loadingGet}
                className="flex-1 py-2.5 border-2 border-purple-300 text-purple-600 font-semibold rounded-xl hover:bg-purple-50 transition-all disabled:opacity-60"
              >
                🔄 Đổi số khác
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                ✕ Huỷ
              </button>
            </div>
          </div>
        )}

        {/* Success phase */}
        {phase === 'done_success' && session && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 space-y-5">
            <div className="text-center">
              <div className="text-6xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-green-600">Nhận OTP thành công!</h2>
            </div>

            <div className="p-5 bg-green-50 border-2 border-green-200 rounded-xl text-center">
              <p className="text-gray-500 text-sm mb-2">Mã OTP</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-5xl font-bold font-mono text-green-600 tracking-widest">{otp}</p>
                <button onClick={copyOTP} className="text-gray-400 hover:text-green-600 text-2xl">
                  {copied ? '✅' : '📋'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Số: {session.phone}</p>
            </div>

            {selected && (
              <p className="text-center text-sm text-gray-500">
                Dịch vụ: <strong>{selected.name}</strong> · Chi phí: <strong>{selected.price.toLocaleString('vi-VN')}đ</strong>
              </p>
            )}

            <button
              onClick={handleReset}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              📱 Thuê SIM mới
            </button>
          </div>
        )}

        {/* Timeout phase */}
        {phase === 'done_timeout' && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 space-y-5">
            <div className="text-center">
              <div className="text-6xl mb-3">⏰</div>
              <h2 className="text-xl font-bold text-gray-600">Hết thời gian</h2>
              <p className="text-gray-400 text-sm mt-1">Số dư đã được hoàn trả tự động</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              🔄 Thử lại
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
