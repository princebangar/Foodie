// Web: modules/Food/pages/user/profile/Profile.jsx — the Profile main tab (kept alive by MainTabKeepAlive): profile card
// (Foodie Diamond look for members / when the plan is on sale), wallet, coupons, cart, saved addresses, Veg Mode,
// Appearance, collections, dining bookings, orders, More (help, about, safety, settings, log out), and the Veg Mode /
// Appearance / Log out / balance warning / delete account popups.
// Native: the page scrolls in a ScrollView (scroll memory = the kept-alive tab); Appearance writes 'appTheme' and
// fires THEME_CHANGE_EVENT (the web toggled html.dark); popups are native Dialogs / Modals.
import React, { useEffect, useRef, useState } from "react"
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BlurView } from "expo-blur"
import {
  ArrowLeft,
  ChevronRight,
  Wallet,
  Tag,
  Leaf,
  Palette,
  Bookmark,
  Building2,
  Moon,
  Sun,
  Check,
  Info,
  AlertTriangle,
  Settings as SettingsIcon,
  Power,
  ShoppingCart,
  MapPin,
  Utensils,
  LifeBuoy,
} from "lucide-react-native"
import { Link, useLocation, useNavigate } from "@/lib/router"
import { toast } from "@/lib/toast"
import { AppImage, Dialog, Skeleton, Text } from "@/native/ui"
import { THEME_CHANGE_EVENT, USER_THEME_KEY, alpha, colors, makeStyles, shadow, useTheme } from "@/theme"
import { DIAMOND_BG, DIAMOND_FONT, DiamondGem, DiamondMetalText, DiamondPattern } from "@food/components/user/diamond/DiamondBrand"
import { fetchDiamond, getCachedDiamond, preloadDiamondPage } from "@food/components/user/diamond/diamondCache"
import { normalizeImageUrl } from "@food/utils/common"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { useProfile } from "@food/context/ProfileContext"
import { useLocationSelector } from "@food/components/user/UserLayout"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { authAPI, userAPI } from "@food/api"
import { firebaseAuth } from "@food/firebase"
import { clearModuleAuth } from "@food/utils/auth"
import { showAccountDeletedToast } from "@/shared/utils/customToasts"
import { resolveProfileBackPath } from "@food/utils/mainTabRoutes"
import UserDeleteAccountDialog from "@/shared/components/UserDeleteAccountDialog"

const debugWarn = (...args) => {}
const debugError = (...args) => {}
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "userVegModeOption", "food-under-250-filters"]
const DEFAULT_AVATAR = require("../../../../../assets/public/images/profile-avatar.webp")

