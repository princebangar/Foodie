import { useCallback, useEffect, useState } from "react"
import { BadgePercent, Bike, Crown, IndianRupee, Loader2, Plus, ReceiptText, Save, Search, Sparkles, Trash2, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@food/components/ui/button"
import { Switch } from "@food/components/ui/switch"
import { adminAPI } from "@food/api"
import { DIAMOND_BG, DIAMOND_CARD, DIAMOND_ICE, DiamondGem, DiamondPattern, DiamondWordmark } from "@food/components/user/diamond/DiamondBrand"

const formatINR = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
const num = (raw) => String(raw ?? "").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").replace(/^0+(\d)/, "$1")
const int = (raw) => String(raw ?? "").replace(/\D/g, "").slice(0, 4)

const DURATIONS = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
]

const durationLabel = (days) => {
  if (!days) return ""
  if (days % 365 === 0) return days === 365 ? "1 year" : `${days / 365} years`
  if (days % 30 === 0) return days === 30 ? "1 month" : `${days / 30} months`
  return days === 1 ? "1 day" : `${days} days`
}

const EMPTY = {
  enabled: false,
  price: "",
  originalPrice: "",
  durationDays: "90",
  freeDelivery: { enabled: true, minOrderValue: "", maxDistanceKm: "" },
  freePlatformFee: { enabled: false },
  extraDiscount: { enabled: true, percent: "", maxDiscount: "", minOrderValue: "" },
  customBenefits: [],
  terms: "",
}

const fromServer = (s) => ({
  enabled: Boolean(s?.enabled),
  price: s?.price ? String(s.price) : "",
  originalPrice: s?.originalPrice ? String(s.originalPrice) : "",
  durationDays: String(s?.durationDays || 90),
  freeDelivery: {
    enabled: s ? s.freeDelivery?.enabled !== false : true,
    minOrderValue: s?.freeDelivery?.minOrderValue ? String(s.freeDelivery.minOrderValue) : "",
    maxDistanceKm: s?.freeDelivery?.maxDistanceKm ? String(s.freeDelivery.maxDistanceKm) : "",
  },
  freePlatformFee: { enabled: Boolean(s?.freePlatformFee?.enabled) },
  extraDiscount: {
    enabled: s ? s.extraDiscount?.enabled !== false : true,
    percent: s?.extraDiscount?.percent ? String(s.extraDiscount.percent) : "",
    maxDiscount: s?.extraDiscount?.maxDiscount ? String(s.extraDiscount.maxDiscount) : "",
    minOrderValue: s?.extraDiscount?.minOrderValue ? String(s.extraDiscount.minOrderValue) : "",
  },
  customBenefits: Array.isArray(s?.customBenefits) ? s.customBenefits.map((b) => ({ title: b.title || "", description: b.description || "" })) : [],
  terms: s?.terms || "",
})

/** Body sent to the server; also used to know whether anything changed. */
const toPayload = (f) => ({
  enabled: f.enabled,
  price: Number(f.price) || 0,
  originalPrice: Number(f.originalPrice) || 0,
  durationDays: Math.max(1, parseInt(f.durationDays, 10) || 0),
  freeDelivery: {
    enabled: f.freeDelivery.enabled,
    minOrderValue: Number(f.freeDelivery.minOrderValue) || 0,
    maxDistanceKm: Number(f.freeDelivery.maxDistanceKm) || 0,
  },
  freePlatformFee: { enabled: f.freePlatformFee.enabled },
  extraDiscount: {
    enabled: f.extraDiscount.enabled,
    percent: Number(f.extraDiscount.percent) || 0,
    maxDiscount: Number(f.extraDiscount.maxDiscount) || 0,
    minOrderValue: Number(f.extraDiscount.minOrderValue) || 0,
  },
  customBenefits: f.customBenefits.map((b) => ({ title: b.title.trim(), description: b.description.trim() })),
  terms: f.terms,
})

