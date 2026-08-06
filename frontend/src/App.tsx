import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { FounderGuard, InvestorGuard } from './components/RoleGuard'
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
import MyCapTables from './pages/dashboard/MyCapTables'
import ApplicationsDashboard from './pages/dashboard/ApplicationsDashboard'
import MyApplications from './pages/dashboard/MyApplications'
import JobApplications from './pages/dashboard/JobApplications'
import ManageJobApplications from './pages/dashboard/ManageJobApplications'
import SavedStartups from './pages/dashboard/SavedStartups'
import StartupAnalytics from './pages/startups/StartupAnalytics'
import DataRoomPage from './pages/startups/DataRoom'
import CapTablePage from './pages/startups/CapTable'
import EquityDashboardPage from './pages/equity/EquityDashboard'
import BusinessPlanDashboard from './pages/businessplan/Dashboard'
import BusinessPlanGenerator from './pages/businessplan/Generator'
import BusinessPlanViewer from './pages/businessplan/Viewer'
import BusinessPlanShareView from './pages/businessplan/ShareView'
import CapTableAdmin from './pages/admin/CapTableAdmin'
import Messages from './pages/Messages'
import Connections from './pages/Connections'
import NotificationSettings from './pages/NotificationSettings'
import AISettings from './pages/AISettings'
import AIStudio from './pages/AIStudio'
import AIStudioAdmin from './pages/admin/AIStudioAdmin'
import EmailLogs from './pages/EmailLogs'
import Community from './pages/Community'
import FounderStories from './pages/FounderStories'
import PostDetail from './pages/PostDetail'
import HashtagPage from './pages/HashtagPage'
import SavedPosts from './pages/SavedPosts'
import Jobs from './pages/jobs/Jobs'
import JobDetail from './pages/jobs/JobDetail'
import PostJob from './pages/jobs/PostJob'
import ResumeBuilder from './pages/ResumeBuilder'
import AvailabilitySettings from './pages/meetings/AvailabilitySettings'
import BookMeeting from './pages/meetings/BookMeeting'
import Meetings from './pages/meetings/Meetings'
import VideoCall from './pages/meetings/VideoCall'
import MeetingDetail from './pages/meetings/MeetingDetail'
import CoFounderHub from './pages/cofounder/CoFounderHub'
import CoFounderPreferences from './pages/cofounder/CoFounderPreferences'
import StartupInvestors from './pages/investor/StartupInvestors'
import InvestorRequests from './pages/investor/InvestorRequests'
import InvestorProfileSetup from './pages/investor/InvestorProfileSetup'
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
              <Route
                path="/settings/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/ai"
                element={
                  <ProtectedRoute>
                    <AISettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-studio"
                element={
                  <ProtectedRoute>
                    <AIStudio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/availability"
                element={
                  <ProtectedRoute>
                    <AvailabilitySettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/book-meeting/:userId"
                element={
                  <ProtectedRoute>
                    <BookMeeting />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meetings"
                element={
                  <ProtectedRoute>
                    <Meetings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meetings/:id"
                element={
                  <ProtectedRoute>
                    <MeetingDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meet/:roomId"
                element={
                  <ProtectedRoute>
                    <VideoCall />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/emails"
                element={
                  <ProtectedRoute>
                    <EmailLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ai-studio"
                element={
                  <ProtectedRoute>
                    <AIStudioAdmin />
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
                path="/connections"
                element={
                  <ProtectedRoute>
                    <Connections />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community"
                element={
                  <ProtectedRoute>
                    <Community />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/stories"
                element={
                  <ProtectedRoute>
                    <FounderStories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/post/:id"
                element={
                  <ProtectedRoute>
                    <PostDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/hashtag/:tag"
                element={
                  <ProtectedRoute>
                    <HashtagPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/saved"
                element={
                  <ProtectedRoute>
                    <SavedPosts />
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
              <Route
                path="/startups/:id/data-room"
                element={
                  <ProtectedRoute>
                    <DataRoomPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/cap-table"
                element={
                  <ProtectedRoute>
                    <CapTablePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/equity"
                element={
                  <ProtectedRoute>
                    <EquityDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/equity"
                element={
                  <ProtectedRoute>
                    <CapTableAdmin />
                  </ProtectedRoute>
                }
              />

              {/* AI Business Plan Generator */}
              <Route
                path="/business-plan/share/:token"
                element={<BusinessPlanShareView />}
              />
              <Route
                path="/business-plan"
                element={
                  <ProtectedRoute>
                    <BusinessPlanDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business-plan/new"
                element={
                  <ProtectedRoute>
                    <BusinessPlanGenerator />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business-plan/:id"
                element={
                  <ProtectedRoute>
                    <BusinessPlanViewer />
                  </ProtectedRoute>
                }
              />

              {/* Jobs & Hiring */}
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute>
                    <Jobs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/post"
                element={
                  <ProtectedRoute>
                    <PostJob />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/:id"
                element={
                  <ProtectedRoute>
                    <JobDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resume-builder"
                element={
                  <ProtectedRoute>
                    <ResumeBuilder />
                  </ProtectedRoute>
                }
              />

              {/* Co-founder matching */}
              <Route
                path="/co-founder"
                element={
                  <ProtectedRoute>
                    <CoFounderHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/co-founder/preferences"
                element={
                  <ProtectedRoute>
                    <CoFounderPreferences />
                  </ProtectedRoute>
                }
              />

              {/* Investor pages */}
              <Route
                path="/investor"
                element={
                  <ProtectedRoute>
                    <InvestorGuard>
                      <DashboardLayout />
                    </InvestorGuard>
                  </ProtectedRoute>
                }
              >
                <Route path="requests" element={<InvestorRequests />} />
                <Route path="profile/setup" element={<InvestorProfileSetup />} />
              </Route>

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
                path="/startups/:id/investors"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <StartupInvestors />
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
                <Route path="equity" element={<MyCapTables />} />
                <Route path="applications" element={<ApplicationsDashboard />} />
                <Route path="my-applications" element={<MyApplications />} />
                <Route path="job-applications" element={<JobApplications />} />
                <Route path="manage-jobs" element={<ManageJobApplications />} />
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
