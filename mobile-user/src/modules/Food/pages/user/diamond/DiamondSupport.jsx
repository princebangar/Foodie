// Web: modules/Food/pages/user/diamond/DiamondSupport.jsx — "Need help? Chat with us" from the Diamond page. Looks like
// a chat; under the hood every query is a user support ticket (issueType "Diamond membership"), answered from admin
// Support Tickets. Earlier tickets and admin replies show as the conversation history.
// The web font Lexend is not bundled in the app: the app's default font is used. The message box rides the keyboard.
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, Loader2, SendHorizontal } from "lucide-react-native"
import { useNavigate } from "@/lib/router"
import { toast } from "@/lib/toast"
import { Text, TextInput } from "@/native/ui"
import { StatusBar } from "@/native/ui/SectionStatusBar"
import { Spin } from "@/shared/components/Loader"
import { ForceLight, alpha, colors } from "@/theme"
import useKeyboardOffset from "@/modules/Taxi/shared/hooks/useKeyboardOffset"
import { supportAPI, userAPI } from "@food/api"

const ISSUE_TYPE = "Diamond membership"

const timeOf = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).toUpperCase()
const dayOf = (d) => {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function Bubble({ from, at, children }) {
  const mine = from === "user"
  return (
    <View style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "82%",
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingBottom: 6,
          paddingTop: 10,
          backgroundColor: mine ? "#E23744" : "#EEF1FB",
          ...(mine ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
        }}
      >
        <Text style={{ fontSize: 16, lineHeight: 22, color: mine ? colors.white : "#1C1C1C" }}>{children}</Text>
        {at ? <Text style={{ marginTop: 4, textAlign: "right", fontSize: 11, lineHeight: 14, color: mine ? alpha("#ffffff", 0.75) : colors.gray[500] }}>{timeOf(at)}</Text> : null}
      </View>
    </View>
  )
}