/** One white option card (web: Card bg-white rounded-xl shadow-sm, CardContent p-4, gray icon circle, ChevronRight). */
function OptionRow({ icon: Icon, title, subtitle, right, onPress, to, state, bold, iconStyle }) {
  const s = useStyles()
  const t = useTheme()
  const body = ({ pressed }) => (
    <View style={[s.optionCard, pressed && { transform: [{ scale: 0.995 }] }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <View style={s.optionIcon}>
          <Icon size={20} color={t.dark ? colors.gray[300] : bold ? colors.gray[900] : colors.gray[700]} style={iconStyle} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.optionTitle, bold && { fontWeight: "700" }]}>{title}</Text>
          {subtitle ? (
            typeof subtitle === "string" ? (
              <Text numberOfLines={1} style={s.optionSub}>{subtitle}</Text>
            ) : (
              subtitle
            )
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {right}
        <ChevronRight size={20} color={t.dark ? colors.gray[500] : colors.gray[400]} />
      </View>
    </View>
  )
  if (to) {
    return (
      <Link to={to} state={state}>
        {body}
      </Link>
    )
  }
  return <Pressable onPress={onPress}>{body}</Pressable>
}

function SectionTitle({ children }) {
  const s = useStyles()
  return (
    <View style={s.sectionHead}>
      <View style={s.sectionBar} />
      <Text style={s.sectionTitle}>{children}</Text>
    </View>
  )
}

/** Radio card of the Veg Mode / Appearance popups. */
function ChoiceButton({ active, activeColor, activeBg, onPress, children, trailing }) {
  const s = useStyles()
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={[s.choice, active ? { borderColor: activeColor, backgroundColor: activeBg } : { borderColor: t.dark ? colors.gray[700] : colors.gray[200], backgroundColor: t.dark ? colors.gray[800] : colors.white }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <View style={[s.radio, active ? { borderColor: activeColor, backgroundColor: activeColor } : { borderColor: t.dark ? colors.gray[600] : colors.gray[300] }]}>
          {active ? <Check size={12} color={colors.white} /> : null}
        </View>
        {children}
      </View>
      {trailing}
    </Pressable>
  )
}

/** The web's motion.div popups: initial scale 0.9 / opacity 0 -> 1, over bg-black/60 + backdrop-blur-sm. */
function PopupModal({ open, onClose, children, backdrop = 0.6 }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!open) return
    v.setValue(0)
    Animated.timing(v, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [open, v])
  if (!open) return null
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha("#000000", backdrop) }]} />
        <Animated.View style={{ width: "100%", maxWidth: 384, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

export default function Profile() {
  const { userProfile, vegMode, setVegMode, vegModeOption, setVegModeOption, getDefaultAddress, addresses } = useProfile()
  const { openLocationSelector } = useLocationSelector()
  const navigate = useNavigate()
  const location = useLocation()
  const companyName = useCompanyName()
  const s = useStyles()
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const defaultAddress = getDefaultAddress?.()
  const savedAddressSummary = defaultAddress
    ? [defaultAddress.street, defaultAddress.additionalDetails, defaultAddress.city, defaultAddress.state, defaultAddress.zipCode]
        .filter(Boolean)
        .join(", ")
    : "No address saved. Tap to save Home, Work, or Other."

  const [vegModeOpen, setVegModeOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [walletBalance, setWalletBalance] = useState(null)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteCaptcha, setDeleteCaptcha] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [showBalanceWarning, setShowBalanceWarning] = useState(false)
  const [balanceData] = useState({ balance: 0, type: "Wallet" })

  const handleVegModeUpdate = (nextValue) => {
    setVegMode(nextValue)
    localStorage.setItem("userVegMode", String(nextValue))
  }

  const handleVegModeOptionUpdate = (nextOption) => {
    setVegModeOption(nextOption)
    if (!vegMode) {
      setVegMode(true)
      localStorage.setItem("userVegMode", "true")
    }
  }

  const [appearance, setAppearance] = useState(() => localStorage.getItem(USER_THEME_KEY) || "light")

  // web: html.dark + localStorage appTheme
  useEffect(() => {
    localStorage.setItem(USER_THEME_KEY, appearance)
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: appearance } }))
  }, [appearance])

  const displayName = userProfile?.name || userProfile?.phone || "User"
  const hasValidEmail = userProfile?.email && userProfile.email.trim() !== "" && userProfile.email.includes("@")

  // Foodie Diamond: cached copy at once, fresh one while the Profile tab is open
  const [diamond, setDiamond] = useState(() => getCachedDiamond())
  const isProfileTab = /\/profile\/?$/.test(location.pathname)
  useEffect(() => {
    if (!isProfileTab) return undefined
    let mounted = true
    const cached = getCachedDiamond()
    if (cached) setDiamond(cached)
    fetchDiamond()
      .then((data) => mounted && data && setDiamond(data))
      .catch(() => {})
    preloadDiamondPage().catch(() => {})
    return () => {
      mounted = false
    }
  }, [isProfileTab])

  const isDiamondMember = Boolean(diamond?.membership?.isMember)
  const showDiamondJoin = !isDiamondMember && diamond?.plan?.enabled && diamond?.plan?.price > 0
  const diamondCard = isDiamondMember || showDiamondJoin

  useEffect(() => {
    let mounted = true
    userAPI
      .getWallet()
      .then((res) => {
        const w = res?.data?.data?.wallet || res?.data?.wallet
        const bal = Number(w?.balance)
        if (mounted) setWalletBalance(Number.isFinite(bal) ? bal : 0)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    const clearLocal = () => {
      clearModuleAuth("user")
      localStorage.removeItem("accessToken")
      localStorage.removeItem("user_authenticated")
      localStorage.removeItem("user_user")
      localStorage.removeItem("user")
      localStorage.removeItem("cart")
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key))
      window.dispatchEvent(new Event("userAuthChanged"))
    }
    try {
      try {
        // web: inside the app shell the FCM token came from the Flutter bridge (platform "mobile")
        await authAPI.logout(null, globalThis.__nativeFcmToken || null, "mobile")
      } catch (apiError) {
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError)
      }
      try {
        const { signOut } = await import("firebase/auth")
        if (firebaseAuth?.currentUser) await signOut(firebaseAuth)
      } catch (firebaseError) {
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }
      clearLocal()
      navigate("/user/auth/login", { replace: true })
    } catch (err) {
      debugError("Error during logout:", err)
      clearLocal()
      navigate("/user/auth/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeleting || deleteCaptcha !== "DELETE") return
    setIsDeleting(true)
    try {
      await authAPI.deleteAccount("user")
      showAccountDeletedToast()
      clearModuleAuth("user")
      window.dispatchEvent(new Event("userAuthChanged"))
      navigate("/user/auth/login", { replace: true })
    } catch (error) {
      debugError("Error deleting account:", error)
      toast.error(error?.response?.data?.message || "Failed to delete account. Please try again.")
    } finally {
      setIsDeleting(false)
      setDeleteAccountOpen(false)
    }
  }

  const profileImageSrc =
    userProfile?.localImagePreview ||
    (userProfile?.profileImage &&
    typeof userProfile.profileImage === "string" &&
    userProfile.profileImage.trim() !== "" &&
    userProfile.profileImage !== "null" &&
    userProfile.profileImage !== "undefined"
      ? normalizeImageUrl(userProfile.profileImage)
      : null)

  const vegLabel = vegMode ? (vegModeOption === "pure-veg" ? "Pure Veg" : "All restaurants") : "OFF"
  const sub = t.dark ? colors.gray[400] : colors.gray[500]

  return (
    <AnimatedPage style={s.page}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 80 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Header: Back Arrow */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <Pressable
            onPress={() => navigate(resolveProfileBackPath(location.state?.from))}
            style={({ pressed }) => [s.back, pressed && { transform: [{ scale: 0.95 }] }]}
            accessibilityLabel="Back"
          >
            <BlurView intensity={20} tint={t.dark ? "dark" : "light"} style={[StyleSheet.absoluteFill, { borderRadius: 9999 }]} />
            <ArrowLeft size={24} color={t.dark ? colors.white : colors.black} />
          </Pressable>
        </View>

        {/* Profile Info Card */}
        <View style={[s.profileCard, diamondCard ? { backgroundColor: DIAMOND_BG } : null, isDiamondMember && s.diamondShadow]}>
          {diamondCard && <DiamondPattern corner />}
          <View style={[{ padding: 16, paddingVertical: 9 }, diamondCard && { paddingTop: 20, paddingBottom: 20 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={[s.avatar, diamondCard ? { borderWidth: 2, borderColor: alpha("#9EE6FF", 0.7) } : { borderWidth: 1, borderColor: t.dark ? colors.gray[800] : colors.gray[100] }]}>
                <AppImage src={profileImageSrc || DEFAULT_AVATAR} fallback={DEFAULT_AVATAR} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityLabel={displayName} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, diamondCard ? { fontSize: 24, lineHeight: 30, color: colors.white } : null]}>{displayName}</Text>
                {!diamondCard && hasValidEmail && <Text style={s.contact}>{userProfile.email}</Text>}
                {!diamondCard && userProfile?.phone ? <Text style={s.contact}>{userProfile.phone}</Text> : null}
                {!diamondCard && !hasValidEmail && !userProfile?.phone && <Text style={[s.contact, { color: colors.gray[400] }]}>Not available</Text>}
                <Link to="/user/profile/edit" style={{ flexDirection: "row", alignItems: "center", marginTop: diamondCard ? 10 : 4 }}>
                  <Text style={[s.editText, diamondCard && { fontSize: 15, color: colors.white }]}>Edit profile</Text>
                  <Text style={[s.editArrow, diamondCard && { color: colors.gray[300] }]}>▶</Text>
                </Link>
              </View>
            </View>
          </View>
          {/* Foodie Diamond strip, like Zomato's "Gold member · saved ₹53" */}
          {diamondCard && (
            <Link to="/food/user/diamond" onPressIn={() => preloadDiamondPage().catch(() => {})} style={({ pressed }) => [s.diamondStrip, pressed && { opacity: 0.9 }]}>
              <View style={s.diamondGem}>
                <DiamondGem size={20} id="profile-gem" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <DiamondMetalText style={{ fontSize: 19, fontWeight: "600", fontFamily: DIAMOND_FONT }}>Diamond Member</DiamondMetalText>
              </View>
              <ChevronRight size={20} color={colors.gray[300]} />
            </Link>
          )}
        </View>

        {/* Account Options */}
        <View style={{ gap: 8, marginBottom: 12, marginTop: 12 }}>
          <OptionRow
            icon={Wallet}
            title={`${companyName} Money`}
            to="/food/user/wallet"
            state={{ from: "/food/user/profile" }}
            right={
              walletBalance === null ? (
                <Skeleton width={48} height={16} rounded={4} />
              ) : (
                <Text style={s.balance}>₹{Number(walletBalance).toFixed(0)}</Text>
              )
            }
          />
          <OptionRow icon={Tag} title="Your coupons" to="/user/profile/coupons" />
          <OptionRow icon={ShoppingCart} title="Your cart" to="/user/cart" />
          <OptionRow
            icon={MapPin}
            title="Saved addresses"
            subtitle={savedAddressSummary}
            onPress={openLocationSelector}
            right={
              <View style={s.countPill}>
                <Text style={s.countText}>{addresses?.length || 0}</Text>
              </View>
            }
          />
          <OptionRow icon={Leaf} title="Veg Mode" onPress={() => setVegModeOpen(true)} right={<Text style={s.rightValue}>{vegLabel}</Text>} />
          <OptionRow
            icon={Palette}
            title="Appearance"
            onPress={() => setAppearanceOpen(true)}
            right={<Text style={[s.rightValue, { textTransform: "capitalize" }]}>{appearance}</Text>}
          />
        </View>

        {/* Collections Section */}
        <View style={{ marginBottom: 12 }}>
          <SectionTitle>Collections</SectionTitle>
          <OptionRow icon={Bookmark} title="Your collections" to="/user/profile/favorites" />
        </View>

        {/* Dining Section */}
        <View style={{ marginBottom: 12 }}>
          <SectionTitle>Dining Bookings</SectionTitle>
          <OptionRow
            icon={Utensils}
            title="Your reservations"
            subtitle={<Text style={{ fontSize: 10, lineHeight: 14, color: colors.gray[500] }}>View table booking status</Text>}
            to="/user/profile/dining-bookings"
          />
        </View>

        {/* Food Orders Section */}
        <View style={{ marginBottom: 12 }}>
          <SectionTitle>Food Orders</SectionTitle>
          <OptionRow icon={Building2} title="Your orders" to="/user/orders" state={{ from: "profile", backTo: "/food/user/profile" }} />
        </View>

        {/* More Section */}
        <View style={{ marginBottom: 32, paddingBottom: 32 }}>
          <SectionTitle>More</SectionTitle>
          <View style={{ gap: 8 }}>
            <OptionRow icon={LifeBuoy} title="Help & Support" to="/user/profile/support" />
            <OptionRow icon={Info} title="About" to="/user/profile/about" />
            <OptionRow icon={AlertTriangle} title="Report a safety emergency" to="/user/profile/report-safety-emergency" />
            <OptionRow icon={SettingsIcon} title="Settings" to="/user/profile/settings" />
            <OptionRow
              icon={Power}
              title={isLoggingOut ? "Logging out..." : "Log out"}
              bold
              onPress={() => {
                if (isLoggingOut) return
                setLogoutConfirmOpen(true)
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Veg Mode Popup */}
      <Dialog open={vegModeOpen} onClose={() => setVegModeOpen(false)} style={s.dialog}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={s.dialogTitle}>Veg Mode</Text>
          <Text style={s.dialogDesc}>Filter restaurants and dishes based on your dietary preferences</Text>
        </View>
        <View style={{ gap: 8, paddingHorizontal: 20, paddingBottom: 20 }}>
          <ChoiceButton
            active={vegMode && vegModeOption === "all"}
            activeColor={colors.green[600]}
            activeBg={colors.green[50]}
            onPress={() => {
              handleVegModeOptionUpdate("all")
              setVegModeOpen(false)
            }}
            trailing={<Leaf size={20} color={vegMode && vegModeOption === "all" ? colors.green[600] : colors.gray[400]} />}
          >
            <View>
              <Text style={s.choiceTitle}>All restaurants</Text>
              <Text style={s.choiceSub}>Veg dishes from every restaurant</Text>
            </View>
          </ChoiceButton>
          <ChoiceButton
            active={vegMode && vegModeOption === "pure-veg"}
            activeColor={colors.green[600]}
            activeBg={colors.green[50]}
            onPress={() => {
              handleVegModeOptionUpdate("pure-veg")
              setVegModeOpen(false)
            }}
            trailing={<Leaf size={20} color={vegMode && vegModeOption === "pure-veg" ? colors.green[600] : colors.gray[400]} />}
          >
            <View>
              <Text style={s.choiceTitle}>Pure Veg restaurants only</Text>
              <Text style={s.choiceSub}>Hide restaurants that serve non-veg</Text>
            </View>
          </ChoiceButton>
          <ChoiceButton
            active={!vegMode}
            activeColor="#991B1B"
            activeBg={t.dark ? alpha("#7F1D1D", 0.1) : "#fdfafc"}
            onPress={() => {
              handleVegModeUpdate(false)
              setVegModeOpen(false)
            }}
          >
            <View>
              <Text style={s.choiceTitle}>Veg Mode OFF</Text>
              <Text style={s.choiceSub}>Show all options</Text>
            </View>
          </ChoiceButton>
        </View>
      </Dialog>

      {/* Logout Confirmation Popup */}
      <PopupModal open={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)}>
        <View style={s.logoutCard}>
          <BlurView intensity={30} tint={t.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View style={s.logoutIcon}>
              <Power size={28} color="#FF3131" />
            </View>
            <Text style={s.popupTitle}>Log out?</Text>
          </View>
          <Text style={s.popupText}>Are you sure you want to log out?</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={() => setLogoutConfirmOpen(false)} disabled={isLoggingOut} style={({ pressed }) => [s.noBtn, pressed && { backgroundColor: t.dark ? "#333" : colors.gray[50] }]}>
              <Text style={s.noText}>No</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLogoutConfirmOpen(false)
                handleLogout()
              }}
              disabled={isLoggingOut}
              style={({ pressed }) => [s.yesBtn, pressed && { backgroundColor: "#E02626", transform: [{ scale: 0.95 }] }]}
            >
              <Text style={s.yesText}>Yes</Text>
            </Pressable>
          </View>
        </View>
      </PopupModal>

      {/* Appearance Popup */}
      <Dialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} style={s.dialog}>
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={s.dialogTitle}>Appearance</Text>
          <Text style={s.dialogDesc}>Choose your preferred theme</Text>
        </View>
        <View style={{ gap: 8, paddingHorizontal: 20, paddingBottom: 20 }}>
          <ChoiceButton
            active={appearance === "light"}
            activeColor="#DC2626"
            activeBg={t.dark ? alpha("#7F1D1D", 0.2) : "#fdfafc"}
            onPress={() => {
              setAppearanceOpen(false)
              setTimeout(() => setAppearance("light"), 250)
            }}
          >
            <Sun size={20} color={t.dark ? colors.yellow[400] : colors.yellow[500]} />
            <View>
              <Text style={s.choiceTitle}>Light</Text>
              <Text style={s.choiceSub}>Default light theme</Text>
            </View>
          </ChoiceButton>
          <ChoiceButton
            active={appearance === "dark"}
            activeColor="#DC2626"
            activeBg={t.dark ? alpha("#7F1D1D", 0.2) : "#fdfafc"}
            onPress={() => {
              setAppearanceOpen(false)
              setTimeout(() => setAppearance("dark"), 250)
            }}
          >
            <Moon size={20} color={t.dark ? colors.gray[300] : colors.gray[600]} />
            <View>
              <Text style={s.choiceTitle}>Dark</Text>
              <Text style={s.choiceSub}>Dark theme</Text>
            </View>
          </ChoiceButton>
        </View>
      </Dialog>

      {/* Balance Warning Popup */}
      <PopupModal open={showBalanceWarning} onClose={() => setShowBalanceWarning(false)} backdrop={0.8}>
        <View style={s.balanceCard}>
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View style={s.balanceIcon}>
              <AlertTriangle size={32} color={t.dark ? colors.orange[400] : colors.orange[600]} />
            </View>
            <Text style={[s.popupTitle, { fontWeight: "900" }]}>Wait! Balance Found</Text>
          </View>
          <View style={s.balanceBox}>
            <Text style={s.balanceType}>{balanceData.type}</Text>
            <Text style={s.balanceAmount}>₹{balanceData.balance.toLocaleString("en-IN")}</Text>
          </View>
          <Text style={[s.popupText, { color: t.dark ? colors.gray[300] : colors.gray[600] }]}>
            You still have money in your wallet. Do you want to continue deleting your account or go back and withdraw?
          </Text>
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => {
                setShowBalanceWarning(false)
                setDeleteCaptcha("")
                setDeleteAccountOpen(true)
              }}
              style={s.continueBtn}
            >
              <Text style={s.continueText}>Continue Anyway</Text>
            </Pressable>
            <Pressable onPress={() => setShowBalanceWarning(false)} style={s.cancelWithdrawBtn}>
              <Text style={s.cancelWithdrawText}>Cancel & Withdraw</Text>
            </Pressable>
          </View>
        </View>
      </PopupModal>

      {/* Delete Account Confirmation */}
      <UserDeleteAccountDialog
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
        captcha={deleteCaptcha}
        onCaptchaChange={setDeleteCaptcha}
      />
    </AnimatedPage>
  )
}

