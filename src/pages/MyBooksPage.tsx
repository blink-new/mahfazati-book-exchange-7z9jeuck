import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Input } from '../components/ui/input'
import { supabase, type PurchasedBook, formatMoroccanDate } from '../lib/supabase'
import { User } from '../App'

interface MyBooksPageProps {
  user: User
}

interface LibraryBook {
  id: string
  user_id: string
  title: string
  author: string
  description?: string
  image_url?: string
  city: string
  condition: string
  is_in_marketplace: boolean
  marketplace_price?: number
  created_at: string
  updated_at: string
}

export default function MyBooksPage({ user }: MyBooksPageProps) {
  const [purchasedBooks, setPurchasedBooks] = useState<PurchasedBook[]>([])
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Load purchased books
  const loadPurchasedBooks = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('purchased_books')
        .select('*')
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false })

      if (fetchError) {
        throw new Error('فشل في تحميل الكتب المشتراة')
      }

      setPurchasedBooks(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    }
  }

  // Load personal library
  const loadLibraryBooks = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_library')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw new Error('فشل في تحميل مكتبتك الشخصية')
      }

      setLibraryBooks(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    }
  }

  // Load all data
  const loadAllData = async () => {
    setIsLoading(true)
    await Promise.all([loadPurchasedBooks(), loadLibraryBooks()])
    setIsLoading(false)
  }

  useEffect(() => {
    loadAllData()
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Add library book to marketplace
  const handleAddToMarketplace = async (book: LibraryBook, isAdvertisement = false) => {
    const price = prompt(`كم تريد أن تبيع كتاب "${book.title}"؟ (بالدرهم)`)
    
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert('يرجى إدخال سعر صحيح')
      return
    }

    let advertisementDuration = '7'
    let advertisementExpiresAt = null

    if (isAdvertisement) {
      const duration = prompt('كم يوم تريد أن يظهر كإعلان مميز؟ (3، 7، 14، أو 30)', '7')
      if (!duration || !['3', '7', '14', '30'].includes(duration)) {
        alert('يرجى اختيار مدة صحيحة (3، 7، 14، أو 30 يوم)')
        return
      }
      advertisementDuration = duration
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + parseInt(advertisementDuration))
      advertisementExpiresAt = expiryDate.toISOString()
    }

    try {
      // Get user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('phone')
        .eq('id', user.id)
        .single()

      if (userError) {
        throw new Error('فشل في الحصول على معلومات المستخدم')
      }

      // Add to marketplace
      const { error: insertError } = await supabase
        .from('books')
        .insert([
          {
            title: book.title,
            author: book.author,
            price: parseFloat(price),
            seller_id: user.id,
            seller_name: `مستخدم ${userData.phone}`,
            seller_phone: userData.phone,
            city: book.city,
            image_url: book.image_url,
            description: book.description || `كتاب في حالة ${book.condition}`,
            status: 'available',
            is_advertisement: isAdvertisement,
            advertisement_type: isAdvertisement ? 'premium' : null,
            advertisement_duration: isAdvertisement ? parseInt(advertisementDuration) : null,
            advertisement_expires_at: advertisementExpiresAt
          }
        ])

      if (insertError) {
        throw new Error('فشل في إضافة الكتاب للسوق')
      }

      // Update library book status
      const { error: updateError } = await supabase
        .from('user_library')
        .update({ 
          is_in_marketplace: true,
          marketplace_price: parseFloat(price)
        })
        .eq('id', book.id)

      if (updateError) {
        throw new Error('فشل في تحديث حالة الكتاب')
      }

      const message = isAdvertisement 
        ? `تم عرض الكتاب كإعلان مميز في السوق لمدة ${advertisementDuration} أيام!`
        : 'تم عرض الكتاب في السوق بنجاح!'
      
      alert(message)
      loadLibraryBooks()
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء عرض الكتاب')
    }
  }

  // Remove library book from marketplace
  const handleRemoveFromMarketplace = async (book: LibraryBook) => {
    if (!confirm('هل أنت متأكد من إزالة الكتاب من السوق؟')) {
      return
    }

    try {
      // Remove from marketplace
      const { error: deleteError } = await supabase
        .from('books')
        .delete()
        .eq('seller_id', user.id)
        .eq('title', book.title)
        .eq('author', book.author)

      if (deleteError) {
        throw new Error('فشل في إزالة الكتاب من السوق')
      }

      // Update library book status
      const { error: updateError } = await supabase
        .from('user_library')
        .update({ 
          is_in_marketplace: false,
          marketplace_price: null
        })
        .eq('id', book.id)

      if (updateError) {
        throw new Error('فشل في تحديث حالة الكتاب')
      }

      alert('تم إزالة الكتاب من السوق')
      loadLibraryBooks()
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء إزالة الكتاب')
    }
  }

  // Delete library book
  const handleDeleteLibraryBook = async (book: LibraryBook) => {
    if (!confirm(`هل أنت متأكد من حذف كتاب "${book.title}" من مكتبتك؟`)) {
      return
    }

    try {
      // If book is in marketplace, remove it first
      if (book.is_in_marketplace) {
        await supabase
          .from('books')
          .delete()
          .eq('seller_id', user.id)
          .eq('title', book.title)
          .eq('author', book.author)
      }

      // Delete from library
      const { error: deleteError } = await supabase
        .from('user_library')
        .delete()
        .eq('id', book.id)

      if (deleteError) {
        throw new Error('فشل في حذف الكتاب')
      }

      alert('تم حذف الكتاب من مكتبتك')
      loadLibraryBooks()
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء حذف الكتاب')
    }
  }

  const getStatusBadge = (status: PurchasedBook['status']) => {
    switch (status) {
      case 'owned':
        return <Badge variant="secondary">مملوك</Badge>
      case 'for_sale':
        return <Badge variant="default">معروض للبيع</Badge>
      case 'sold':
        return <Badge variant="outline">مباع</Badge>
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-blue-600 mb-2">📖 كتبي</h1>
          <p className="text-gray-600">جاري تحميل كتبك...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex">
                  <div className="w-20 h-28 bg-gray-200 rounded"></div>
                  <div className="flex-1 mr-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-blue-600 mb-2">📖 كتبي</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-red-600">
            <div className="text-4xl mb-2">⚠️</div>
            <p>{error}</p>
            <Button onClick={loadAllData} className="mt-4">
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">📖 كتبي</h1>
        <p className="text-gray-600">إدارة مكتبتك الشخصية والكتب المشتراة</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{libraryBooks.length}</div>
            <div className="text-sm text-gray-600">مكتبتي الشخصية</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{purchasedBooks.length}</div>
            <div className="text-sm text-gray-600">كتب مشتراة</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library">📚 مكتبتي الشخصية ({libraryBooks.length})</TabsTrigger>
          <TabsTrigger value="purchased">🛒 كتب مشتراة ({purchasedBooks.length})</TabsTrigger>
        </TabsList>

        {/* Personal Library Tab */}
        <TabsContent value="library" className="space-y-4">
          {libraryBooks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold mb-2">مكتبتك فارغة</h3>
                <p className="mb-4">ابدأ بإضافة الكتب التي تملكها</p>
                <Button>
                  ➕ إضافة كتاب جديد
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {libraryBooks.map((book) => (
                <Card key={book.id}>
                  <CardContent className="p-0">
                    <div className="flex">
                      {book.image_url ? (
                        <img
                          src={book.image_url}
                          alt={book.title}
                          className="w-20 h-28 object-cover rounded-r"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            target.parentElement!.innerHTML = '<div class="w-20 h-28 bg-gray-200 rounded-r flex items-center justify-center text-gray-500 text-xs">📚</div>'
                          }}
                        />
                      ) : (
                        <div className="w-20 h-28 bg-gray-200 rounded-r flex items-center justify-center text-gray-500 text-xs">
                          📚
                        </div>
                      )}
                      <div className="flex-1 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{book.title}</h3>
                            <p className="text-gray-600 text-sm">{book.author}</p>
                          </div>
                          <div className="text-right">
                            {book.is_in_marketplace ? (
                              <Badge variant="default">في السوق - {book.marketplace_price} درهم</Badge>
                            ) : (
                              <Badge variant="secondary">في المكتبة</Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-500 mb-3">
                          <p>📍 {book.city} • حالة: {book.condition}</p>
                          <p>تاريخ الإضافة: {formatMoroccanDate(new Date(book.created_at))}</p>
                        </div>

                        {book.description && (
                          <p className="text-sm text-gray-600 mb-3">{book.description}</p>
                        )}

                        <div className="flex gap-2">
                          {!book.is_in_marketplace ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAddToMarketplace(book, false)}
                                className="flex-1"
                              >
                                🏪 عرض في السوق
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToMarketplace(book, true)}
                                className="flex-1 border-yellow-400 text-yellow-600 hover:bg-yellow-50"
                              >
                                🎯 إعلان مميز
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveFromMarketplace(book)}
                              className="flex-1"
                            >
                              ❌ إزالة من السوق
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteLibraryBook(book)}
                          >
                            🗑️ حذف
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Purchased Books Tab */}
        <TabsContent value="purchased" className="space-y-4">
          {purchasedBooks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <div className="text-6xl mb-4">🛒</div>
                <h3 className="text-xl font-semibold mb-2">لا توجد كتب مشتراة</h3>
                <p className="mb-4">لم تشتري أي كتب من السوق بعد</p>
                <Button>
                  📚 تصفح السوق
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {purchasedBooks.map((book) => (
                <Card key={book.id}>
                  <CardContent className="p-0">
                    <div className="flex">
                      <div className="w-20 h-28 bg-gray-200 rounded-r flex items-center justify-center text-gray-500 text-xs">
                        📚
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{book.original_title}</h3>
                            <p className="text-gray-600 text-sm">{book.original_author}</p>
                          </div>
                          {getStatusBadge(book.status)}
                        </div>
                        
                        <div className="text-sm text-gray-500 mb-3">
                          <p>تاريخ الشراء: {formatMoroccanDate(new Date(book.purchase_date))}</p>
                          <p>سعر الشراء: {book.purchase_price} درهم</p>
                          {book.status === 'for_sale' && book.sale_price && (
                            <p className="text-green-600">سعر البيع: {book.sale_price} درهم</p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {book.status === 'owned' && (
                            <Button
                              size="sm"
                              onClick={() => {/* handleSellBook(book) */}}
                              className="flex-1"
                            >
                              💰 عرض للبيع
                            </Button>
                          )}
                          {book.status === 'for_sale' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {/* handleRemoveFromSale(book) */}}
                              className="flex-1"
                            >
                              ❌ إزالة من السوق
                            </Button>
                          )}
                          {book.status === 'sold' && (
                            <div className="flex-1 text-center text-sm text-gray-500 py-2">
                              تم البيع بنجاح ✅
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <div className="text-center">
        <Button variant="outline" onClick={loadAllData}>
          🔄 تحديث القوائم
        </Button>
      </div>
    </div>
  )
}