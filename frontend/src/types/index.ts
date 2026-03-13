export interface User {
  id: number
  email: string
  role: string
  balance: number
}

export interface Provider {
  id: number
  name: string
  price: number   // alias for fee in public API
  fee: number
  timeout: number
  time_delay: number
  url: string
  url_otp: string
  key_phone: string
  key_req_id: string
  key_otp: string
  use_phone_list: boolean
  key_error_code: string
  error_code_fatal: string
  key_otp_done: string
  allow_renew: boolean
  auto_reset_used: boolean
  active: boolean
  phone_available?: number
  phone_used?: number
  phone_bad?: number
  phone_total?: number
}

export interface Transaction {
  id: number
  provider_name: string
  phone: string
  otp: string
  status: 'pending' | 'waiting_phone' | 'waiting_otp' | 'success' | 'failed' | 'cancelled'
  amount: number
  refunded: boolean
  created_at: string
}

export interface BalanceLog {
  id: number
  type: 'topup' | 'deduct' | 'refund'
  amount: number
  ref_id: number | null
  note: string
  created_at: string
}

export interface OTPSession {
  phone: string
  request_id: string
  provider_id: number
  started_at: number // Date.now()
  timeout: number    // seconds
}

export type OTPCode = 'is_comming' | 'timeout' | string
