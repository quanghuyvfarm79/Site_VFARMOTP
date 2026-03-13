import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { userAPI } from '../services/api'
import type { Transaction } from '../types'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  success:      { label: 'Thành công', cls: 'bg-green-100 text-green-700' },
  failed:       { label: 'Thất bại',   cls: 'bg-red-100 text-red-700' },
  cancelled:    { label: 'Đã huỷ',     cls: 'bg-gray-100 text-gray-600' },
  waiting_otp:  { label: 'Chờ OTP',    cls: 'bg-yellow-100 text-yellow-700' },
  pending:      { label: 'Chờ xử lý',  cls: 'bg-blue-100 text-blue-700' },
  waiting_phone:{ label: 'Chờ số',     cls: 'bg-orange-100 text-orange-700' },
}

function AmountCell({ tx }: { tx: Transaction }) {
  const isFinal = tx.status === 'failed' || tx.status === 'cancelled'
  if (tx.status === 'success') {
    return <div className="text-right text-red-500 font-medium">-{tx.amount.toLocaleString('vi-VN')}đ</div>
  }
  if (isFinal) {
    if (tx.refunded) {
      return (
        <div className="text-right leading-tight">
          <span className="line-through text-gray-400 text-xs block">-{tx.amount.toLocaleString('vi-VN')}đ</span>
          <span className="text-green-600 font-semibold text-xs">+{tx.amount.toLocaleString('vi-VN')}đ ↩</span>
        </div>
      )
    }
    return (
      <div className="text-right leading-tight">
        <span className="text-red-400 text-xs block">-{tx.amount.toLocaleString('vi-VN')}đ</span>
        <span className="text-yellow-500 text-xs">⏳ Đang hoàn</span>
      </div>
    )
  }
  return <div className="text-right text-gray-400 text-sm">-{tx.amount.toLocaleString('vi-VN')}đ</div>
}

export default function TransactionsPage() {
  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

  useEffect(() => {
    setLoading(true)
    userAPI.getTransactions(page, limit)
      .then(r => { setItems(r.data.items); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.ceil(total / limit)

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Lịch sử giao dịch</h1>
          <p className="text-gray-500 text-sm">Tổng: {total} giao dịch</p>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">⏳ Đang tải...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-400">Chưa có giao dịch nào</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <div className="col-span-1">#</div>
                <div className="col-span-2">Dịch vụ</div>
                <div className="col-span-2">Số điện thoại</div>
                <div className="col-span-2">Mã OTP</div>
                <div className="col-span-2">Trạng thái</div>
                <div className="col-span-1 text-right">Chi phí</div>
                <div className="col-span-2 text-right">Thời gian</div>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map(tx => {
                  const st = STATUS_MAP[tx.status] ?? { label: tx.status, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={tx.id} className="grid grid-cols-12 gap-2 px-5 py-3 hover:bg-gray-50 transition-colors items-center text-sm">
                      <div className="col-span-1 text-gray-400 text-xs">#{tx.id}</div>
                      <div className="col-span-2 font-medium text-gray-700 truncate">{tx.provider_name}</div>
                      <div className="col-span-2 font-mono text-gray-600 text-xs">{tx.phone || '—'}</div>
                      <div className="col-span-2">
                        {tx.otp
                          ? <span className="font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">{tx.otp}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </div>
                      <div className="col-span-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="col-span-1"><AmountCell tx={tx} /></div>
                      <div className="col-span-2 text-right text-gray-400 text-xs">{tx.created_at}</div>
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