const useStyles = makeStyles(({ dark }) => ({
  page: { flex: 1, backgroundColor: dark ? "#0a0a0a" : "#f5f5f5" },
  content: { paddingHorizontal: 16 },
  back: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    overflow: "hidden",
    backgroundColor: dark ? alpha("#1a1a1a", 0.7) : alpha("#ffffff", 0.7),
    borderWidth: 1,
    borderColor: dark ? alpha("#ffffff", 0.1) : alpha("#000000", 0.1),
    ...shadow.sm,
  },
  profileCard: { borderRadius: 20, overflow: "hidden", backgroundColor: dark ? "#1a1a1a" : colors.white, ...shadow.sm },
  diamondShadow: { elevation: 10, shadowColor: "#0B0E13", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  avatar: { height: 64, width: 64, borderRadius: 9999, overflow: "hidden" },
  name: { fontSize: 19, lineHeight: 24, fontWeight: "700", textTransform: "capitalize", color: dark ? colors.white : colors.gray[900] },
  contact: { fontSize: 13, lineHeight: 18, marginTop: 2, color: dark ? colors.gray[400] : colors.gray[500] },
  editText: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: dark ? colors.gray[300] : colors.gray[700] },
  editArrow: { fontSize: 9, lineHeight: 9, marginLeft: 4, color: dark ? colors.gray[400] : colors.gray[500] },
  diamondStrip: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: alpha("#ffffff", 0.1), paddingHorizontal: 16, paddingVertical: 14 },
  diamondGem: { height: 40, width: 40, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: alpha("#ffffff", 0.08) },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    backgroundColor: dark ? "#1a1a1a" : colors.white,
    ...shadow.sm,
  },
  optionIcon: { backgroundColor: dark ? colors.gray[800] : colors.gray[100], borderRadius: 9999, padding: 8 },
  optionTitle: { fontSize: 16, lineHeight: 24, fontWeight: "500", color: dark ? colors.white : colors.gray[900] },
  optionSub: { fontSize: 12, lineHeight: 16, color: dark ? colors.gray[400] : colors.gray[500] },
  balance: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: dark ? colors.green[400] : colors.green[600] },
  countPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: dark ? colors.gray[800] : colors.gray[100] },
  countText: { fontSize: 12, lineHeight: 16, fontWeight: "500", color: dark ? colors.gray[300] : colors.gray[700] },
  rightValue: { fontSize: 16, lineHeight: 24, fontWeight: "500", color: dark ? colors.white : colors.gray[900] },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  sectionBar: { width: 4, height: 16, backgroundColor: "#DC2626", borderRadius: 4 },
  sectionTitle: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: dark ? colors.white : colors.gray[900] },
  dialog: { width: "92%", maxWidth: 384, borderRadius: 16, padding: 0, overflow: "hidden", backgroundColor: dark ? "#1a1a1a" : colors.white },
  dialogTitle: { fontSize: 18, lineHeight: 28, fontWeight: "700", color: dark ? colors.white : colors.gray[900] },
  dialogDesc: { fontSize: 14, lineHeight: 20, color: dark ? colors.gray[400] : colors.gray[500] },
  choice: { width: "100%", padding: 12, borderRadius: 12, borderWidth: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radio: { width: 20, height: 20, borderRadius: 9999, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  choiceTitle: { fontSize: 14, lineHeight: 20, fontWeight: "500", color: dark ? colors.white : colors.gray[900] },
  choiceSub: { fontSize: 12, lineHeight: 16, color: dark ? colors.gray[400] : colors.gray[500] },
  logoutCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: dark ? alpha("#1a1a1a", 0.75) : alpha("#ffffff", 0.75),
    borderWidth: 1,
    borderColor: dark ? alpha("#ffffff", 0.1) : alpha("#ffffff", 0.2),
    padding: 24,
    ...shadow["2xl"],
  },
  logoutIcon: { width: 56, height: 56, borderRadius: 9999, backgroundColor: dark ? alpha("#450a0a", 0.3) : colors.red[50], alignItems: "center", justifyContent: "center", marginBottom: 12 },
  popupTitle: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: dark ? colors.white : colors.gray[900], textAlign: "center" },
  popupText: { fontSize: 14, lineHeight: 22.75, color: dark ? colors.gray[400] : colors.gray[500], marginBottom: 24, textAlign: "center" },
  noBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: dark ? colors.gray[800] : colors.gray[200], backgroundColor: dark ? "#262626" : colors.white, alignItems: "center", justifyContent: "center" },
  noText: { fontSize: 16, fontWeight: "700", color: dark ? colors.gray[200] : colors.gray[700] },
  yesBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#FF3131", alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#ef4444", shadowOpacity: 0.2, shadowRadius: 10 },
  yesText: { fontSize: 16, fontWeight: "700", color: colors.white },
  balanceCard: { backgroundColor: dark ? "#1a1a1a" : colors.white, borderRadius: 16, padding: 24, ...shadow["2xl"] },
  balanceIcon: { width: 64, height: 64, borderRadius: 9999, backgroundColor: dark ? alpha(colors.orange[900], 0.2) : colors.orange[100], alignItems: "center", justifyContent: "center", marginBottom: 12 },
  balanceBox: { backgroundColor: dark ? colors.gray[800] : colors.gray[50], borderRadius: 12, padding: 16, marginBottom: 20, alignItems: "center" },
  balanceType: { fontSize: 10, lineHeight: 14, color: colors.gray[500], textTransform: "uppercase", fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
  balanceAmount: { fontSize: 30, lineHeight: 36, fontWeight: "900", color: dark ? colors.white : colors.black },
  continueBtn: { height: 48, borderRadius: 12, backgroundColor: dark ? colors.gray[800] : colors.gray[100], alignItems: "center", justifyContent: "center" },
  continueText: { fontSize: 16, fontWeight: "700", color: dark ? colors.gray[300] : colors.gray[700] },
  cancelWithdrawBtn: { height: 48, borderRadius: 12, backgroundColor: dark ? colors.white : colors.black, alignItems: "center", justifyContent: "center" },
  cancelWithdrawText: { fontSize: 16, fontWeight: "700", color: dark ? colors.black : colors.white },
}))
