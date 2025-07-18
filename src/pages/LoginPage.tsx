import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { supabase, hashPassword, verifyPassword, type User } from '../lib/supabase'
import { User as AppUser } from '../App'

interface LoginPageProps {
  onLogin: (user: AppUser) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // التحقق من حساب الإدارة الخاص
      if (phone === '0672727961' && password === '0672727961') {
        // البحث عن حساب الإدارة أو إنشاؤه
        const { data: adminUser, error: adminFetchError } = await supabase
          .from('users')
          .select('*')
          .eq('phone', phone)
          .limit(1)

        if (adminFetchError) {
          throw new Error('خطأ في الاتصال بقاعدة البيانات')
        }

        // إنشاء حساب الإدارة إذا لم يكن موجوداً
        if (!adminUser || adminUser.length === 0) {
          const passwordHash = await hashPassword(password)
          const { data: newAdminUser, error: insertError } = await supabase
            .from('users')
            .insert([
              {
                phone,
                password_hash: passwordHash,
                balance: 10000.00, // رصيد كبير للإدارة
                books_count: 0,
                is_admin: true
              }
            ])
            .select()
            .single()

          if (insertError) {
            throw new Error('فشل في إنشاء حساب الإدارة')
          }
          adminUser = [newAdminUser]
        }

        const user = adminUser[0] as User
        const appUser: AppUser = {
          id: user.id,
          phone: user.phone,
          balance: user.balance,
          booksCount: user.books_count,
          isAdmin: true
        }

        onLogin(appUser)
        return
      }

      // البحث عن المستخدم العادي في قاعدة البيانات
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .limit(1)

      if (fetchError) {
        throw new Error('خطأ في الاتصال بقاعدة البيانات')
      }

      if (!users || users.length === 0) {
        throw new Error('رقم الهاتف غير مسجل')
      }

      const user = users[0] as User
      
      // التحقق من كلمة المرور
      const isValidPassword = await verifyPassword(password, user.password_hash)
      if (!isValidPassword) {
        throw new Error('كلمة المرور غير صحيحة')
      }

      // تحويل بيانات المستخدم للتطبيق
      const appUser: AppUser = {
        id: user.id,
        phone: user.phone,
        balance: user.balance,
        booksCount: user.books_count,
        isAdmin: user.is_admin || false
      }

      onLogin(appUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('كلمات المرور غير متطابقة')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      setIsLoading(false)
      return
    }

    try {
      // التحقق من عدم وجود المستخدم مسبقاً
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .limit(1)

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('رقم الهاتف مسجل مسبقاً')
      }

      // تشفير كلمة المرور
      const passwordHash = await hashPassword(password)

      // إنشاء المستخدم الجديد
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            phone,
            password_hash: passwordHash,
            balance: 100.00, // رصيد ابتدائي
            books_count: 0,
            is_admin: false
          }
        ])
        .select()
        .single()

      if (insertError) {
        throw new Error('فشل في إنشاء الحساب')
      }

      // تحويل بيانات المستخدم للتطبيق
      const appUser: AppUser = {
        id: newUser.id,
        phone: newUser.phone,
        balance: newUser.balance,
        booksCount: newUser.books_count,
        isAdmin: newUser.is_admin || false
      }

      onLogin(appUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">📚 محفظتي</h1>
          <p className="text-gray-600">سوق تبادل الكتب</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">مرحباً بك</CardTitle>
            <CardDescription>سجل دخولك أو أنشئ حساباً جديداً</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="register">حساب جديد</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">رقم الهاتف</label>
                    <Input
                      type="tel"
                      placeholder="0612345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="text-right"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">كلمة المرور</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">رقم الهاتف</label>
                    <Input
                      type="tel"
                      placeholder="0612345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="text-right"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">كلمة المرور</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">تأكيد كلمة المرور</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-4 text-center text-sm text-gray-500">
              <p>للتجربة، يمكنك استخدام:</p>
              <p>الهاتف: 0612345678 | كلمة المرور: 123456</p>
              <p className="text-xs text-blue-600 mt-2">لوحة التحكم: 0672727961 | كلمة المرور: 0672727961</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}