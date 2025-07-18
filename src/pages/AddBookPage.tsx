import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Switch } from '../components/ui/switch'
import { supabase } from '../lib/supabase'
import { User } from '../App'

interface AddBookPageProps {
  user: User
}

export default function AddBookPage({ user }: AddBookPageProps) {
  // Personal Library Form
  const [libraryTitle, setLibraryTitle] = useState('')
  const [libraryAuthor, setLibraryAuthor] = useState('')
  const [libraryDescription, setLibraryDescription] = useState('')
  const [libraryImage, setLibraryImage] = useState('')
  const [libraryCity, setLibraryCity] = useState('')
  const [libraryCondition, setLibraryCondition] = useState('جيدة')

  // Direct Marketplace Form
  const [marketTitle, setMarketTitle] = useState('')
  const [marketAuthor, setMarketAuthor] = useState('')
  const [marketPrice, setMarketPrice] = useState('')
  const [marketCity, setMarketCity] = useState('')
  const [marketDescription, setMarketDescription] = useState('')
  const [marketImage, setMarketImage] = useState('')

  // Advertisement features
  const [isAdvertisement, setIsAdvertisement] = useState(false)
  const [advertisementDuration, setAdvertisementDuration] = useState('7')

  // Camera functionality
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const cities = ['الرباط', 'الدار البيضاء', 'فاس', 'مراكش', 'طنجة', 'أكادير', 'مكناس', 'وجدة']
  const conditions = ['ممتازة', 'جيدة جداً', 'جيدة', 'مقبولة']
  const advertisementDurations = [
    { value: '3', label: '3 أيام' },
    { value: '7', label: '7 أيام (مستحسن)' },
    { value: '14', label: '14 يوم' },
    { value: '30', label: '30 يوم' }
  ]

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera if available
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsScanning(true)
      }
    } catch (err) {
      alert('فشل في الوصول للكاميرا. تأكد من السماح بالوصول للكاميرا.')
      console.error('Camera error:', err)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        setMarketImage(imageData)
        stopCamera()
        alert('تم التقاط الصورة بنجاح!')
      }
    }
  }

  // Add book to personal library
  const handleAddToLibrary = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('user_library')
        .insert([
          {
            user_id: user.id,
            title: libraryTitle,
            author: libraryAuthor,
            description: libraryDescription || null,
            image_url: libraryImage || null,
            city: libraryCity,
            condition: libraryCondition,
            is_in_marketplace: false
          }
        ])

      if (insertError) {
        throw new Error('فشل في إضافة الكتاب لمكتبتك')
      }

      alert('تم إضافة الكتاب لمكتبتك الشخصية بنجاح!')
      
      // Reset form
      setLibraryTitle('')
      setLibraryAuthor('')
      setLibraryDescription('')
      setLibraryImage('')
      setLibraryCity('')
      setLibraryCondition('جيدة')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setIsLoading(false)
    }
  }

  // Add book directly to marketplace
  const handleAddToMarketplace = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

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

      // Calculate advertisement expiry date
      let advertisementExpiresAt = null
      if (isAdvertisement) {
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + parseInt(advertisementDuration))
        advertisementExpiresAt = expiryDate.toISOString()
      }

      // Add book directly to marketplace
      const { error: insertError } = await supabase
        .from('books')
        .insert([
          {
            title: marketTitle,
            author: marketAuthor,
            price: parseFloat(marketPrice),
            seller_id: user.id,
            seller_name: `مستخدم ${userData.phone}`,
            seller_phone: userData.phone,
            city: marketCity,
            image_url: marketImage || null,
            description: marketDescription || null,
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

      const message = isAdvertisement 
        ? `تم إضافة الإعلان المميز للسوق! سيظهر في أعلى القائمة لمدة ${advertisementDuration} أيام.`
        : 'تم إضافة الكتاب للسوق مباشرة!'
      
      alert(message)
      
      // Reset form
      setMarketTitle('')
      setMarketAuthor('')
      setMarketPrice('')
      setMarketCity('')
      setMarketDescription('')
      setMarketImage('')
      setIsAdvertisement(false)
      setAdvertisementDuration('7')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">➕ إضافة كتاب</h1>
        <p className="text-gray-600">أضف كتاباً لمكتبتك الشخصية أو للسوق مباشرة</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library">📚 مكتبتي الشخصية</TabsTrigger>
          <TabsTrigger value="marketplace">🏪 السوق مباشرة</TabsTrigger>
        </TabsList>

        {/* Personal Library Tab */}
        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إضافة كتاب لمكتبتي الشخصية</CardTitle>
              <p className="text-sm text-gray-600">
                أضف الكتب التي تملكها لمكتبتك الشخصية، ويمكنك عرضها للبيع لاحقاً
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddToLibrary} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">عنوان الكتاب *</label>
                  <Input
                    placeholder="مثال: الأسود يليق بك"
                    value={libraryTitle}
                    onChange={(e) => setLibraryTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">اسم المؤلف *</label>
                  <Input
                    placeholder="مثال: أحلام مستغانمي"
                    value={libraryAuthor}
                    onChange={(e) => setLibraryAuthor(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">المدينة *</label>
                  <Select value={libraryCity} onValueChange={setLibraryCity} required>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">حالة الكتاب</label>
                  <Select value={libraryCondition} onValueChange={setLibraryCondition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conditions.map((condition) => (
                        <SelectItem key={condition} value={condition}>
                          {condition}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">رابط صورة الغلاف (اختياري)</label>
                  <Input
                    type="url"
                    placeholder="https://example.com/book-cover.jpg"
                    value={libraryImage}
                    onChange={(e) => setLibraryImage(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    اختياري - يمكنك إضافة الكتاب بدون صورة
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">وصف الكتاب (اختياري)</label>
                  <Textarea
                    placeholder="وصف مختصر عن الكتاب وحالته..."
                    value={libraryDescription}
                    onChange={(e) => setLibraryDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'جاري الإضافة...' : '📚 إضافة لمكتبتي'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Direct Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إضافة كتاب للسوق مباشرة</CardTitle>
              <p className="text-sm text-gray-600">
                أضف كتاباً للبيع في السوق مباشرة - سيظهر لجميع المستخدمين فوراً
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddToMarketplace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">عنوان الكتاب *</label>
                  <Input
                    placeholder="مثال: الأسود يليق بك"
                    value={marketTitle}
                    onChange={(e) => setMarketTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">اسم المؤلف *</label>
                  <Input
                    placeholder="مثال: أحلام مستغانمي"
                    value={marketAuthor}
                    onChange={(e) => setMarketAuthor(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">السعر (بالدرهم) *</label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={marketPrice}
                    onChange={(e) => setMarketPrice(e.target.value)}
                    required
                    min="1"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">المدينة *</label>
                  <Select value={marketCity} onValueChange={setMarketCity} required>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">صورة الكتاب</label>
                  <div className="space-y-3">
                    <Input
                      type="url"
                      placeholder="رابط صورة الغلاف (اختياري)"
                      value={marketImage}
                      onChange={(e) => setMarketImage(e.target.value)}
                    />
                    <div className="text-center">
                      <span className="text-sm text-gray-500">أو</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startCamera}
                      className="w-full"
                      disabled={isScanning}
                    >
                      📷 التقط صورة بالكاميرا
                    </Button>
                    {marketImage && (
                      <div className="mt-2">
                        <img
                          src={marketImage}
                          alt="معاينة الصورة"
                          className="w-20 h-28 object-cover rounded border mx-auto"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMarketImage('')}
                          className="mt-2 w-full"
                        >
                          🗑️ إزالة الصورة
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">وصف الكتاب (اختياري)</label>
                  <Textarea
                    placeholder="وصف مختصر عن الكتاب وحالته..."
                    value={marketDescription}
                    onChange={(e) => setMarketDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Advertisement Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="text-sm font-medium">🎯 جعل هذا إعلان مميز</label>
                      <p className="text-xs text-gray-500">الإعلانات المميزة تظهر في أعلى قائمة السوق</p>
                    </div>
                    <Switch
                      checked={isAdvertisement}
                      onCheckedChange={setIsAdvertisement}
                    />
                  </div>

                  {isAdvertisement && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-yellow-800">
                          مدة الإعلان
                        </label>
                        <Select value={advertisementDuration} onValueChange={setAdvertisementDuration}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {advertisementDurations.map((duration) => (
                              <SelectItem key={duration.value} value={duration.value}>
                                {duration.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
                        💡 الإعلانات المميزة تظهر مع إطار ذهبي وشارة "إعلان مميز" في أعلى قائمة السوق
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'جاري الإضافة...' : 
                   isAdvertisement ? '🎯 إضافة إعلان مميز' : '🏪 إضافة للسوق'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Camera Interface */}
      {isScanning && (
        <Card>
          <CardHeader>
            <CardTitle>📷 التقط صورة الكتاب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full max-w-md mx-auto rounded-lg border"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded-lg pointer-events-none"></div>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={captureImage} className="flex-1 max-w-xs">
                  📸 التقط الصورة
                </Button>
                <Button variant="outline" onClick={stopCamera} className="flex-1 max-w-xs">
                  ❌ إلغاء
                </Button>
              </div>
              <p className="text-sm text-gray-600 text-center">
                وجه الكاميرا نحو غلاف الكتاب واضغط على "التقط الصورة"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Interface */}
      {isScanning && (
        <Card>
          <CardHeader>
            <CardTitle>📷 التقط صورة الكتاب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full max-w-md mx-auto rounded-lg border"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded-lg pointer-events-none"></div>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={captureImage} className="flex-1 max-w-xs">
                  📸 التقط الصورة
                </Button>
                <Button variant="outline" onClick={stopCamera} className="flex-1 max-w-xs">
                  ❌ إلغاء
                </Button>
              </div>
              <p className="text-sm text-gray-600 text-center">
                وجه الكاميرا نحو غلاف الكتاب واضغط على "التقط الصورة"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview for marketplace */}
      {marketTitle && (
        <Card>
          <CardHeader>
            <CardTitle>معاينة في السوق</CardTitle>
            {isAdvertisement && (
              <div className="flex items-center text-yellow-600 text-sm">
                <span className="mr-2">🎯</span>
                <span>إعلان مميز - سيظهر في أعلى القائمة</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className={`${isAdvertisement ? 'ring-2 ring-yellow-400 rounded-lg p-2' : ''}`}>
              {isAdvertisement && (
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs px-3 py-1 flex items-center mb-2 rounded">
                  <span className="mr-1">🎯</span>
                  <span>إعلان مميز</span>
                </div>
              )}
              <div className="flex">
                {marketImage ? (
                  <img
                    src={marketImage}
                    alt={marketTitle}
                    className="w-20 h-28 object-cover rounded border"
                  />
                ) : (
                  <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">
                    📚
                  </div>
                )}
                <div className="flex-1 mr-4">
                  <h3 className="font-semibold text-lg">{marketTitle}</h3>
                  <p className="text-gray-600 text-sm">{marketAuthor}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
                    <span>📍 {marketCity}</span>
                    <span className={`text-xl font-bold ${isAdvertisement ? 'text-orange-600' : 'text-blue-600'}`}>
                      {marketPrice} درهم
                    </span>
                  </div>
                  {marketDescription && (
                    <p className="text-sm text-gray-600 mt-2">{marketDescription}</p>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    البائع: مستخدم {user.phone}
                  </div>
                  {isAdvertisement && (
                    <div className="text-xs text-yellow-600 mt-1">
                      مدة الإعلان: {advertisementDuration} أيام
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}