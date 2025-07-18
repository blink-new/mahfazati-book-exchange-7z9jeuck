import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { supabase, hashPassword, verifyPassword, formatMoroccanDate } from '../lib/supabase'
import { User } from '../App'

interface SettingsPageProps {
  user: User
  onLogout: () => void
}

export default function SettingsPage({ user, onLogout }: SettingsPageProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [userStats, setUserStats] = useState({
    totalSpent: 0,
    totalEarned: 0,
    joinDate: ''
  })
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  // تحميل إحصائيات المستخدم
  const loadUserStats = async () => {
    try {
      setIsLoadingStats(true)
      
      // الحصول على تاريخ الانضمام
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('created_at')
        .eq('id', user.id)
        .single()

      if (userError) {
        console.error('Error loading user data:', userError)
      }

      // الحصول على إحصائيات المعاملات
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', user.id)

      if (transError) {
        console.error('Error loading transactions:', transError)
      } else {
        const totalSpent = transactions
          ?.filter(t => t.type === 'purchase')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0
        
        const totalEarned = transactions
          ?.filter(t => t.type === 'sale')
          .reduce((sum, t) => sum + t.amount, 0) || 0

        setUserStats({
          totalSpent,
          totalEarned,
          joinDate: userData?.created_at ? formatMoroccanDate(new Date(userData.created_at)) : 'غير محدد'
        })
      }
    } catch (err) {
      console.error('Error loading user stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }

  useEffect(() => {
    loadUserStats()
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      alert('كلمات المرور الجديدة غير متطابقة')
      return
    }

    if (newPassword.length < 6) {
      alert('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل')
      return
    }

    setIsChangingPassword(true)

    try {
      // الحصول على كلمة المرور الحالية المشفرة
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        throw new Error('فشل في التحقق من كلمة المرور الحالية')
      }

      // التحقق من كلمة المرور الحالية
      const isValidPassword = await verifyPassword(currentPassword, userData.password_hash)
      if (!isValidPassword) {
        throw new Error('كلمة المرور الحالية غير صحيحة')
      }

      // تشفير كلمة المرور الجديدة
      const newPasswordHash = await hashPassword(newPassword)

      // تحديث كلمة المرور
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newPasswordHash })
        .eq('id', user.id)

      if (updateError) {
        throw new Error('فشل في تحديث كلمة المرور')
      }

      alert('تم تغيير كلمة المرور بنجاح!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء تغيير كلمة المرور')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleLogout = () => {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      onLogout()
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">⚙️ الإعدادات</h1>
        <p className="text-gray-600">إدارة حسابك وإعداداتك</p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات الحساب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">رقم الهاتف</span>
            <span className="font-medium">{user.phone}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">الرصيد الحالي</span>
            <span className="font-medium text-blue-600">{user.balance.toFixed(2)} درهم</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">عدد الكتب المشتراة</span>
            <span className="font-medium">{user.booksCount} كتاب</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">تاريخ إنشاء الحساب</span>
            <span className="font-medium">
              {isLoadingStats ? 'جاري التحميل...' : userStats.joinDate}
            </span>
          </div>
          {user.isAdmin && (
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">نوع الحساب</span>
              <span className="font-medium text-yellow-600">👑 مسؤول</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>الإحصائيات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">إجمالي المشتريات</span>
            <span className="font-medium text-red-600">
              {isLoadingStats ? 'جاري التحميل...' : `${userStats.totalSpent.toFixed(2)} درهم`}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">إجمالي المبيعات</span>
            <span className="font-medium text-green-600">
              {isLoadingStats ? 'جاري التحميل...' : `${userStats.totalEarned.toFixed(2)} درهم`}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">الربح/الخسارة</span>
            <span className={`font-medium ${userStats.totalEarned - userStats.totalSpent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {isLoadingStats ? 'جاري التحميل...' : `${(userStats.totalEarned - userStats.totalSpent).toFixed(2)} درهم`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>الأمان</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                🔒 تغيير كلمة المرور
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تغيير كلمة المرور</DialogTitle>
                <DialogDescription>
                  أدخل كلمة المرور الحالية والجديدة
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">كلمة المرور الحالية</label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">كلمة المرور الجديدة</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">تأكيد كلمة المرور الجديدة</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isChangingPassword}>
                  {isChangingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* App Settings */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات التطبيق</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <span>الإشعارات</span>
            <Button variant="outline" size="sm">تفعيل</Button>
          </div>
          <div className="flex justify-between items-center py-2">
            <span>اللغة</span>
            <span className="text-gray-600">العربية</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span>العملة</span>
            <span className="text-gray-600">الدرهم المغربي (MAD)</span>
          </div>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader>
          <CardTitle>الدعم والمساعدة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            ❓ الأسئلة الشائعة
          </Button>
          <Button variant="outline" className="w-full justify-start">
            📞 اتصل بنا
          </Button>
          <Button variant="outline" className="w-full justify-start">
            📧 إرسال ملاحظات
          </Button>
          <Button variant="outline" className="w-full justify-start">
            📋 شروط الاستخدام
          </Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent className="p-4">
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={handleLogout}
          >
            🚪 تسجيل الخروج
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <div className="text-center text-sm text-gray-500 py-4">
        <p>محفظتي - سوق تبادل الكتب</p>
        <p>الإصدار 1.0.0</p>
        <p className="mt-2">تم التطوير بواسطة Blink</p>
      </div>
    </div>
  )
}