import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { supabase, type Transaction, formatMoroccanDate, isValidUUID } from '../lib/supabase'
import { User } from '../App'

interface HomePageProps {
  user: User
}

export default function HomePage({ user }: HomePageProps) {
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true)


  const formatDate = () => {
    return formatMoroccanDate(new Date())
  }

  // تحميل المعاملات الأخيرة
  const loadRecentTransactions = useCallback(async () => {
    try {
      setIsLoadingTransactions(true)
      
      // Validate user ID format before making the request
      if (!user.id || !isValidUUID(user.id)) {
        console.error('Invalid user ID format:', user.id)
        setRecentTransactions([])
        return
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Error loading transactions:', error)
        setRecentTransactions([])
      } else {
        setRecentTransactions(data || [])
      }
    } catch (err) {
      console.error('Error loading transactions:', err)
      setRecentTransactions([])
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [user.id])

  useEffect(() => {
    loadRecentTransactions()
  }, [user.id, loadRecentTransactions])



  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return '📚'
      case 'sale':
        return '💰'
      case 'balance_add':
        return '💳'
      case 'transfer_sent':
        return '📤'
      case 'transfer_received':
        return '📥'
      default:
        return '📝'
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'transfer_sent':
        return 'text-red-600'
      case 'sale':
      case 'balance_add':
      case 'transfer_received':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">📚 محفظتي</h1>
        <p className="text-gray-600">{formatDate()}</p>
      </div>

      {/* Wallet Card */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>💳 محفظتي الإلكترونية</span>
            <span className="text-sm opacity-90">رقم الهاتف: {user.phone}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm opacity-90">الرصيد الحالي</p>
              <p className="text-3xl font-bold">{user.balance.toFixed(2)} درهم</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">عدد الكتب</p>
              <p className="text-2xl font-bold">{user.booksCount} كتاب</p>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <div className="text-3xl mb-2">📚</div>
            <h3 className="font-semibold mb-1">سوق الكتب</h3>
            <p className="text-sm text-gray-600">تصفح واشتري الكتب</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <div className="text-3xl mb-2">💸</div>
            <h3 className="font-semibold mb-1">تحويل رصيد</h3>
            <p className="text-sm text-gray-600">حول الرصيد بسهولة</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>📊 النشاط الأخير</span>
            <Button variant="ghost" size="sm" onClick={loadRecentTransactions}>
              🔄
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📝</div>
              <p>لا توجد أنشطة حديثة</p>
              <p className="text-sm">ابدأ بشراء كتابك الأول!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getTransactionIcon(transaction.type)}</span>
                    <div>
                      <p className="font-medium text-sm">{transaction.description}</p>
                      <p className="text-xs text-gray-500">
                        {formatMoroccanDate(new Date(transaction.created_at))}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold ${getTransactionColor(transaction.type)}`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount} درهم
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* App Info */}
      {user.isAdmin && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">👑</div>
            <p className="text-sm text-yellow-800">
              أنت مسؤول في التطبيق
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}