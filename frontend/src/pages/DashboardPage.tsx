import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { userAPI } from '../services/api'
import type { Transaction } from '../types'

export default function DashboardPage() {
  const { user, apiKey, generateAPIKey, updateBalance } = useAuth()
  const [recentTx, setRecentTx] = useState<Transaction[]>([])
  const [loadingTx, setLoadingTx] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [keyMsg, setKeyMsg] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    userAPI.getProfile().then(r => updateBalance(r.data.balance)).catch(() => {})
    userAPI.getTransactions(1, 5)
      .then(r => setRecentTx(r.data.items))
      .catch(() => {})
      .finally(() => setLoadingTx(false))
  }, [updateBalance])

  async function handleGenerateKey() {
    setGeneratingKey(true)
    setKeyMsg('')
    try {
      await generateAPIKey()
      setShowKey(true)
      setKeyMsg('✅ Key mới đã được tạo! Lưu lại ngay.')
    } catch {
      setKeyMsg('❌ Không thể tạo key. Thử lại.')
    } finally {
      setGeneratingKey(false)
    }
  }

  function copyKey() {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      success: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-600',
      waiting_otp: 'bg-yellow-100 text-yellow-700',
      pending: 'bg-blue-100 text-blue-700',
      waiting_phone: 'bg-orange-100 text-orange-700',
    }
    const label: Record<string, string> = {
      success: 'Thành công', failed: 'Thất bại', cancelled: 'Huỷ',
      waiting_otp: 'Chờ OTP', pending: 'Chờ xử lý', waiting_phone: 'Chờ số',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[s] ?? 'bg-gray-100 text-gray-600'}`}>
        {label[s] ?? s}
      </span>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tổng quan</h1>
          <p className="text-gray-500 text-sm">Xin chào, {user?.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-2xl p-5 shadow-lg">
            <p className="text-white/80 text-sm mb-1">💰 Số dư hiện tại</p>
            <p className="text-3xl font-bold">{(user?.balance ?? 0).toLocaleString('vi-VN')}</p>
            <p className="text-white/70 text-xs mt-1">VNĐ</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-2xl p-5 shadow-lg">
            <p className="text-white/80 text-sm mb-1">📊 Tổng giao dịch</p>
            <p className="text-3xl font-bold">{recentTx.length}</p>
            <p className="text-white/70 text-xs mt-1">gần đây</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-2xl p-5 shadow-lg">
            <p className="text-white/80 text-sm mb-1">✅ Thành công</p>
            <p className="text-3xl font-bold">
              {recentTx.filter(t => t.status === 'success').length}
            </p>
            <p className="text-white/70 text-xs mt-1">trong {recentTx.length} gần đây</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/otp"
            className="bg-white rounded-2xl p-5 shadow border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center text-xl transition-colors">
                📱
              </div>
              <div>
                <p className="font-semibold text-gray-800">Thuê SIM nhận OTP</p>
                <p className="text-gray-400 text-xs">Bắt đầu nhận mã OTP ngay</p>
              </div>
            </div>
            <p className="text-purple-600 text-sm font-medium">Thuê ngay →</p>
          </Link>

          <Link
            to="/transactions"
            className="bg-white rounded-2xl p-5 shadow border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-xl transition-colors">
                📋
              </div>
              <div>
                <p className="font-semibold text-gray-800">Lịch sử giao dịch</p>
                <p className="text-gray-400 text-xs">Xem tất cả giao dịch</p>
              </div>
            </div>
            <p className="text-blue-600 text-sm font-medium">Xem tất cả →</p>
          </Link>
        </div>

        {/* API Key section */}
        <div className="bg-white rounded-2xl p-5 shadow border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-800">🔑 API Key</h2>
              <p className="text-gray-400 text-xs mt-0.5">Dùng key này để gọi API tự động</p>
            </div>
            <button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="px-4 py-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-60"
            >
              {generatingKey ? '⏳...' : apiKey ? '🔄 Tạo lại' : '➕ Tạo key'}
            </button>
          </div>

          {keyMsg && <p className="text-sm mb-3 text-gray-600">{keyMsg}</p>}

          {apiKey ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <code className="flex-1 text-xs text-gray-700 font-mono break-all">
                {showKey ? apiKey : apiKey.slice(0, 8) + '●●●●●●●●●●●●●●●●●●●●●●●●' + apiKey.slice(-4)}
              </code>
              <button onClick={() => setShowKey(v => !v)} className="text-gray-400 hover:text-gray-600 text-sm">
                {showKey ? '🙈' : '👁️'}
              </button>
              <button onClick={copyKey} className="text-gray-400 hover:text-gray-600 text-sm">
                {copied ? '✅' : '📋'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có API key. Nhấn "Tạo key" để tạo mới.</p>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl shadow border border-gray-100">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">📋 Giao dịch gần đây</h2>
            <Link to="/transactions" className="text-sm text-purple-600 hover:underline">Xem tất cả</Link>
          </div>
          {loadingTx ? (
            <div className="p-8 text-center text-gray-400">⏳ Đang tải...</div>
          ) : recentTx.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Chưa có giao dịch nào</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-lg">📱</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{tx.provider_name}</p>
                    <p className="text-xs text-gray-400">{tx.phone || '—'} · {tx.created_at}</p>
                  </div>
                  <div className="text-right">
                    {statusBadge(tx.status)}
                    {tx.otp && (
                      <p className="text-xs font-mono text-green-600 font-bold mt-0.5">{tx.otp}</p>
                    )}
                  </div>
                  <p className="text-sm text-red-500 font-medium w-20 text-right">
                    -{tx.amount.toLocaleString('vi-VN')}đ
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
