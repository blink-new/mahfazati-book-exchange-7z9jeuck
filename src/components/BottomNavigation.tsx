import { Page } from '../App'

interface BottomNavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

export default function BottomNavigation({ currentPage, onPageChange }: BottomNavigationProps) {
  const navItems = [
    { id: 'home' as Page, label: 'الرئيسية', icon: '🏠' },
    { id: 'marketplace' as Page, label: 'السوق', icon: '📚' },
    { id: 'transfer' as Page, label: 'تحويل', icon: '💸' },
    { id: 'my-books' as Page, label: 'كتبي', icon: '📖' },
    { id: 'settings' as Page, label: 'الإعدادات', icon: '⚙️' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around items-center py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id)}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              currentPage === item.id
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl mb-1">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}