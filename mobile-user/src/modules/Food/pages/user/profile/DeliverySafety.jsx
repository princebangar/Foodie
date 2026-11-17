// Web: modules/Food/pages/user/profile/DeliverySafety.jsx — what the app does to keep deliveries safe; reporting a
// concern is a separate page. Sticky white header (h-14), the four points as cards, red "Report a safety concern".
import { Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, KeyRound, MapPin, Phone, Shield, AlertTriangle } from "lucide-react-native"
import { useLocation, useNavigate } from "@/lib/router"
import { Text } from "@/native/ui"
import { alpha, colors, makeStyles, sp, useTheme } from "@/theme"
import AnimatedPage from "@food/components/user/AnimatedPage"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"

const RED = "#DC2626"

const POINTS = [
  {
    icon: KeyRound,
    title: "Delivery code",
    text: "Your order is handed over only after the delivery partner enters the 4-digit code shown in your app. Share it only when you receive the order.",
  },
  {
    icon: MapPin,
    title: "Live tracking",
    text: "You can follow the delivery partner on the map from pickup to your door, so you always know who is coming and when.",
  },
  {
    icon: Phone,
    title: "Contact the partner",
    text: "Call the delivery partner from the order screen if you need to share directions or change how the order is handed over.",
  },
  {
    icon: Shield,
    title: "Verified partners",
    text: "Delivery partners are approved by our team after their documents are checked before they can take orders.",
  },
]

export default function DeliverySafety() {
  const navigate = useNavigate()
  const location = useLocation()
  const goBack = useAppBackNavigation()
  const s = useStyles()
  const t = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <AnimatedPage style={s.page}>
      <View style={[s.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <Pressable
          onPress={goBack}
          accessibilityLabel="Back"
          style={({ pressed }) => [s.back, pressed && { backgroundColor: t.dark ? colors.gray[800] : colors.gray[100] }]}
        >
          <ArrowLeft size={20} color={t.dark ? colors.gray[200] : colors.gray[800]} />
        </Pressable>
        <Text style={s.title}>Delivery partner safety</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: sp(6) + sp(10) + insets.bottom }]}>
        {POINTS.map(({ icon: Icon, title, text }) => (
          <View key={title} style={s.card}>
            <View style={s.iconBox}>
              <Icon size={20} color={RED} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{title}</Text>
              <Text style={s.cardText}>{text}</Text>
            </View>
          </View>
        ))}

        <Pressable
          onPress={() =>
            navigate("/user/profile/report-safety-emergency", {
              state: { returnTo: location.state?.returnTo || location.pathname },
            })
          }
          style={({ pressed }) => [s.report, pressed && { transform: [{ scale: 0.99 }] }]}
        >
          <AlertTriangle size={16} color={colors.white} />
          <Text style={s.reportText}>Report a safety concern</Text>
        </Pressable>
      </ScrollView>
    </AnimatedPage>
  )
}

const useStyles = makeStyles(({ dark }) => ({
  page: { flex: 1, backgroundColor: dark ? "#0a0a0a" : colors.gray[50] },
  header: {
    backgroundColor: dark ? "#111111" : colors.white,
    borderBottomWidth: 1,
    borderBottomColor: dark ? colors.gray[800] : colors.gray[100],
    paddingHorizontal: sp(4),
    flexDirection: "row",
    alignItems: "center",
    gap: sp(3),
    zIndex: 10,
  },
  back: { padding: sp(2), marginLeft: -sp(2), borderRadius: 9999 },
  title: { fontSize: 18, lineHeight: 28, fontWeight: "700", color: dark ? colors.white : colors.gray[900] },
  content: { paddingHorizontal: sp(4), paddingTop: sp(6), gap: sp(3) },
  card: {
    flexDirection: "row",
    gap: sp(4),
    padding: sp(4),
    borderRadius: 16,
    backgroundColor: dark ? "#111111" : colors.white,
    borderWidth: 1,
    borderColor: dark ? colors.gray[800] : colors.gray[100],
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: dark ? alpha("#450a0a", 0.3) : colors.red[50],
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: dark ? colors.white : colors.gray[900] },
  cardText: { fontSize: 12, lineHeight: 19.5, marginTop: sp(1), color: dark ? colors.gray[400] : colors.gray[600] },
  report: {
    marginTop: sp(4) - sp(3),
    height: 48,
    borderRadius: 16,
    backgroundColor: RED,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp(2),
  },
  reportText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: colors.white },
}))
