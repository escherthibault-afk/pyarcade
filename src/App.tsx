import { lazy, Suspense, useEffect } from 'react'
import { createHashRouter, RouterProvider, Outlet, ScrollRestoration } from 'react-router'
import { MotionConfig } from 'framer-motion'
import { TopBar } from './components/TopBar'
import { Toasts } from './components/Toasts'
import { BreakReminder } from './components/BreakReminder'
import { HomePage } from './pages/HomePage'
import { MapPage } from './pages/MapPage'
import { LevelPage } from './pages/LevelPage'
import { useSettings } from './store/store'
import { engine } from './engine/engine'

const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const NotebookPage = lazy(() => import('./pages/NotebookPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SandboxPage = lazy(() => import('./pages/SandboxPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const DailyPage = lazy(() => import('./pages/DailyPage'))
const RevisionPage = lazy(() => import('./pages/RevisionPage'))
const ExamPage = lazy(() => import('./pages/ExamPage'))
const BonusPage = lazy(() => import('./pages/BonusPage'))
const ShopPage = lazy(() => import('./pages/ShopPage'))
const CertificatePage = lazy(() => import('./pages/CertificatePage'))

function Layout() {
  const settings = useSettings()
  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('light', settings.theme === 'light')
    el.classList.toggle('colorblind', settings.colorblind)
    el.classList.toggle('reduce-motion', settings.motion === 'reduce')
    el.classList.toggle('motion-auto', settings.motion === 'auto')
    el.lang = settings.lang
    el.style.fontSize = `${Math.max(14, Math.min(20, settings.fontSize + 1))}px`
  }, [settings])
  useEffect(() => {
    // preload Pyodide while the player looks at the home screen
    void engine.start().catch(() => undefined)
  }, [])
  const motion = settings.motion === 'reduce' ? 'always' : settings.motion === 'full' ? 'never' : 'user'
  return (
    <MotionConfig reducedMotion={motion}>
      <TopBar />
      <main id="main">
        <Suspense fallback={<div className="p-10 text-center text-muted">…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <Toasts />
      <BreakReminder />
      <ScrollRestoration />
    </MotionConfig>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'wordle', element: <MapPage only="wordle" /> },
      { path: 'level/:id', element: <LevelPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notebook', element: <NotebookPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'sandbox', element: <SandboxPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'daily', element: <DailyPage /> },
      { path: 'revision', element: <RevisionPage /> },
      { path: 'exam', element: <ExamPage /> },
      { path: 'bonus', element: <BonusPage /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'certificate', element: <CertificatePage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
