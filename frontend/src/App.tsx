import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider, Helmet } from 'react-helmet-async'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GuestRoute } from './components/GuestRoute'
import { AdminRoute } from './components/AdminRoute'
import ProfileGateRoute from './components/ProfileGateRoute'
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
import { LogoMarquee } from './components/LogoMarquee'
import { StatsBand } from './components/StatsBand'
import { Testimonials } from './components/Testimonials'
import { FAQ } from './components/FAQ'
import { FinalCTA } from './components/FinalCTA'
import { PageLoader } from './components/PageLoader'
import { ScrollToTop } from './components/ScrollToTop'
import { OAuthCodeRedirect } from './components/OAuthCodeRedirect'
import { Seo } from './components/Seo'

const Register = lazy(() => import('./pages/auth/Register'))
const Login = lazy(() => import('./pages/auth/Login'))
const Callback = lazy(() => import('./pages/auth/Callback'))
const AuthConsent = lazy(() => import('./pages/auth/AuthConsent'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const CompleteProfile = lazy(() => import('./pages/profile/CompleteProfile'))
const ProfileView = lazy(() => import('./pages/profile/ProfileView'))
const EditProfile = lazy(() => import('./pages/profile/EditProfile'))
const RoleDashboard = lazy(() => import('./pages/Dashboard'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Forbidden = lazy(() => import('./pages/Forbidden'))
const PlaceholderPage = lazy(() =>
  import('./pages/dashboard/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage }))
)
const Explore = lazy(() => import('./pages/startups/Explore'))
const StartupDetail = lazy(() => import('./pages/startups/StartupDetail'))
const CreateStartup = lazy(() => import('./pages/startups/CreateStartup'))
const EditStartup = lazy(() => import('./pages/startups/EditStartup'))
const MyStartups = lazy(() => import('./pages/dashboard/MyStartups'))
const MyCapTables = lazy(() => import('./pages/dashboard/MyCapTables'))
const ApplicationsDashboard = lazy(() => import('./pages/dashboard/ApplicationsDashboard'))
const MyApplications = lazy(() => import('./pages/dashboard/MyApplications'))
const JobApplications = lazy(() => import('./pages/dashboard/JobApplications'))
const ManageJobApplications = lazy(() => import('./pages/dashboard/ManageJobApplications'))
const SavedStartups = lazy(() => import('./pages/dashboard/SavedStartups'))
const FounderAnalytics = lazy(() => import('./pages/dashboard/FounderAnalytics'))
const StartupAnalytics = lazy(() => import('./pages/startups/StartupAnalytics'))
const DataRoomPage = lazy(() => import('./pages/startups/DataRoom'))
const CapTablePage = lazy(() => import('./pages/startups/CapTable'))
const EquityDashboardPage = lazy(() => import('./pages/equity/EquityDashboard'))
const BusinessPlanDashboard = lazy(() => import('./pages/businessplan/Dashboard'))
const BusinessPlanGenerator = lazy(() => import('./pages/businessplan/Generator'))
const BusinessPlanViewer = lazy(() => import('./pages/businessplan/Viewer'))
const BusinessPlanShareView = lazy(() => import('./pages/businessplan/ShareView'))
const CapTableAdmin = lazy(() => import('./pages/admin/CapTableAdmin'))
const Messages = lazy(() => import('./pages/Messages'))
const Connections = lazy(() => import('./pages/Connections'))
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'))
const NotificationsPage = lazy(() => import('./pages/Notifications'))
const AISettings = lazy(() => import('./pages/AISettings'))
const AIStudio = lazy(() => import('./pages/AIStudio'))
const StartupHealth = lazy(() => import('./pages/studio/StartupHealth'))
const TeamGapFinder = lazy(() => import('./pages/studio/TeamGapFinder'))
const InvestorReadiness = lazy(() => import('./pages/studio/InvestorReadiness'))
const Matching = lazy(() => import('./pages/studio/Matching'))
const AIStudioAdmin = lazy(() => import('./pages/admin/AIStudioAdmin'))
const EmailLogs = lazy(() => import('./pages/EmailLogs'))
const Community = lazy(() => import('./pages/Community'))
const FounderStories = lazy(() => import('./pages/FounderStories'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const HashtagPage = lazy(() => import('./pages/HashtagPage'))
const SavedPosts = lazy(() => import('./pages/SavedPosts'))
const Jobs = lazy(() => import('./pages/jobs/Jobs'))
const JobDetail = lazy(() => import('./pages/jobs/JobDetail'))
const PostJob = lazy(() => import('./pages/jobs/PostJob'))
const ResumeBuilder = lazy(() => import('./pages/ResumeBuilder'))
const AvailabilitySettings = lazy(() => import('./pages/meetings/AvailabilitySettings'))
const BookMeeting = lazy(() => import('./pages/meetings/BookMeeting'))
const Meetings = lazy(() => import('./pages/meetings/Meetings'))
const VideoCall = lazy(() => import('./pages/meetings/VideoCall'))
const MeetingDetail = lazy(() => import('./pages/meetings/MeetingDetail'))
const CoFounderHub = lazy(() => import('./pages/cofounder/CoFounderHub'))
const CoFounderPreferences = lazy(() => import('./pages/cofounder/CoFounderPreferences'))
const StartupInvestors = lazy(() => import('./pages/investor/StartupInvestors'))
const InvestorRequests = lazy(() => import('./pages/investor/InvestorRequests'))
const InvestorProfileSetup = lazy(() => import('./pages/investor/InvestorProfileSetup'))
const StartupAnalyzer = lazy(() => import('./pages/investor/StartupAnalyzer'))
const InvestorAnalytics = lazy(() => import('./pages/investor/InvestorAnalytics'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminStartups = lazy(() => import('./pages/admin/AdminStartups'))
const AdminMeetings = lazy(() => import('./pages/admin/AdminMeetings'))
const AdminInvestors = lazy(() => import('./pages/admin/AdminInvestors'))
const AdminRoleRequests = lazy(() => import('./pages/admin/AdminRoleRequests'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminHealth = lazy(() => import('./pages/admin/AdminHealth'))
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'))
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'))
const AdminCms = lazy(() => import('./pages/admin/AdminCms'))
const AdminPolicies = lazy(() => import('./pages/admin/AdminPolicies'))
const AdminAi = lazy(() => import('./pages/admin/AdminAi'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminSecurity = lazy(() => import('./pages/admin/AdminSecurity'))
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'))
const AdminStartupMembers = lazy(() => import('./pages/admin/AdminStartupMembers'))
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'))
const AdminWaitlist = lazy(() => import('./pages/admin/AdminWaitlist'))
const DueDiligence = lazy(() => import('./pages/investor/DueDiligence'))
const WarRoom = lazy(() => import('./pages/founder/WarRoom'))
const AIMatches = lazy(() => import('./pages/ai/Matches'))
const AdminAiFeatures = lazy(() => import('./pages/admin/AdminAiFeatures'))

const PrivacyPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.TermsPage })))
const CookiePage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.CookiePage })))
const AboutPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.ContactPage })))
const CommunityGuidelinesPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.CommunityGuidelinesPage })))
const AcceptableUsePage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.AcceptableUsePage })))
const IntellectualPropertyPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.IntellectualPropertyPage })))
const SecurityPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.SecurityPage })))
const DisclaimerPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.DisclaimerPage })))
const InvestorDisclaimerPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.InvestorDisclaimerPage })))
const RefundPolicyPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.RefundPolicyPage })))
const LegalCenterPage = lazy(() => import('./pages/static/StaticPages').then((m) => ({ default: m.LegalCenterPage })))

function LandingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  const openWaitlist = () => setWaitlistOpen(true)
  const closeWaitlist = () => setWaitlistOpen(false)

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-dark dark:text-[#FAFAFA]">
      <Seo
        title="FounderHub AI — Startup OS"
        description="From Idea to Funded Startup, All in One Place. Connect with co-founders, developers, investors, and AI tools."
      />
      <Navbar onJoinWaitlist={openWaitlist} />
      <main>
        <Hero onJoinWaitlist={openWaitlist} />
        <LogoMarquee />
        <Features />
        <StatsBand />
        <HowItWorks />
        <Testimonials />
        <Pricing onJoinWaitlist={openWaitlist} />
        <FAQ />
        <FinalCTA onJoinWaitlist={openWaitlist} />
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
          <ScrollToTop />
          <OAuthCodeRedirect />
          <ErrorBoundary>
            <Helmet>
              <title>FounderHub AI — Build your startup</title>
              <meta name="description" content="FounderHub AI connects founders with developers, designers, marketers and investors." />
            </Helmet>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<GuestRoute><Suspense fallback={<PageLoader />}><Register /></Suspense></GuestRoute>} />
              <Route path="/login" element={<GuestRoute><Suspense fallback={<PageLoader />}><Login /></Suspense></GuestRoute>} />
              <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
      <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>} />
      <Route path="/terms" element={<Suspense fallback={<PageLoader />}><TermsPage /></Suspense>} />
      <Route path="/cookies" element={<Suspense fallback={<PageLoader />}><CookiePage /></Suspense>} />
      <Route path="/about" element={<Suspense fallback={<PageLoader />}><AboutPage /></Suspense>} />
      <Route path="/contact" element={<Suspense fallback={<PageLoader />}><ContactPage /></Suspense>} />
      <Route path="/legal" element={<Suspense fallback={<PageLoader />}><LegalCenterPage /></Suspense>} />
      <Route path="/community-guidelines" element={<Suspense fallback={<PageLoader />}><CommunityGuidelinesPage /></Suspense>} />
      <Route path="/acceptable-use" element={<Suspense fallback={<PageLoader />}><AcceptableUsePage /></Suspense>} />
      <Route path="/intellectual-property" element={<Suspense fallback={<PageLoader />}><IntellectualPropertyPage /></Suspense>} />
      <Route path="/security" element={<Suspense fallback={<PageLoader />}><SecurityPage /></Suspense>} />
      <Route path="/disclaimer" element={<Suspense fallback={<PageLoader />}><DisclaimerPage /></Suspense>} />
      <Route path="/investor-disclaimer" element={<Suspense fallback={<PageLoader />}><InvestorDisclaimerPage /></Suspense>} />
      <Route path="/refund-policy" element={<Suspense fallback={<PageLoader />}><RefundPolicyPage /></Suspense>} />
              <Route path="/auth/callback" element={<Suspense fallback={<PageLoader />}><Callback /></Suspense>} />
              <Route
                path="/auth/consent"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AuthConsent />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="/profile/:username" element={<Suspense fallback={<PageLoader />}><ProfileView /></Suspense>} />
              <Route path="/403" element={<Suspense fallback={<PageLoader />}><Forbidden /></Suspense>} />
              <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />

              <Route
                path="/complete-profile"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <CompleteProfile />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              {/* Onboarding is the account-creation wizard — same component. */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <CompleteProfile />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/profile"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <EditProfile />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <NotificationsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/notifications"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <NotificationSettings />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/ai"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AISettings />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-studio"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AIStudio />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-studio/health"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <StartupHealth />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-studio/team-gap"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <TeamGapFinder />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-studio/investor-readiness"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <InvestorReadiness />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-studio/matching"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Matching />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startup-analyzer"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <StartupAnalyzer />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-matches"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AIMatches />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/investor/due-diligence"
                element={
                  <ProtectedRoute>
                    <InvestorGuard>
                      <Suspense fallback={<PageLoader />}>
                        <DueDiligence />
                      </Suspense>
                    </InvestorGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/war-room"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <Suspense fallback={<PageLoader />}>
                        <WarRoom />
                      </Suspense>
                    </FounderGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/investor/analytics"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <InvestorAnalytics />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/availability"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AvailabilitySettings />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/book-meeting/:userId"
                element={
                  <ProtectedRoute>
                    <ProfileGateRoute>
                      <Suspense fallback={<PageLoader />}>
                        <BookMeeting />
                      </Suspense>
                    </ProfileGateRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meetings"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Meetings />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meetings/:id"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <MeetingDetail />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meet/:roomId"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <VideoCall />
                  </Suspense>
                }
              />
              {/* Phase 17 — Enterprise Admin Console */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AdminLayout />
                    </Suspense>
                  </AdminRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
        <Route path="startups" element={<AdminStartups />} />
        <Route path="meetings" element={<AdminMeetings />} />
        <Route path="investors" element={<AdminInvestors />} />
                <Route path="role-requests" element={<AdminRoleRequests />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="health" element={<AdminHealth />} />
                <Route path="audit-logs" element={<AdminAuditLogs />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="cms" element={<AdminCms />} />
      <Route path="policies" element={<AdminPolicies />} />
                <Route path="ai" element={<AdminAi />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="security" element={<AdminSecurity />} />
                <Route path="subscriptions" element={<AdminSubscriptions />} />
                <Route path="startup-members" element={<AdminStartupMembers />} />
                <Route path="equity" element={<CapTableAdmin />} />
                <Route path="emails" element={<EmailLogs />} />
                <Route path="ai-studio" element={<AIStudioAdmin />} />
                <Route path="ai-features" element={<AdminAiFeatures />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="waitlist" element={<AdminWaitlist />} />
              </Route>

              {/* Public app pages (logged-in) */}
              <Route
                path="/explore"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Explore />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Messages />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/connections"
                element={
                  <ProtectedRoute>
                    <ProfileGateRoute>
                      <Suspense fallback={<PageLoader />}>
                        <Connections />
                      </Suspense>
                    </ProfileGateRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Community />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/stories"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <FounderStories />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/post/:id"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <PostDetail />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/hashtag/:tag"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <HashtagPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/saved"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <SavedPosts />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <StartupDetail />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/data-room"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <DataRoomPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/cap-table"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <CapTablePage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/equity"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <EquityDashboardPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* AI Business Plan Generator */}
              <Route
                path="/business-plan/share/:token"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <BusinessPlanShareView />
                  </Suspense>
                }
              />
              <Route
                path="/business-plan"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <BusinessPlanDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business-plan/new"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <BusinessPlanGenerator />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business-plan/:id"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <BusinessPlanViewer />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Jobs & Hiring */}
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Jobs />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/post"
                element={
                  <ProtectedRoute>
                    <ProfileGateRoute>
                      <Suspense fallback={<PageLoader />}>
                        <PostJob />
                      </Suspense>
                    </ProfileGateRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/:id"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <JobDetail />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resume-builder"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ResumeBuilder />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Co-founder matching */}
              <Route
                path="/co-founder"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <CoFounderHub />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/co-founder/preferences"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <CoFounderPreferences />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Investor pages */}
              <Route
                path="/investor"
                element={
                  <ProtectedRoute>
                    <InvestorGuard>
                      <Suspense fallback={<PageLoader />}>
                        <DashboardLayout />
                      </Suspense>
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
                      <ProfileGateRoute>
                        <Suspense fallback={<PageLoader />}>
                          <CreateStartup />
                        </Suspense>
                      </ProfileGateRoute>
                    </FounderGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/investors"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <Suspense fallback={<PageLoader />}>
                        <StartupInvestors />
                      </Suspense>
                    </FounderGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/edit"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <Suspense fallback={<PageLoader />}>
                        <EditStartup />
                      </Suspense>
                    </FounderGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/startups/:id/analytics"
                element={
                  <ProtectedRoute>
                    <FounderGuard>
                      <Suspense fallback={<PageLoader />}>
                        <StartupAnalytics />
                      </Suspense>
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
                  element={<FounderAnalytics />}
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
