import React, { Suspense, lazy } from "react"
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"
import ProtectedRoute from "@food/components/ProtectedRoute"
import AuthRedirect from "@food/components/AuthRedirect"
import Loader from "@food/components/Loader"
import { OnboardingSkeleton } from "@food/components/ui/loading-skeletons"
import useDesktopLayout from "@food/pages/restaurant/desktop/useDesktopLayout"
import "./restaurantTheme.css"
import { toast } from "sonner"

// Lazy Loading Components (mobile / phone pages)
const RestaurantNotifications = lazy(() => import("@food/pages/restaurant/Notifications"))
const AllOrdersPage = lazy(() => import("@food/pages/restaurant/AllOrdersPage"))
const OrderDetails = lazy(() => import("@food/pages/restaurant/OrderDetails"))
const OrdersMain = lazy(() => import("@food/pages/restaurant/OrdersMain"))
const RestaurantOnboarding = lazy(() => import("@food/pages/restaurant/Onboarding"))
const PrivacyPolicyPage = lazy(() => import("@food/pages/restaurant/PrivacyPolicyPage"))
const TermsAndConditionsPage = lazy(() => import("@food/pages/restaurant/TermsAndConditionsPage"))
const MenuCategoriesPage = lazy(() => import("@food/pages/restaurant/MenuCategoriesPage"))
const RestaurantStatus = lazy(() => import("@food/pages/restaurant/RestaurantStatus"))
const ExploreMore = lazy(() => import("@food/pages/restaurant/ExploreMore"))
const DeliverySettings = lazy(() => import("@food/pages/restaurant/DeliverySettings"))
const RushHour = lazy(() => import("@food/pages/restaurant/RushHour"))
const OutletTimings = lazy(() => import("@food/pages/restaurant/OutletTimings"))
const DaySlots = lazy(() => import("@food/pages/restaurant/DaySlots"))
const OutletInfo = lazy(() => import("@food/pages/restaurant/OutletInfo"))
const RatingsReviews = lazy(() => import("@food/pages/restaurant/RatingsReviews"))
const EditOwner = lazy(() => import("@food/pages/restaurant/EditOwner"))
const EditCuisines = lazy(() => import("@food/pages/restaurant/EditCuisines"))
const EditRestaurantAddress = lazy(() => import("@food/pages/restaurant/EditRestaurantAddress"))
const Inventory = lazy(() => import("@food/pages/restaurant/Inventory"))
const Feedback = lazy(() => import("@food/pages/restaurant/Feedback"))
const ShareFeedback = lazy(() => import("@food/pages/restaurant/ShareFeedback"))
const DishRatings = lazy(() => import("@food/pages/restaurant/DishRatings"))
const RestaurantSupport = lazy(() => import("@food/pages/restaurant/RestaurantSupport"))
const FssaiDetails = lazy(() => import("@food/pages/restaurant/FssaiDetails"))
const FssaiUpdate = lazy(() => import("@food/pages/restaurant/FssaiUpdate"))
const Hyperpure = lazy(() => import("@food/pages/restaurant/Hyperpure"))
const ItemDetailsPage = lazy(() => import("@food/pages/restaurant/ItemDetailsPage"))
const HubFinance = lazy(() => import("@food/pages/restaurant/HubFinance"))
const FinanceDetailsPage = lazy(() => import("@food/pages/restaurant/FinanceDetailsPage"))
const WithdrawalHistoryPage = lazy(() => import("@food/pages/restaurant/WithdrawalHistoryPage"))
const PhoneNumbersPage = lazy(() => import("@food/pages/restaurant/PhoneNumbersPage"))
const DownloadReport = lazy(() => import("@food/pages/restaurant/DownloadReport"))

const ManageOutlets = lazy(() => import("@food/pages/restaurant/ManageOutlets"))
const UpdateBankDetails = lazy(() => import("@food/pages/restaurant/UpdateBankDetails"))
const ZoneSetup = lazy(() => import("@food/pages/restaurant/ZoneSetup"))
const DiningReservations = lazy(() => import("@food/pages/restaurant/DiningReservations"))

const Login = lazy(() => import("@food/pages/restaurant/auth/Login"))
const Signup = lazy(() => import("@food/pages/restaurant/auth/Signup"))
const ForgotPassword = lazy(() => import("@food/pages/restaurant/auth/ForgotPassword"))
const VerificationPending = lazy(() => import("@food/pages/restaurant/auth/VerificationPending"))
const CMSHelpSupportPage = lazy(() => import("@food/pages/restaurant/CMSHelpSupportPage"))

