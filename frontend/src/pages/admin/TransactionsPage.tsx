import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { adminAPI, type AdminTransaction } from '../../services/api'

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  waiting_otp: 'bg-yellow-100 text-yellow-700',
  waiting_phone: 'bg-blue-100 text-blue-700',
  pending: 'bg-purple-100 text-purple-700',
}
const STATUS_VI: Record<string, string> = {
  success: '✅ Thành công', failed: '❌ Thất bại', cancelled: '⛔ Đã huỷ',
  waiting_otp: '⏳ Chờ OTP', waiting_phone: '📞 Chờ số', pending: '🔄 Đang xử lý',
}
const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'success', label: '✅ Thành công' },
  { value: 'failed', label: '❌ Thất bại' },
  { value: 'pending', label: '🔄 Đang xử lý' },
  { value: 'waiting_otp', label: '⏳ Chờ OTP' },
  { value: 'cancelled', label: '⛔ Đã huỷ' },
]

export default function AdminTransactionsPage() {
  const [items, setItems] = useState<AdminTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const limit = 20

  useEffect(() => {
    setLoading(true)
    adminAPI.getTransactions(page, limit, statusFilter, search)
      .then(r => { setItems(r.data.items); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [page, statusFilter, search])

  function handleStatus(val: string) { setStatusFilter(val); setPage(1) }

  function handleSearchChange(val: string) {
    setSearchInput(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(val.trim()); setPage(1) }, 400)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📋 Tất cả giao dịch</h1>
            <p className="text-gray-500 text-sm">Tổng {total.toLocaleString()} giao dịch</p>
          </div>
          <input value={searchInput} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Tìm email hoặc số điện thoại..."
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => handleStatus(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['ID', 'User', 'Provider', 'Số điện thoại', 'OTP', 'Trạng thái', 'Phí', 'Thời gian'].map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">⏳ Đang tải...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Chưa có giao dịch nào</td></tr>
                ) : items.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">#{tx.id}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{tx.user_email}</td>
                    <td className="px-4 py-3 text-gray-600">{tx.provider_name}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{tx.phone || '—'}</td>
                    <td className="px-4 py-3 font-mono font-bold text-green-600">{tx.otp || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${STATUS_STYLES[tx.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_VI[tx.status] ?? tx.status}
                        </span>
                        {(tx.status === 'failed' || tx.status === 'cancelled') && tx.refunded && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 w-fit">↩ Đã hoàn</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-purple-600">{tx.amount.toLocaleString('vi-VN')}đ</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{tx.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Trang {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Trước</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Tiếp →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
