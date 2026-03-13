import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { userAPI } from '../services/api'
import type { BalanceLog } from '../types'

const TYPE_MAP: Record<string, { label: string; icon: string; cls: string; sign: string }> = {
  topup:  { label: 'Nạp tiền',   icon: '💳', cls: 'bg-green-100 text-green-700',  sign: '+' },
  refund: { label: 'Hoàn tiền',  icon: '↩️',  cls: 'bg-blue-100 text-blue-700',   sign: '+' },
  deduct: { label: 'Thanh toán', icon: '💸', cls: 'bg-red-100 text-red-700',     sign: '-' },
}

const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'topup', label: 'Nạp tiền' },
  { value: 'deduct', label: 'Thanh toán' },
  { value: 'refund', label: 'Hoàn tiền' },
]

export default function BalancePage() {
  const [items, setItems] = useState<BalanceLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const limit = 20

  useEffect(() => {
    setLoading(true)
    userAPI.getBalanceLogs(page, limit, typeFilter)
      .then(r => { setItems(r.data.items); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [page, typeFilter])

  function handleFilter(val: string) {
    setTypeFilter(val)
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💰 Biến động số dư</h1>
          <p className="text-gray-500 text-sm">Toàn bộ lịch sử nạp tiền, hoàn tiền, thanh toán</p>
        </div>

        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => handleFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${typeFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">⏳ Đang tải...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">🏦</p>
              <p className="text-gray-400">Chưa có biến động số dư</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <div className="col-span-1">#</div>
                <div className="col-span-2">Loại</div>
                <div className="col-span-5">Ghi chú</div>
                <div className="col-span-2 text-right">Số tiền</div>
                <div className="col-span-2 text-right">Thời gian</div>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map(log => {
                  const t = TYPE_MAP[log.type] ?? { label: log.type, icon: '•', cls: 'bg-gray-100 text-gray-500', sign: '' }
                  const isPositive = log.type === 'topup' || log.type === 'refund'
                  return (
                    <div key={log.id} className="grid grid-cols-12 gap-2 px-5 py-3.5 hover:bg-gray-50 transition-colors items-center text-sm">
                      <div className="col-span-1 text-gray-400 text-xs">#{log.id}</div>
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${t.cls}`}>
                          {t.icon} {t.label}
                        </span>
                      </div>
                      <div className="col-span-5 text-gray-500 text-xs truncate">
                        {log.note || '—'}
                        {log.ref_id && (
                          <span className="ml-1 text-gray-400">(GD #{log.ref_id})</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right font-semibold">
                        <span className={isPositive ? 'text-green-600' : 'text-red-500'}>
                          {t.sign}{log.amount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-gray-400 text-xs">{log.created_at}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">← Trước</button>
            <span className="px-4 py-2 text-sm text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Sau →</button>
          </div>
        )}
      </div>
    </Layout>
  )
}