// Laptop / desktop dashboard — browser only. On phones (and inside the native app) the mobile pages above are used.
const DesktopShell = lazy(() => import("@food/pages/restaurant/desktop/DesktopShell"))
const DesktopDashboard = lazy(() => import("@food/pages/restaurant/desktop/DesktopDashboard"))
const DesktopOrders = lazy(() => import("@food/pages/restaurant/desktop/DesktopOrders"))
const DesktopNotifications = lazy(() => import("@food/pages/restaurant/desktop/DesktopNotifications"))
const DesktopInventory = lazy(() => import("@food/pages/restaurant/desktop/DesktopInventory"))
const DesktopItemEditor = lazy(() => import("@food/pages/restaurant/desktop/DesktopItemEditor"))
const DesktopEarnings = lazy(() => import("@food/pages/restaurant/desktop/DesktopEarnings"))
const DesktopReviews = lazy(() => import("@food/pages/restaurant/desktop/DesktopReviews"))
const DesktopReservations = lazy(() => import("@food/pages/restaurant/desktop/DesktopReservations"))
const DesktopSupport = lazy(() => import("@food/pages/restaurant/desktop/DesktopSupport"))
const DesktopSettings = lazy(() => import("@food/pages/restaurant/desktop/DesktopSettings"))
const DesktopAccount = lazy(() => import("@food/pages/restaurant/desktop/DesktopAccount"))
const DesktopOutletInfo = lazy(() => import("@food/pages/restaurant/desktop/DesktopOutletInfo"))
const DesktopTimings = lazy(() => import("@food/pages/restaurant/desktop/DesktopTimings"))
const DesktopProfile = lazy(() => import("@food/pages/restaurant/desktop/DesktopProfile"))
const DesktopOnlineStatus = lazy(() => import("@food/pages/restaurant/desktop/DesktopOnlineStatus"))
const DesktopReport = lazy(() => import("@food/pages/restaurant/desktop/DesktopReport"))
const DesktopShareFeedback = lazy(() => import("@food/pages/restaurant/desktop/DesktopShareFeedback"))
const DesktopZoneSetup = lazy(() => import("@food/pages/restaurant/desktop/DesktopZoneSetup"))

function DesktopLayoutSwitch() {
  return useDesktopLayout() ? <DesktopShell /> : <Outlet />
}

function Responsive({ desktop, mobile }) {
  return useDesktopLayout() ? desktop : mobile
}

