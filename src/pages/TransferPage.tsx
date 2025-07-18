import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { supabase, isValidUUID } from '../lib/supabase'
import { User } from '../App'
import QRCode from 'qrcode'
import jsQR from 'jsqr'

interface TransferPageProps {
  user: User
}

export default function TransferPage({ user }: TransferPageProps) {
  const [activeTab, setActiveTab] = useState('send')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [scannedData, setScannedData] = useState('')
  const [myQRCode, setMyQRCode] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [scanError, setScanError] = useState('')

  // إنشاء QR Code للمستخدم الحالي
  useEffect(() => {
    const generateMyQRCode = async () => {
      try {
        const qrData = JSON.stringify({
          type: 'wallet_transfer',
          userId: user.id,
          phone: user.phone,
          name: `محفظة ${user.phone}`
        })
        const qrCodeUrl = await QRCode.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: '#2563EB',
            light: '#FFFFFF'
          }
        })
        setMyQRCode(qrCodeUrl)
      } catch (error) {
        console.error('Error generating QR code:', error)
      }
    }
    generateMyQRCode()
  }, [user])

  // تنظيف الموارد عند إلغاء تحميل المكون
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  // تحويل الرصيد عبر رقم الهاتف
  const handlePhoneTransfer = async () => {
    const amount = parseFloat(transferAmount)
    
    if (!recipientPhone.trim()) {
      alert('يرجى إدخال رقم هاتف المستلم')
      return
    }
    
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }
    
    if (amount > user.balance) {
      alert('الرصيد غير كافي')
      return
    }

    if (recipientPhone === user.phone) {
      alert('لا يمكنك تحويل الرصيد لنفسك')
      return
    }

    setIsTransferring(true)

    try {
      // Validate user ID format
      if (!user.id || !isValidUUID(user.id)) {
        alert('خطأ في بيانات المستخدم، يرجى تسجيل الدخول مرة أخرى')
        return
      }

      // البحث عن المستلم
      const { data: recipient, error: recipientError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', recipientPhone)
        .single()

      if (recipientError || !recipient) {
        alert('لم يتم العثور على مستخدم بهذا الرقم')
        return
      }

      // تحديث رصيد المرسل
      const { error: senderError } = await supabase
        .from('users')
        .update({ balance: user.balance - amount })
        .eq('id', user.id)

      if (senderError) {
        throw new Error('فشل في خصم المبلغ من رصيدك')
      }

      // تحديث رصيد المستلم
      const { error: recipientUpdateError } = await supabase
        .from('users')
        .update({ balance: recipient.balance + amount })
        .eq('id', recipient.id)

      if (recipientUpdateError) {
        // إعادة الرصيد للمرسل في حالة الفشل
        await supabase
          .from('users')
          .update({ balance: user.balance })
          .eq('id', user.id)
        throw new Error('فشل في إضافة المبلغ لرصيد المستلم')
      }

      // إضافة معاملة للمرسل
      await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            type: 'transfer_sent',
            amount: -amount,
            description: `تحويل إلى ${recipientPhone}: ${amount} درهم`
          }
        ])

      // إضافة معاملة للمستلم
      await supabase
        .from('transactions')
        .insert([
          {
            user_id: recipient.id,
            type: 'transfer_received',
            amount: amount,
            description: `تحويل من ${user.phone}: ${amount} درهم`
          }
        ])

      // تحديث البيانات المحلية
      user.balance -= amount
      
      alert(`تم تحويل ${amount} درهم إلى ${recipientPhone} بنجاح!`)
      setRecipientPhone('')
      setTransferAmount('')
      
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء التحويل')
    } finally {
      setIsTransferring(false)
    }
  }

  // بدء مسح QR Code
  const startQRScanning = async () => {
    setScanError('')
    
    try {
      // التحقق من دعم المتصفح للكاميرا
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setScanError('المتصفح لا يدعم الوصول للكاميرا')
        return
      }

      // إيقاف أي stream سابق
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // الكاميرا الخلفية
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 }
        }
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        
        // انتظار تحميل البيانات الوصفية للفيديو
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setIsScanning(true)
              // بدء المسح بعد تأخير قصير للتأكد من استقرار الفيديو
              setTimeout(() => {
                scanQRCode()
              }, 500)
            }).catch((playError) => {
              setScanError('فشل في تشغيل الكاميرا. تأكد من السماح بالوصول للكاميرا.')
              stopQRScanning()
            })
          }
        }

        // معالجة أخطاء الفيديو
        videoRef.current.onerror = (error) => {
          setScanError('حدث خطأ في الفيديو. يرجى المحاولة مرة أخرى أو استخدام الإدخال اليدوي.')
          stopQRScanning()
        }
      }
      
    } catch (error: any) {
      // رسائل خطأ أكثر تفصيلاً بدون console.error
      if (error.name === 'NotAllowedError') {
        setScanError('تم رفض الوصول للكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح ثم المحاولة مرة أخرى.')
      } else if (error.name === 'NotFoundError') {
        setScanError('لم يتم العثور على كاميرا في الجهاز. يمكنك استخدام الإدخال اليدوي بدلاً من ذلك.')
      } else if (error.name === 'NotSupportedError') {
        setScanError('المتصفح لا يدعم الوصول للكاميرا. يمكنك استخدام الإدخال اليدوي بدلاً من ذلك.')
      } else if (error.name === 'OverconstrainedError') {
        setScanError('إعدادات الكاميرا غير متوافقة. جرب متصفحاً آخر أو استخدم الإدخال اليدوي.')
      } else {
        setScanError('فشل في الوصول للكاميرا. يمكنك استخدام الإدخال اليدوي لإدخال رقم الهاتف مباشرة.')
      }
      
      setIsScanning(false)
    }
  }

  // إيقاف مسح QR Code
  const stopQRScanning = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsScanning(false)
    setScanError('')
  }

  // مسح QR Code
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    const scan = () => {
      if (!isScanning || !video || !canvas) return

      try {
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
          // تحديد أبعاد الكانفاس
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          
          // رسم الفيديو على الكانفاس
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          
          // الحصول على بيانات الصورة
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
          
          // محاولة قراءة QR Code
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          })
          
          if (code && code.data) {
            handleQRTransfer(code.data)
            return
          }
        }
      } catch (error) {
        // Silent error handling for QR scanning
      }

      // الاستمرار في المسح
      if (isScanning) {
        requestAnimationFrame(scan)
      }
    }

    scan()
  }

  // تحويل عبر QR Code
  const handleQRTransfer = async (qrData: string) => {
    try {
      const data = JSON.parse(qrData)
      
      if (data.type !== 'wallet_transfer') {
        alert('QR Code غير صحيح للتحويل')
        return
      }

      if (data.userId === user.id) {
        alert('لا يمكنك تحويل الرصيد لنفسك')
        return
      }

      setRecipientPhone(data.phone)
      setActiveTab('send')
      stopQRScanning()
      alert(`تم مسح QR Code بنجاح! رقم الهاتف: ${data.phone}`)
      
    } catch (error) {
      alert('فشل في قراءة QR Code - تأكد من أنه رمز صحيح للتحويل')
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">💸 تحويل الرصيد</h1>
        <p className="text-gray-600">حول الرصيد بسهولة وأمان</p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
        <CardContent className="p-6 text-center">
          <div className="text-sm opacity-90 mb-2">رصيدك الحالي</div>
          <div className="text-3xl font-bold">{user.balance.toFixed(2)} درهم</div>
        </CardContent>
      </Card>

      {/* Transfer Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send" className="text-sm">📤 إرسال</TabsTrigger>
          <TabsTrigger value="receive" className="text-sm">📥 استقبال</TabsTrigger>
          <TabsTrigger value="scan" className="text-sm">📱 مسح</TabsTrigger>
        </TabsList>

        {/* Send Money Tab */}
        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                📤 إرسال رصيد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">رقم هاتف المستلم</label>
                <Input
                  type="tel"
                  placeholder="06xxxxxxxx"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="text-right"
                  dir="rtl"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">المبلغ (بالدرهم)</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  max={user.balance}
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>المبلغ:</span>
                  <span>{transferAmount || '0'} درهم</span>
                </div>
                <div className="flex justify-between text-sm font-medium mt-1">
                  <span>الرصيد بعد التحويل:</span>
                  <span>{(user.balance - (parseFloat(transferAmount) || 0)).toFixed(2)} درهم</span>
                </div>
              </div>

              <Button 
                onClick={handlePhoneTransfer}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isTransferring || !recipientPhone || !transferAmount}
              >
                {isTransferring ? 'جاري التحويل...' : '💸 تحويل الرصيد'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receive Money Tab */}
        <TabsContent value="receive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                📥 استقبال رصيد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-gray-600 mb-4">اعرض هذا الرمز للمرسل لتحويل الرصيد إليك</p>
                
                {myQRCode && (
                  <div className="bg-white p-4 rounded-lg shadow-inner inline-block">
                    <img src={myQRCode} alt="QR Code" className="w-48 h-48 mx-auto" />
                  </div>
                )}
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">أو شارك رقم هاتفك:</p>
                  <p className="text-lg font-bold text-blue-600">{user.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scan QR Tab */}
        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                📱 مسح QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isScanning ? (
                <div className="text-center space-y-4">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-gray-600">امسح QR Code الخاص بالمستلم لتحويل الرصيد</p>
                  
                  {scanError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      ❌ {scanError}
                    </div>
                  )}
                  
                  <Button 
                    onClick={startQRScanning}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    📱 بدء المسح
                  </Button>
                  
                  <div className="text-xs text-gray-500 mt-2">
                    <p>💡 تأكد من السماح للمتصفح بالوصول للكاميرا</p>
                    <p>📱 استخدم الكاميرا الخلفية للحصول على أفضل النتائج</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video 
                      ref={videoRef}
                      className="w-full h-64 object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Scanning overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-white rounded-lg relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                      </div>
                    </div>
                    
                    {/* Scanning animation */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-1 bg-green-400 opacity-75 animate-pulse"></div>
                    </div>
                  </div>
                  
                  <p className="text-center text-sm text-gray-600">
                    🎯 وجه الكاميرا نحو QR Code
                  </p>
                  
                  {scanError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      ❌ {scanError}
                    </div>
                  )}
                  
                  <Button 
                    onClick={stopQRScanning}
                    variant="outline"
                    className="w-full"
                  >
                    ❌ إيقاف المسح
                  </Button>
                  
                  {/* Manual input fallback */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium mb-2">أو أدخل البيانات يدوياً:</label>
                    <Input
                      placeholder="رقم هاتف المستلم"
                      value={scannedData}
                      onChange={(e) => setScannedData(e.target.value)}
                      className="mb-2"
                    />
                    <Button 
                      onClick={() => {
                        setRecipientPhone(scannedData)
                        setActiveTab('send')
                        stopQRScanning()
                      }}
                      className="w-full"
                      disabled={!scannedData}
                    >
                      ✅ استخدام هذا الرقم
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Transfer Amounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ مبالغ سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {[50, 100, 200, 500].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => setTransferAmount(amount.toString())}
                disabled={amount > user.balance}
                className="text-xs"
              >
                {amount} درهم
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="font-semibold text-yellow-800 mb-1">نصائح الأمان</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• تأكد من رقم المستلم قبل التحويل</li>
                <li>• لا تشارك QR Code الخاص بك مع أشخاص غير موثوقين</li>
                <li>• التحويلات فورية ولا يمكن إلغاؤها</li>
                <li>• تأكد من إضاءة جيدة عند مسح QR Code</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}