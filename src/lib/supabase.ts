import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rdyyhmdcqqnwylrsfrsg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkeXlobWRjcXFud3lscnNmcnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjI5MDAsImV4cCI6MjA2ODMzODkwMH0.j4lcAZSG4LxHLPzt6Bv9qrVMBKNNymYCLgf3AeqIdzQ'

// Configure Supabase client for database-only usage (no auth)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storage: undefined // Disable auth storage completely
  },
  global: {
    headers: {
      'apikey': supabaseKey
    }
  }
})

// أنواع البيانات
export interface User {
  id: string
  phone: string
  password_hash: string
  balance: number
  books_count: number
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Book {
  id: string
  title: string
  author: string
  price: number
  seller_id: string
  seller_name: string
  seller_phone: string
  city: string
  image_url?: string
  description?: string
  status: 'available' | 'sold'
  is_advertisement?: boolean
  advertisement_type?: string
  advertisement_duration?: number
  advertisement_expires_at?: string
  created_at: string
  updated_at: string
}

export interface PurchasedBook {
  id: string
  user_id: string
  book_id: string
  original_title: string
  original_author: string
  purchase_price: number
  purchase_date: string
  status: 'owned' | 'for_sale' | 'sold'
  sale_price?: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  type: 'purchase' | 'sale' | 'balance_add' | 'transfer_sent' | 'transfer_received'
  amount: number
  description?: string
  book_id?: string
  created_at: string
}

// دوال المساعدة
export const hashPassword = async (password: string): Promise<string> => {
  // في التطبيق الحقيقي، يجب استخدام bcrypt أو مكتبة تشفير قوية
  // هنا نستخدم تشفير بسيط للتجربة فقط
  return btoa(password)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return btoa(password) === hash
}

export const formatMoroccanDate = (date: Date): string => {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'
  ]
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

// Validate UUID format
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}