export default function RestaurantRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const isOnboarding = location.pathname.includes("/onboarding")

  React.useEffect(() => {
    const handleAuthFailure = (e) => {
      if (e.detail?.module === "restaurant") {
        toast.error("Session Expired", { description: "Please log in again." })
        navigate("/food/restaurant/login", { replace: true })
      }
    }

    const handleStorageChange = (e) => {
      if (e.key === "restaurant_accessToken" && !e.newValue) {
        toast.error("Session Expired", { description: "Please log in again." })
        navigate("/food/restaurant/login", { replace: true })
      }
    }

    window.addEventListener("authRefreshFailed", handleAuthFailure)
    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("authRefreshFailed", handleAuthFailure)
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [navigate])

  return (
    <div className="restaurant-theme">
      <Suspense fallback={
        isOnboarding ? (
          <OnboardingSkeleton />
        ) : (
          <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center">
            <div className="relative">
              <div className="w-10 h-10 border-[3px] border-gray-100/30 rounded-full"></div>
              <div className="absolute top-0 left-0 w-10 h-10 border-[3px] border-[#B80B3D] border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        )
      }>
        <Routes>
        {/* Auth Routes */}

        <Route path="login" element={<AuthRedirect module="restaurant"><Login /></AuthRedirect>} />
        <Route path="otp" element={<AuthRedirect module="restaurant"><Login /></AuthRedirect>} />
        <Route path="signup" element={<AuthRedirect module="restaurant"><Signup /></AuthRedirect>} />
        <Route path="forgot-password" element={<AuthRedirect module="restaurant"><ForgotPassword /></AuthRedirect>} />
        <Route path="pending-verification" element={<VerificationPending />} />

        {/* Protected Routes. On a laptop/desktop browser the dashboard (DesktopShell) renders; phones and the
            native app keep the mobile pages. */}
        <Route element={
          <ProtectedRoute requiredRole="restaurant" loginPath="/food/restaurant/login">
            <DesktopLayoutSwitch />
          </ProtectedRoute>
        }>
          <Route path="" element={<Responsive desktop={<DesktopDashboard />} mobile={<OrdersMain />} />} />
          <Route path="orders" element={<Responsive desktop={<DesktopOrders />} mobile={<OrdersMain />} />} />
          <Route path="orders/all" element={<Responsive desktop={<Navigate to="/food/restaurant/orders?tab=all" replace />} mobile={<AllOrdersPage />} />} />
          <Route path="orders/:id" element={<Responsive desktop={<DesktopOrders />} mobile={<OrderDetails />} />} />
          <Route path="notifications" element={<Responsive desktop={<DesktopNotifications />} mobile={<RestaurantNotifications />} />} />
          <Route path="delivery-settings" element={<Responsive desktop={<DesktopOnlineStatus />} mobile={<DeliverySettings />} />} />
          <Route path="rush-hour" element={<Responsive desktop={<Navigate to="/food/restaurant/settings" replace />} mobile={<RushHour />} />} />
          <Route path="menu" element={<Responsive desktop={<Navigate to="/food/restaurant/inventory" replace />} mobile={<Inventory />} />} />
          <Route path="menu-categories" element={<Responsive desktop={<Navigate to="/food/restaurant/inventory?tab=categories" replace />} mobile={<MenuCategoriesPage />} />} />
          <Route path="status" element={<Responsive desktop={<DesktopOnlineStatus />} mobile={<RestaurantStatus />} />} />
          <Route path="explore" element={<Responsive desktop={<Navigate to="/food/restaurant/settings" replace />} mobile={<ExploreMore />} />} />
          <Route path="settings" element={<Responsive desktop={<DesktopSettings />} mobile={<ExploreMore />} />} />
          <Route path="outlet-timings" element={<Responsive desktop={<DesktopTimings />} mobile={<OutletTimings />} />} />
          <Route path="outlet-timings/:day" element={<Responsive desktop={<Navigate to="/food/restaurant/outlet-timings" replace />} mobile={<DaySlots />} />} />
          <Route path="outlet-info" element={<Responsive desktop={<DesktopOutletInfo />} mobile={<OutletInfo />} />} />
          <Route path="ratings-reviews" element={<Responsive desktop={<DesktopReviews />} mobile={<RatingsReviews />} />} />
          <Route path="reviews" element={<Responsive desktop={<DesktopReviews />} mobile={<Feedback />} />} />
          <Route path="feedback" element={<Responsive desktop={<DesktopReviews />} mobile={<Feedback />} />} />
          <Route path="dish-ratings" element={<Responsive desktop={<Navigate to="/food/restaurant/reviews" replace />} mobile={<DishRatings />} />} />
          <Route path="edit-owner" element={<Responsive desktop={<DesktopProfile defaultTab="owner" />} mobile={<EditOwner />} />} />
          <Route path="edit-cuisines" element={<Responsive desktop={<DesktopProfile defaultTab="cuisines" />} mobile={<EditCuisines />} />} />
          <Route path="edit-address" element={<Responsive desktop={<DesktopProfile defaultTab="address" />} mobile={<EditRestaurantAddress />} />} />
          <Route path="inventory" element={<Responsive desktop={<DesktopInventory />} mobile={<Inventory />} />} />
          <Route path="inventory/item/:id" element={<Responsive desktop={<DesktopItemEditor />} mobile={<ItemDetailsPage />} />} />
          <Route path="feedback-complaints" element={<Responsive desktop={<DesktopReviews />} mobile={<Feedback />} />} />
          <Route path="share-feedback" element={<Responsive desktop={<DesktopShareFeedback />} mobile={<ShareFeedback />} />} />
          <Route path="fssai" element={<Responsive desktop={<DesktopProfile defaultTab="business" />} mobile={<FssaiDetails />} />} />
          <Route path="fssai/update" element={<Responsive desktop={<DesktopProfile defaultTab="business" />} mobile={<FssaiUpdate />} />} />
          <Route path="hyperpure" element={<Responsive desktop={<Navigate to="/food/restaurant/settings" replace />} mobile={<Hyperpure />} />} />
          <Route path="hub-menu/item/:id" element={<Responsive desktop={<DesktopItemEditor />} mobile={<ItemDetailsPage />} />} />
          <Route path="hub-finance" element={<Responsive desktop={<DesktopEarnings />} mobile={<HubFinance />} />} />
          <Route path="earnings" element={<Responsive desktop={<DesktopEarnings />} mobile={<HubFinance />} />} />
          <Route path="withdrawal-history" element={<Responsive desktop={<Navigate to="/food/restaurant/earnings" replace />} mobile={<WithdrawalHistoryPage />} />} />
          <Route path="finance-details" element={<Responsive desktop={<Navigate to="/food/restaurant/earnings" replace />} mobile={<FinanceDetailsPage />} />} />
          <Route path="phone" element={<Responsive desktop={<DesktopProfile defaultTab="owner" />} mobile={<PhoneNumbersPage />} />} />
          <Route path="download-report" element={<Responsive desktop={<DesktopReport />} mobile={<DownloadReport />} />} />
          <Route path="manage-outlets" element={<Responsive desktop={<Navigate to="/food/restaurant/settings" replace />} mobile={<ManageOutlets />} />} />
          <Route path="update-bank-details" element={<Responsive desktop={<DesktopProfile defaultTab="bank" />} mobile={<UpdateBankDetails />} />} />
          <Route path="reservations" element={<Responsive desktop={<DesktopReservations />} mobile={<DiningReservations />} />} />
          <Route path="zone-setup" element={<Responsive desktop={<DesktopZoneSetup />} mobile={<ZoneSetup />} />} />
          <Route path="support" element={<Responsive desktop={<DesktopSupport />} mobile={<RestaurantSupport />} />} />
          <Route path="account" element={<Responsive desktop={<DesktopAccount />} mobile={<Navigate to="/food/restaurant" replace />} />} />
        </Route>
        <Route path="onboarding" element={<RestaurantOnboarding />} />

        {/* Public Legal & Support Routes */}
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsAndConditionsPage />} />
        <Route path="help-centre/support" element={<RestaurantSupport />} />
        <Route path="help-content" element={<CMSHelpSupportPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}
