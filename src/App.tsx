import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MarketplacePage from './pages/MarketplacePage'
import AddBookPage from './pages/AddBookPage'
import MyBooksPage from './pages/MyBooksPage'
import TransferPage from './pages/TransferPage'
import SettingsPage from './pages/SettingsPage'
import BottomNavigation from './components/BottomNavigation'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import { isValidUUID } from './lib/supabase'

export type User = {
  id: string
  phone: string
  balance: number
  booksCount: number
  isAdmin?: boolean
}

export type Page = 'home' | 'marketplace' | 'add-book' | 'my-books' | 'transfer' | 'settings'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('home')

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        // Validate that user has proper UUID format
        if (userData.id && isValidUUID(userData.id)) {
          setUser(userData)
        } else {
          // Clear invalid user data
          localStorage.removeItem('user')
        }
      } catch (error) {
        // Clear corrupted user data
        localStorage.removeItem('user')
      }
    }
  }, [])

  const handleLogin = (userData: User) => {
    // Validate user data before setting
    if (userData.id && isValidUUID(userData.id)) {
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
    } else {
      console.error('Invalid user data received:', userData)
      alert('خطأ في بيانات المستخدم، يرجى المحاولة مرة أخرى')
    }
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
    setCurrentPage('home')
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage user={user} />
      case 'marketplace':
        return <MarketplacePage user={user} />
      case 'add-book':
        return <AddBookPage user={user} />
      case 'my-books':
        return <MyBooksPage user={user} />
      case 'transfer':
        return <TransferPage user={user} />
      case 'settings':
        return <SettingsPage user={user} onLogout={handleLogout} />
      default:
        return <HomePage user={user} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <PWAInstallPrompt />
      {renderCurrentPage()}
      <BottomNavigation currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  )
}

export default App