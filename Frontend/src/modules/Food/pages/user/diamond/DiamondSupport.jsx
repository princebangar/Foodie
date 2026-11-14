import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, SendHorizontal } from "lucide-react"
import { toast } from "sonner"
import { supportAPI, userAPI } from "@food/api"

const ISSUE_TYPE = "Diamond membership"
const FONT = "'Lexend', 'Figtree', sans-serif"

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
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 pb-1.5 pt-2.5 text-[16px] leading-snug ${
          mine ? "rounded-br-md bg-[#E23744] text-white" : "rounded-bl-md bg-[#EEF1FB] text-[#1C1C1C]"
        }`}
      >
        <p className="whitespace-pre-line break-words">{children}</p>
        {at && <p className={`mt-1 text-right text-[11px] ${mine ? "text-white/75" : "text-gray-500"}`}>{timeOf(at)}</p>}
      </div>
    </div>
  )
}

/**
 * "Need help? Chat with us" from the Diamond page. Looks like a chat; under the hood every
 * query is a user support ticket (issueType "Diamond membership"), answered from admin
 * Support Tickets. Earlier tickets and admin replies show as the conversation history.
 */
export default function DiamondSupport() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [history, setHistory] = useState(null)
  const [step, setStep] = useState("choose") // choose | write | sent
  const [session, setSession] = useState([]) // messages from this visit
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [history, session, step])

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

  // Group history by day, then today's live conversation.
  let lastDay = ""
  const renderWithDays = (messages) =>
    messages.map((m) => {
      const day = dayOf(m.at)
      const showDay = day !== lastDay
      lastDay = day
      return (
        <div key={m.id} className="space-y-2">
          {showDay && <p className="pt-2 text-center text-[13px] font-medium text-gray-500">{day}</p>}
          <Bubble from={m.from} at={m.at}>{m.text}</Bubble>
        </div>
      )
    })

  return (
    <div className="flex min-h-screen flex-col bg-white" style={{ fontFamily: FONT }}>
      <div
        className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-gray-100 bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "content-box" }}
      >
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-1.5 active:bg-gray-100">
          <ArrowLeft className="h-6 w-6 text-gray-900" strokeWidth={1.75} />
        </button>
        <h1 className="text-[19px] font-medium text-gray-900">Foodie Support</h1>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-2 px-4 pb-36 pt-2">
        {history === null ? (
          <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-gray-400" />
        ) : (
          <>
            {renderWithDays(pastMessages)}
            {renderWithDays([
              {
                id: "hi",
                from: "support",
                at: startedAt.current,
                text: `Hi${name ? ` ${name}` : ""}, Welcome to Foodie Diamond chat support.`,
              },
              { id: "select", from: "support", at: startedAt.current, text: "Please select the issue for which you seek support" },
            ])}

            {step === "choose" && (
              <div className="ml-0 max-w-[82%] overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <button type="button" onClick={() => choose("diamond")} className="block w-full px-3.5 py-3 text-left text-[16px] text-[#256FEF] active:bg-gray-50">
                  I have a query related to Diamond membership
                </button>
                <div className="h-px bg-gray-200" />
                <button type="button" onClick={() => choose("order")} className="block w-full px-3.5 py-3 text-left text-[16px] text-[#256FEF] active:bg-gray-50">
                  I have an issue related to food delivery order
                </button>
              </div>
            )}

            {session.map((m) => (
              <Bubble key={m.id} from={m.from} at={m.at}>
                {m.text}
              </Bubble>
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {(step === "write" || step === "sent") && (
        <div
          className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        >
          <div className="mx-auto flex max-w-md items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              rows={1}
              placeholder={step === "sent" ? "Add more details…" : "Type your query…"}
              className="max-h-32 min-h-[48px] flex-1 resize-none rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-[16px] leading-snug outline-none focus:border-gray-400"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || sending}
              aria-label="Send"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E23744] text-white disabled:bg-gray-300"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
