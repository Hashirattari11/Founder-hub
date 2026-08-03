import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { FounderGuard } from './components/RoleGuard'
import { OnlinePresence } from './components/OnlinePresence'
import { DashboardLayout } from './components/dashboard/DashboardLayout'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { HowItWorks } from './components/HowItWorks'
import { Pricing } from './components/Pricing'
import { Footer } from './components/Footer'
import { WaitlistModal } from './components/WaitlistModal'
import Register from './pages/auth/Register'
import Login from './pages/auth/Login'
import Callback from './pages/auth/Callback'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import CompleteProfile from './pages/profile/CompleteProfile'
import ProfileView from './pages/profile/ProfileView'
import EditProfile from './pages/profile/EditProfile'
import RoleDashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import { PlaceholderPage } from './pages/dashboard/PlaceholderPage'
import Explore from './pages/startups/Explore'
import StartupDetail from './pages/startups/StartupDetail'
import CreateStartup from './pages/startups/CreateStartup'
import EditStartup from './pages/startups/EditStartup'
import MyStartups from './pages/dashboard/MyStartups'
import ApplicationsDashboard from './pages/dashboard/ApplicationsDashboard'
import MyApplications from './pages/dashboard/MyApplications'
import SavedStartups from './pages/dashboard/SavedStartups'
import StartupAnalytics from './pages/startups/StartupAnalytics'
import Messages from './pages/Messages'
import { Helmet } from 'react-helmet-async'

function LandingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  const openWaitlist = () => setWaitlistOpen(true)
  const closeWaitlist = () => setWaitlistOpen(false)

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-dark dark:text-[#FAFAFA]">
      <Navbar onJoinWaitlist={openWaitlist} />
      <main>
        <Hero onJoinWaitlist={openWaitlist} />
        <Features />
        <HowItWorks />
        <Pricing onJoinWaitlist={openWaitlist} />
      </main>
      <Footer />
      <WaitlistModal isOpen={waitlistOpen} onClose={closeWaitlist} />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
        <AuthProvider>
          <OnlinePresence />
          <HelmetProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Helmet>
              <title>FounderHub AI — Build your startup</title>
              <meta name="description" content="FounderHub AI connects founders with developers, designers, marketers and investors." />
            </Helmet>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<Callback />} />
              <Route path="/profile/:username" element={<ProfileView />} />
              <Route path="*" element={<NotFound />} />

              <Route
                path="/complete-profile"
                element={
                  <ProtectedRoute>
                    <CompleteProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/profile"
                element={
                  <ProtectedRoute>
                    <EditProfile />
                  </ProtectedRoute>
                }
              />

              {/* Public app pages (logged-in) */}
              <Route
                path="/explore"
                element={
                  <ProtectedRoute>
                    <Explore />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <Messages />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id"
                element={
                  <ProtectedRoute>
                    <StartupDetail />
                  </ProtectedRoute>
                }
              />

              {/* Founder-only */}
              <Route
                path="/startups/create"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <CreateStartup />
                    </FounderGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/edit"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <EditStartup />
                    </FounderGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/analytics"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <StartupAnalytics />
                    </FounderGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<RoleDashboard />} />
                <Route path="startups" element={<MyStartups />} />
                <Route path="applications" element={<ApplicationsDashboard />} />
                <Route path="my-applications" element={<MyApplications />} />
                <Route path="saved" element={<SavedStartups />} />
                <Route
                  path="messages"
                  element={
                    <PlaceholderPage
                      title="Messages"
                      description="Real-time messaging with your team and investors is coming in the next milestone."
                    />
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <PlaceholderPage
                      title="Analytics"
                      description="Profile views, applicant funnels, and engagement metrics will appear here."
                    />
                  }
                />
              </Route>
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            className:
              '!bg-white !text-gray-900 !border !border-gray-200 dark:!bg-dark-100 dark:!text-[#FAFAFA] dark:!border-dark-300',
            success: { duration: 4000 },
            error: { duration: 5000 },
          }}
        />
        </HelmetProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