function DiamondSupportContent() {
  const navigate = useNavigate()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardOffset()
  const [name, setName] = useState("")
  const [history, setHistory] = useState(null)
  const [step, setStep] = useState("choose") // choose | write | sent
  const [session, setSession] = useState([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const startedAt = useRef(new Date())

  useEffect(() => {
    userAPI
      .getProfile()
      .then((res) => setName(String(res?.data?.data?.user?.name || res?.data?.user?.name || "").trim()))
      .catch(() => {})
    supportAPI
      .getMyTickets({ limit: 50 })
      .then((res) => {
        const tickets = (res?.data?.data?.tickets || []).filter((t) => t.issueType === ISSUE_TYPE)
        setHistory(tickets.reverse())
      })
      .catch(() => setHistory([]))
  }, [])

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    return () => clearTimeout(id)
  }, [history, session, step, keyboard])

  const pastMessages = useMemo(() => {
    const out = []
    ;(history || []).forEach((t) => {
      out.push({ id: `${t._id}-q`, from: "user", at: t.createdAt, text: t.description || t.issueType })
      if (t.adminResponse) {
        out.push({ id: `${t._id}-a`, from: "support", at: t.updatedAt || t.createdAt, text: t.adminResponse })
      } else if (t.status !== "resolved") {
        out.push({ id: `${t._id}-w`, from: "support", at: t.createdAt, text: `We have your query (#${String(t._id).slice(-6).toUpperCase()}). Our team will reply here soon.` })
      }
    })
    return out
  }, [history])

  const choose = (option) => {
    if (option === "order") {
      navigate("/food/user/profile/support")
      return
    }
    const now = new Date()
    setSession([
      { id: "pick", from: "user", at: now, text: "I have a query related to Diamond membership" },
      { id: "ask", from: "support", at: now, text: "Sure! Please type your query below. Our team will reply in this chat." },
    ])
    setStep("write")
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const res = await supportAPI.createTicket({ type: "other", issueType: ISSUE_TYPE, description: text })
      const ticket = res?.data?.data?.ticket
      const now = new Date()
      setSession((prev) => [
        ...prev,
        { id: `sent-${now.getTime()}`, from: "user", at: now, text },
        {
          id: `ack-${now.getTime()}`,
          from: "support",
          at: now,
          text: `Thanks! Your query${ticket?._id ? ` #${String(ticket._id).slice(-6).toUpperCase()}` : ""} has reached our team. We'll reply here soon.`,
        },
      ])
      setDraft("")
      setStep("sent")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not send. Please try again.")
    } finally {
      setSending(false)
    }
  }

  let lastDay = ""
  const renderWithDays = (messages) =>
    messages.map((m) => {
      const day = dayOf(m.at)
      const showDay = day !== lastDay
      lastDay = day
      return (
        <View key={m.id} style={{ gap: 8 }}>
          {showDay && <Text style={{ paddingTop: 8, textAlign: "center", fontSize: 13, lineHeight: 18, fontWeight: "500", color: colors.gray[500] }}>{day}</Text>}
          <Bubble from={m.from} at={m.at}>{m.text}</Bubble>
        </View>
      )
    })

  const composer = step === "write" || step === "sent"

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top,
          height: 56 + insets.top,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[100],
          backgroundColor: colors.white,
          paddingHorizontal: 12,
          elevation: 1,
          zIndex: 10,
        }}
      >
        <Pressable onPress={() => navigate(-1)} accessibilityLabel="Back" style={({ pressed }) => [{ borderRadius: 9999, padding: 6 }, pressed && { backgroundColor: colors.gray[100] }]}>
          <ArrowLeft size={24} color={colors.gray[900]} strokeWidth={1.75} />
        </Pressable>
        <Text style={{ fontSize: 19, lineHeight: 24, fontWeight: "500", color: colors.gray[900] }}>Foodie Support</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: (composer ? 144 : 24) + insets.bottom + keyboard }}
      >
        {history === null ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Spin>
              <Loader2 size={24} color={colors.gray[400]} />
            </Spin>
          </View>
        ) : (
          <>
            {renderWithDays(pastMessages)}
            {renderWithDays([
              { id: "hi", from: "support", at: startedAt.current, text: `Hi${name ? ` ${name}` : ""}, Welcome to Foodie Diamond chat support.` },
              { id: "select", from: "support", at: startedAt.current, text: "Please select the issue for which you seek support" },
            ])}

            {step === "choose" && (
              <View style={{ maxWidth: "82%", overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: colors.gray[200], backgroundColor: colors.white }}>
                <Pressable onPress={() => choose("diamond")} style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 12 }, pressed && { backgroundColor: colors.gray[50] }]}>
                  <Text style={{ fontSize: 16, lineHeight: 22, color: "#256FEF" }}>I have a query related to Diamond membership</Text>
                </Pressable>
                <View style={{ height: 1, backgroundColor: colors.gray[200] }} />
                <Pressable onPress={() => choose("order")} style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 12 }, pressed && { backgroundColor: colors.gray[50] }]}>
                  <Text style={{ fontSize: 16, lineHeight: 22, color: "#256FEF" }}>I have an issue related to food delivery order</Text>
                </Pressable>
              </View>
            )}

            {session.map((m) => (
              <Bubble key={m.id} from={m.from} at={m.at}>
                {m.text}
              </Bubble>
            ))}
          </>
        )}
      </ScrollView>

      {composer && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: keyboard,
            borderTopWidth: 1,
            borderTopColor: colors.gray[100],
            backgroundColor: colors.white,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: (keyboard > 0 ? 0 : insets.bottom) + 20,
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, 1000))}
              multiline
              placeholder={step === "sent" ? "Add more details…" : "Type your query…"}
              placeholderTextColor={colors.gray[400]}
              style={{
                maxHeight: 128,
                minHeight: 48,
                flex: 1,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.gray[200],
                backgroundColor: colors.gray[50],
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                lineHeight: 22,
                color: colors.gray[900],
              }}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || sending}
              accessibilityLabel="Send"
              style={{ height: 48, width: 48, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: !draft.trim() || sending ? colors.gray[300] : "#E23744" }}
            >
              {sending ? (
                <Spin>
                  <Loader2 size={20} color={colors.white} />
                </Spin>
              ) : (
                <SendHorizontal size={20} color={colors.white} />
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

// The web page has no dark variant (bg-white): always light.
export default function DiamondSupport() {
  return (
    <ForceLight>
      <DiamondSupportContent />
    </ForceLight>
  )
}
