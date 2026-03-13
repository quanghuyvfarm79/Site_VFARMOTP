import axios from 'axios'
import type { Provider, Transaction, User } from '../types'

const api = axios.create({ baseURL: '' })

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 → clear + redirect to login (except login/register endpoints)
api.interceptors.response.use(
  r => r,
  err => {
    const url: string = err.config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),

  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),

  getCurrentAPIKey: () =>
    api.get<{ api_key: string }>('/auth/apikey'),
  generateAPIKey: () =>
    api.post<{ api_key: string }>('/auth/apikey'),
}

// ── User ─────────────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile: () =>
    api.get<User>('/user/profile'),

  getTransactions: (page = 1, limit = 20) =>
    api.get<{ items: Transaction[]; total: number; page: number; limit: number }>(
      `/user/transactions?page=${page}&limit=${limit}`
    ),
  getBalanceLogs: (page = 1, limit = 20, type = '') =>
    api.get<{ items: import('../types').BalanceLog[]; total: number; page: number; limit: number }>(
      `/user/balance-logs?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`
    ),
}

// ── Admin API ────────────────────────────────────────────────────────────────
export interface AdminStats {
  total_users: number
  total_balance: number
  total_transactions: number
  total_revenue: number
  active_sessions: number
  today_transactions: number
  today_revenue: number
  today_new_users: number
  total_topup: number
  success_rate: number
}

export interface ChartPoint {
  date: string
  revenue: number
  topup: number
  otp_success: number
  otp_failed: number
  otp_timeout: number
  otp_bad_phone: number
}

export interface HourlyPoint {
  hour: number
  otp_success: number
  otp_failed: number
  otp_timeout: number
  otp_bad_phone: number
}

export interface TopUser {
  id: number
  email: string
  otp_count: number
  total_spent: number
  balance: number
}

export interface RecentTx {
  id: number
  user_email: string
  provider_name: string
  phone: string
  otp: string
  status: string
  amount: number
  created_at: string
}
export interface AdminUser {
  id: number; email: string; role: string; balance: number; active: boolean; created_at: string
}
export interface AdminUserStats {
  total_topup: number
  total_spent: number
  total_otp: number
  last_login_at: string | null
  last_login_ua: string
}
export interface AdminTransaction {
  id: number; user_email: string; provider_name: string; phone: string
  otp: string; status: string; amount: number; refunded: boolean; created_at: string
}
export interface ProviderForm {
  id?: number
  name: string; url: string; url_otp: string; key_phone: string; key_req_id: string
  key_otp: string; fee: number; timeout: number; time_delay: number
  use_phone_list: boolean; key_error_code: string; error_code_fatal: string; key_otp_done: string; allow_renew: boolean; auto_reset_used: boolean; active: boolean
}

export const adminAPI = {
  getStats: () => api.get<AdminStats>('/admin/stats'),
  getChartStats: (range: '7d' | '30d' | '365d') =>
    api.get<ChartPoint[]>(`/admin/stats/chart?range=${range}`),
  getOTPHourly: () => api.get<HourlyPoint[]>('/admin/stats/otp-hourly'),
  getTopUsers: () => api.get<TopUser[]>('/admin/stats/top-users'),
  getRecentTransactions: () => api.get<RecentTx[]>('/admin/stats/recent'),
  getUsers: (page = 1, limit = 20) =>
    api.get<{ items: AdminUser[]; total: number; page: number; limit: number }>(`/admin/users?page=${page}&limit=${limit}`),
  topupUser: (id: number, amount: number, note: string) =>
    api.post(`/admin/users/${id}/topup`, { amount, note }),
  toggleUser: (id: number) =>
    api.put<{ active: boolean }>(`/admin/users/${id}/toggle`),
  getUserStats: (id: number) =>
    api.get<AdminUserStats>(`/admin/users/${id}/stats`),
  editUser: (id: number, balance: number, role: string) =>
    api.put(`/admin/users/${id}`, { balance, role }),
  deleteUser: (id: number) =>
    api.delete(`/admin/users/${id}`),
  getProviders: () => api.get<import('../types').Provider[]>('/admin/providers'),
  createProvider: (data: ProviderForm) => api.post('/admin/providers', data),
  updateProvider: (id: number, data: ProviderForm) => api.put(`/admin/providers/${id}`, data),
  toggleProvider: (id: number) =>
    api.put<{ active: boolean }>(`/admin/providers/${id}/toggle`),
  deleteProvider: (id: number) => api.delete(`/admin/providers/${id}`),
  getTransactions: (page = 1, limit = 20, status = '', search = '') => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    return api.get<{ items: AdminTransaction[]; total: number; page: number; limit: number }>(`/admin/transactions?${params}`)
  },
  listPhones: (providerId: number, page = 1, limit = 100) =>
    api.get<{ items: PhoneItem[]; total: number; page: number; limit: number }>(`/admin/providers/${providerId}/phones?page=${page}&limit=${limit}`),
  addPhones: (providerId: number, phones: string) =>
    api.post<{ added: number }>(`/admin/providers/${providerId}/phones`, { phones }),
  deletePhone: (providerId: number, phone: string) =>
    api.delete(`/admin/providers/${providerId}/phones/${encodeURIComponent(phone)}`),
  resetUsedPhones: (providerId: number) =>
    api.post<{ reset: number }>(`/admin/providers/${providerId}/phones/reset-used`),
  deleteUsedPhones: (providerId: number) =>
    api.delete<{ deleted: number }>(`/admin/providers/${providerId}/phones/used`),
  deleteBadPhones: (providerId: number) =>
    api.delete<{ deleted: number }>(`/admin/providers/${providerId}/phones/bad`),
  cleanupStuck: () =>
    api.post<{ success: boolean; refunded: number }>('/admin/cleanup-stuck'),
}

export interface PhoneItem {
  id: number; provider_id: number; phone: string; status: string; created_at: string
}

// ── Public OTP API (uses raw api_key) ───────────────────────────────────────
export const otpAPI = {
  getServices: (key: string) =>
    api.get<Provider[]>(`/api/?key=${key}&action=get_all_services`),

  getNumber: (key: string, id: number) =>
    api.get<{ success: boolean; number: string; request_id: string; message?: string }>(`/api/?key=${key}&action=get_number&id=${id}`),

  getCode: (key: string, requestId: string) =>
    api.get<{ success: boolean; otp_code: string }>(`/api/?key=${key}&action=get_code&id=${requestId}`),

  renew: (key: string, requestId: string) =>
    api.get<{ success: boolean; number: string; request_id: string; message: string }>(
      `/api/?key=${key}&action=renew&id=${requestId}`
    ),
}

export default api