/** Same wording the user app shows (server builds it the same way). */
const previewBenefits = (p) => {
  const list = []
  if (p.freeDelivery.enabled) {
    let d = p.freeDelivery.minOrderValue > 0 ? `On orders above ${formatINR(p.freeDelivery.minOrderValue)}` : "On every delivery order"
    if (p.freeDelivery.maxDistanceKm > 0) d += ` from restaurants within ${p.freeDelivery.maxDistanceKm} km`
    list.push({ icon: Bike, title: "Free delivery", description: `${d}.` })
  }
  if (p.extraDiscount.enabled && p.extraDiscount.percent > 0) {
    const parts = ["Above all existing offers"]
    if (p.extraDiscount.minOrderValue > 0) parts.push(`on orders above ${formatINR(p.extraDiscount.minOrderValue)}`)
    if (p.extraDiscount.maxDiscount > 0) parts.push(`(max ${formatINR(p.extraDiscount.maxDiscount)} per order)`)
    list.push({ icon: BadgePercent, title: `Up to ${p.extraDiscount.percent}% extra off`, description: `${parts.join(" ")}.` })
  }
  if (p.freePlatformFee.enabled) list.push({ icon: ReceiptText, title: "No platform fee", description: "Platform fee is waived on every order." })
  p.customBenefits.filter((b) => b.title).forEach((b) => list.push({ icon: Sparkles, title: b.title, description: b.description }))
  return list
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"

function Field({ label, hint, prefix, suffix, value, onChange, placeholder, inputMode = "decimal" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <span className="relative block">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          placeholder={placeholder}
          className={`${inputClass} ${prefix ? "pl-7" : ""} ${suffix ? "pr-10" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

function BenefitBlock({ icon: Icon, title, description, enabled, onToggle, children }) {
  return (
    <div className={`rounded-xl border p-4 ${enabled ? "border-sky-200 bg-sky-50/40" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
            <Icon className="h-5 w-5 text-sky-600" />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={(v) => onToggle(Boolean(v))} />
      </div>
      {enabled && children && <div className="mt-4 grid gap-3 sm:grid-cols-3">{children}</div>}
    </div>
  )
}

export default function FoodieDiamondSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saved, setSaved] = useState(EMPTY)

  const [list, setList] = useState({ members: [], summary: null, pagination: { page: 1, pages: 1, total: 0 } })
  const [listLoading, setListLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    adminAPI
      .getDiamondSettings()
      .then((res) => {
        const next = fromServer(res?.data?.data?.settings)
        setForm(next)
        setSaved(next)
      })
      .catch(() => toast.error("Failed to load Diamond settings"))
      .finally(() => setLoading(false))
  }, [])

  const loadMembers = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await adminAPI.getDiamondMembers({ page, limit: 20, status: status || undefined, search: search || undefined })
      if (res?.data?.data) setList(res.data.data)
    } catch {
      toast.error("Failed to load members")
    } finally {
      setListLoading(false)
    }
  }, [page, status, search])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const setIn = (key, patch) => setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const payload = toPayload(form)
  const isDirty = JSON.stringify(payload) !== JSON.stringify(toPayload(saved))

  const validationError = (() => {
    if (form.enabled && payload.price <= 0) return "Set a price to start selling Diamond"
    if (!payload.durationDays) return "Set how many days the membership lasts"
    if (payload.extraDiscount.enabled && (payload.extraDiscount.percent <= 0 || payload.extraDiscount.percent > 100))
      return "Extra discount must be between 1% and 100%"
    if (form.customBenefits.some((b) => !b.title.trim())) return "Every extra benefit needs a title"
    if (form.enabled && !payload.freeDelivery.enabled && !payload.extraDiscount.enabled && !payload.freePlatformFee.enabled && !payload.customBenefits.length)
      return "Turn on at least one benefit"
    return ""
  })()

  const handleSave = async () => {
    if (!isDirty) return
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      const res = await adminAPI.saveDiamondSettings(payload)
      const next = fromServer(res?.data?.data?.settings)
      setForm(next)
      setSaved(next)
      toast.success("Foodie Diamond saved")
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const benefits = previewBenefits(payload)
  const summary = list.summary
  const stats = [
    { label: "Active members", value: summary?.activeMembers ?? 0, icon: Users, tone: "text-sky-600 bg-sky-50" },
    { label: "Memberships sold", value: summary?.purchases ?? 0, icon: Crown, tone: "text-violet-600 bg-violet-50" },
    { label: "Revenue", value: formatINR(summary?.revenue), icon: Wallet, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Saved by members", value: formatINR(summary?.savingsGiven), icon: IndianRupee, tone: "text-amber-600 bg-amber-50" },
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Foodie Diamond Member</h1>
            <p className="mt-1 text-sm text-slate-500">
              A paid membership. Set the price, how long it lasts and what members get. Benefits apply automatically at checkout.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="text-lg font-bold text-slate-900">{listLoading && !summary ? "–" : value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: DIAMOND_BG }}>
                <DiamondGem className="h-5 w-5" id="admin-gem" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">Plan & benefits</h2>
                <p className="text-xs text-slate-500">Price changes apply to new purchases. Benefit changes apply to all members right away.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: Boolean(v) })} disabled={loading} />
                {form.enabled ? "Selling" : "Not selling"}
              </label>
              <Button
                onClick={handleSave}
                disabled={saving || loading || !isDirty}
                title={isDirty ? "Save changes" : "No changes to save"}
                className="flex items-center gap-2 bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-100"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
            </div>
          ) : (
            <div className="grid gap-6 p-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                {/* Price */}
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-900">Price</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Membership price" prefix="₹" value={form.price} onChange={(v) => set({ price: num(v) })} placeholder="e.g. 149" />
                    <Field
                      label="Original price (optional)"
                      hint="Shown struck through, e.g. ₹299 ₹149"
                      prefix="₹"
                      value={form.originalPrice}
                      onChange={(v) => set({ originalPrice: num(v) })}
                      placeholder="e.g. 299"
                    />
                  </div>
                  <div className="mt-3">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Valid for</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {DURATIONS.map((d) => (
                        <button
                          key={d.days}
                          type="button"
                          onClick={() => set({ durationDays: String(d.days) })}
                          className={`rounded-full border px-3 py-1.5 text-sm ${
                            String(d.days) === form.durationDays ? "border-sky-500 bg-sky-50 font-semibold text-sky-700" : "border-slate-200 text-slate-600"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                      <span className="relative">
                        <input
                          value={form.durationDays}
                          onChange={(e) => set({ durationDays: int(e.target.value) })}
                          inputMode="numeric"
                          className={`${inputClass} w-28 pr-12`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">days</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">What members get</p>
                  <BenefitBlock
                    icon={Bike}
                    title="Free delivery"
                    description="Delivery fee becomes ₹0 for members."
                    enabled={form.freeDelivery.enabled}
                    onToggle={(v) => setIn("freeDelivery", { enabled: v })}
                  >
                    <Field label="Min order" prefix="₹" hint="0 = any order" value={form.freeDelivery.minOrderValue} onChange={(v) => setIn("freeDelivery", { minOrderValue: num(v) })} placeholder="0" />
                    <Field label="Max distance" suffix="km" hint="0 = any distance" value={form.freeDelivery.maxDistanceKm} onChange={(v) => setIn("freeDelivery", { maxDistanceKm: num(v) })} placeholder="0" />
                  </BenefitBlock>

                  <BenefitBlock
                    icon={BadgePercent}
                    title="Extra discount"
                    description='Shown as "Up to X% extra off", on top of coupons.'
                    enabled={form.extraDiscount.enabled}
                    onToggle={(v) => setIn("extraDiscount", { enabled: v })}
                  >
                    <Field label="Up to" suffix="%" value={form.extraDiscount.percent} onChange={(v) => setIn("extraDiscount", { percent: num(v).slice(0, 5) })} placeholder="e.g. 30" />
                    <Field label="Max off per order" prefix="₹" hint="0 = no limit" value={form.extraDiscount.maxDiscount} onChange={(v) => setIn("extraDiscount", { maxDiscount: num(v) })} placeholder="0" />
                    <Field label="Min order" prefix="₹" hint="0 = any order" value={form.extraDiscount.minOrderValue} onChange={(v) => setIn("extraDiscount", { minOrderValue: num(v) })} placeholder="0" />
                  </BenefitBlock>

                  <BenefitBlock
                    icon={ReceiptText}
                    title="No platform fee"
                    description="Platform fee becomes ₹0 for members."
                    enabled={form.freePlatformFee.enabled}
                    onToggle={(v) => setIn("freePlatformFee", { enabled: v })}
                  />

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                        <Sparkles className="h-5 w-5 text-sky-600" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">Extra benefits</p>
                        <p className="text-xs text-slate-500">Shown on the Diamond page only, e.g. "Priority support".</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {form.customBenefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <input
                            value={b.title}
                            onChange={(e) =>
                              set({ customBenefits: form.customBenefits.map((x, j) => (j === i ? { ...x, title: e.target.value.slice(0, 80) } : x)) })
                            }
                            placeholder="Title"
                            className={`${inputClass} sm:w-48`}
                          />
                          <input
                            value={b.description}
                            onChange={(e) =>
                              set({ customBenefits: form.customBenefits.map((x, j) => (j === i ? { ...x, description: e.target.value.slice(0, 240) } : x)) })
                            }
                            placeholder="Short description"
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => set({ customBenefits: form.customBenefits.filter((_, j) => j !== i) })}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {form.customBenefits.length < 10 && (
                      <button
                        type="button"
                        onClick={() => set({ customBenefits: [...form.customBenefits, { title: "", description: "" }] })}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:text-sky-700"
                      >
                        <Plus className="h-4 w-4" /> Add benefit
                      </button>
                    )}
                  </div>
                </div>

                {/* Terms */}
                <div>
                  <p className="text-sm font-semibold text-slate-900">Terms and Conditions</p>
                  <p className="mb-2 text-xs text-slate-500">Leave a blank line between paragraphs. Start lines with "-" for bullet points.</p>
                  <textarea
                    value={form.terms}
                    onChange={(e) => set({ terms: e.target.value.slice(0, 20000) })}
                    rows={8}
                    placeholder={"- Membership is valid for the selected period from the date of purchase.\n- Benefits apply to orders placed through the Foodie app.\n- Membership fee is non-refundable."}
                    className={`${inputClass} font-mono text-[13px]`}
                  />
                </div>

                {validationError && <p className="text-sm text-rose-600">{validationError}</p>}
              </div>

              {/* Preview */}
              <div className="lg:col-span-2">
                <div className="sticky top-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">What users will see</p>
                  <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ background: DIAMOND_BG }}>
                    <DiamondPattern />
                    <div className="relative flex flex-col items-center pt-2 text-center">
                      <DiamondWordmark size="sm" />
                      {payload.price > 0 ? (
                        <p className="mt-4 flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold" style={{ color: DIAMOND_ICE }}>{formatINR(payload.price)}</span>
                          {payload.originalPrice > payload.price && <span className="text-sm text-slate-500 line-through">{formatINR(payload.originalPrice)}</span>}
                          <span className="text-sm text-slate-400">for {durationLabel(payload.durationDays)}</span>
                        </p>
                      ) : (
                        <p className="mt-4 text-sm text-slate-400">Set a price to see it here</p>
                      )}
                    </div>
                    <div className="relative mt-5 space-y-4 rounded-xl p-4" style={{ background: DIAMOND_CARD }}>
                      {benefits.length ? (
                        benefits.map((b, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                              <b.icon className="h-[18px] w-[18px]" style={{ color: DIAMOND_ICE }} />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">{b.title}</p>
                              {b.description && <p className="text-xs leading-relaxed text-slate-400">{b.description}</p>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Turn on a benefit to see it here.</p>
                      )}
                    </div>
                    {!form.enabled && (
                      <p className="relative mt-4 text-center text-xs text-slate-400">Not on sale: users see "coming soon". Existing members keep their benefits.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-6 md:flex-row md:items-center">
            <h2 className="font-semibold text-slate-900">Members</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, phone or email"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-64"
                />
              </div>
              <select
                value={status}
                onChange={(e) => {
                  setPage(1)
                  setStatus(e.target.value)
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Paid on</th>
                  <th className="px-6 py-3">Valid</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Loader2 className="inline h-5 w-5 animate-spin text-sky-600" />
                    </td>
                  </tr>
                ) : list.members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No members yet
                    </td>
                  </tr>
                ) : (
                  list.members.map((m) => {
                    const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–")
                    const chip =
                      m.state === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : m.state === "upcoming"
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                    return (
                      <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-6 py-3">
                          <p className="font-medium text-slate-900">{m.user.name}</p>
                          <p className="text-xs text-slate-500">{m.user.phone || m.user.email}</p>
                        </td>
                        <td className="px-6 py-3 text-slate-700">
                          {formatINR(m.amount)} · {durationLabel(m.durationDays)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-slate-600">{date(m.paidAt)}</td>
                        <td className="whitespace-nowrap px-6 py-3 text-slate-600">
                          {date(m.startAt)} – {date(m.endAt)}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${chip}`}>{m.state}</span>
                        </td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-500">{m.paymentId || "–"}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {list.pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm">
              <span className="text-slate-500">
                Page {list.pagination.page} of {list.pagination.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= list.pagination.pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
