import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { supabase, type Book, formatMoroccanDate } from '../lib/supabase'
import { User } from '../App'

interface MarketplacePageProps {
  user: User
}

export default function MarketplacePage({ user }: MarketplacePageProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const cities = ['الكل', 'الرباط', 'الدار البيضاء', 'فاس', 'مراكش', 'طنجة', 'أكادير', 'مكناس', 'وجدة']

  // تحميل الكتب من قاعدة البيانات
  const loadBooks = async () => {
    try {
      setIsLoading(true)
      
      // Load books from the main books table, prioritizing advertisements
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('*')
        .eq('status', 'available')
        .order('is_advertisement', { ascending: false })
        .order('created_at', { ascending: false })

      if (booksError) {
        throw new Error('فشل في تحميل الكتب')
      }

      // Load books from user library that are marked for marketplace
      const { data: libraryData, error: libraryError } = await supabase
        .from('user_library')
        .select(`
          id,
          title,
          author,
          description,
          image_url,
          city,
          condition,
          marketplace_price,
          created_at,
          user_id,
          users!inner(phone)
        `)
        .eq('is_in_marketplace', true)
        .order('created_at', { ascending: false })

      if (libraryError) {
        console.warn('فشل في تحميل كتب المكتبة الشخصية:', libraryError)
      }

      // Transform library books to match Book interface
      const transformedLibraryBooks = (libraryData || []).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        price: book.marketplace_price || 0,
        seller_id: book.user_id,
        seller_name: `مستخدم ${book.users.phone}`,
        seller_phone: book.users.phone,
        city: book.city,
        image_url: book.image_url,
        description: book.description || `كتاب في حالة ${book.condition}`,
        status: 'available' as const,
        created_at: book.created_at,
        updated_at: book.created_at
      }))

      // Combine both sources
      const allBooks = [...(booksData || []), ...transformedLibraryBooks]
      setBooks(allBooks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setIsLoading(false)
    }
  }

  // تصفية الكتب
  useEffect(() => {
    const filtered = books.filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           book.author.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCity = selectedCity === 'all' || selectedCity === 'الكل' || book.city === selectedCity
      return matchesSearch && matchesCity
    })
    setFilteredBooks(filtered)
  }, [books, searchQuery, selectedCity])

  useEffect(() => {
    loadBooks()
  }, [])

  const handleCallSeller = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  const handleBuyBook = async (book: Book) => {
    if (user.balance < book.price) {
      alert('رصيدك غير كافي لشراء هذا الكتاب')
      return
    }

    if (book.seller_id === user.id) {
      alert('لا يمكنك شراء كتابك الخاص')
      return
    }

    try {
      // بدء المعاملة
      const { error: updateBookError } = await supabase
        .from('books')
        .update({ status: 'sold' })
        .eq('id', book.id)

      if (updateBookError) {
        throw new Error('فشل في تحديث حالة الكتاب')
      }

      // تحديث رصيد المشتري
      const { error: updateBuyerError } = await supabase
        .from('users')
        .update({ 
          balance: user.balance - book.price,
          books_count: user.booksCount + 1
        })
        .eq('id', user.id)

      if (updateBuyerError) {
        throw new Error('فشل في تحديث رصيد المشتري')
      }

      // تحديث رصيد البائع
      const { error: updateSellerError } = await supabase
        .from('users')
        .update({ balance: supabase.sql`balance + ${book.price}` })
        .eq('id', book.seller_id)

      if (updateSellerError) {
        throw new Error('فشل في تحديث رصيد البائع')
      }

      // إضافة الكتاب للكتب المشتراة
      const { error: purchaseError } = await supabase
        .from('purchased_books')
        .insert([
          {
            user_id: user.id,
            book_id: book.id,
            original_title: book.title,
            original_author: book.author,
            purchase_price: book.price,
            status: 'owned'
          }
        ])

      if (purchaseError) {
        throw new Error('فشل في إضافة الكتاب للمشتريات')
      }

      // إضافة معاملة الشراء
      await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            type: 'purchase',
            amount: -book.price,
            description: `شراء كتاب: ${book.title}`,
            book_id: book.id
          }
        ])

      // إضافة معاملة البيع للبائع
      await supabase
        .from('transactions')
        .insert([
          {
            user_id: book.seller_id,
            type: 'sale',
            amount: book.price,
            description: `بيع كتاب: ${book.title}`,
            book_id: book.id
          }
        ])

      alert(`تم شراء كتاب "${book.title}" بنجاح!`)
      
      // تحديث البيانات المحلية
      user.balance -= book.price
      user.booksCount += 1
      
      // إعادة تحميل الكتب
      loadBooks()
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء الشراء')
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-blue-600 mb-2">📚 سوق الكتب</h1>
          <p className="text-gray-600">جاري تحميل الكتب...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex">
                  <div className="w-24 h-32 bg-gray-200 rounded"></div>
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
          <h1 className="text-2xl font-bold text-blue-600 mb-2">📚 سوق الكتب</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-red-600">
            <div className="text-4xl mb-2">⚠️</div>
            <p>{error}</p>
            <Button onClick={loadBooks} className="mt-4">
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
        <h1 className="text-2xl font-bold text-blue-600 mb-2">📚 سوق الكتب</h1>
        <p className="text-gray-600">اكتشف واشتري الكتب من المستخدمين الآخرين</p>
        <p className="text-sm text-blue-600 mt-1">رصيدك الحالي: {user.balance} درهم</p>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Input
              placeholder="ابحث عن كتاب أو مؤلف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المدينة" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city} value={city === 'الكل' ? 'all' : city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Books Grid */}
      <div className="space-y-4">
        {filteredBooks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📚</div>
              <p>لا توجد كتب متاحة</p>
              <p className="text-sm">جرب البحث بكلمات أخرى أو غير المدينة</p>
            </CardContent>
          </Card>
        ) : (
          filteredBooks.map((book) => (
            <Card key={book.id} className={`overflow-hidden ${book.is_advertisement ? 'ring-2 ring-yellow-400 shadow-lg' : ''}`}>
              <CardContent className="p-0">
                {book.is_advertisement && (
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs px-3 py-1 flex items-center">
                    <span className="mr-1">🎯</span>
                    <span>إعلان مميز</span>
                  </div>
                )}
                <div className="flex">
                  <img
                    src={book.image_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop'}
                    alt={book.title}
                    className="w-24 h-32 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop'
                    }}
                  />
                  <div className="flex-1 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{book.title}</h3>
                        <p className="text-gray-600 text-sm">{book.author}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${book.is_advertisement ? 'text-orange-600' : 'text-blue-600'}`}>
                          {book.price} درهم
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <span>📍 {book.city}</span>
                      <span>👤 {book.seller_name}</span>
                    </div>

                    {book.description && (
                      <p className="text-sm text-gray-600 mb-3">{book.description}</p>
                    )}

                    <div className="text-xs text-gray-400 mb-3">
                      تاريخ النشر: {formatMoroccanDate(new Date(book.created_at))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCallSeller(book.seller_phone)}
                        className="flex-1"
                      >
                        📞 اتصل بالبائع
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleBuyBook(book)}
                        className="flex-1"
                        disabled={user.balance < book.price || book.seller_id === user.id}
                      >
                        {book.seller_id === user.id ? '🚫 كتابك' : 
                         user.balance < book.price ? '💸 رصيد غير كافي' : '💰 اشتري الآن'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Refresh Button */}
      <div className="text-center">
        <Button variant="outline" onClick={loadBooks}>
          🔄 تحديث القائمة
        </Button>
      </div>
    </div>
  )
}