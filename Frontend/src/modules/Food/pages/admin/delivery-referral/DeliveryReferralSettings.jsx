import { useCallback, useEffect, useState } from "react"
import { Gift, Loader2, Plus, Save, Search, Trash2, Users, Wallet, Clock, BadgeCheck } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Switch } from "@food/components/ui/switch"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Link } from "react-router-dom"

const MAX_LEVELS = 50

const ordinal = (n) => {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`
}

const formatINR = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

const cleanAmount = (raw) =>
  String(raw ?? "")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .replace(/^0+(\d)/, "$1")

const STATUS_STYLES = {
  credited: { label: "Credited", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Not eligible", className: "bg-slate-100 text-slate-600 border-slate-200" },
  pending: { label: "Processing", className: "bg-amber-50 text-amber-700 border-amber-200" },
}

const REASON_LABELS = {
  limit_reached: "Referrer reached the max referrals",
  limit_disabled: "Max referrals was 0",
  referral_disabled: "Refer & Earn was turned off",
  reward_disabled: "Reward was ₹0",
  referrer_not_found: "Referrer account not found",
  referrer_not_approved: "Referrer was not approved",
  credit_failed: "Credit failed, add bonus manually",
  feature_hidden: "Delivery Refer & Earn was off in Customization Settings",
}

const EMPTY_FORM = { enabled: false, maxReferrals: "", tiers: [], defaultReward: "" }

/** What gets sent to the server; also used to tell whether the form differs from the saved settings. */
const toPayload = (f) => {
  const maxReferrals = Math.max(0, Math.floor(Number(f.maxReferrals) || 0))
  const hasAfterTiers = maxReferrals > f.tiers.length
  return {
    enabled: Boolean(f.enabled),
    maxReferrals,
    tiers: f.tiers.map((t) => Number(t) || 0),
    defaultReward: hasAfterTiers ? Number(f.defaultReward) || 0 : 0,
  }
}

export default function DeliveryReferralSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [savedForm, setSavedForm] = useState(EMPTY_FORM)

  const [history, setHistory] = useState({ referrals: [], summary: null, pagination: { page: 1, pages: 1, total: 0 } })
  const [historyLoading, setHistoryLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const applySettings = (s) => {
    const next = {
      enabled: Boolean(s?.enabled),
      maxReferrals: s?.maxReferrals ? String(s.maxReferrals) : "",
      tiers: Array.isArray(s?.tiers) ? s.tiers.map((t) => String(t)) : [],
      defaultReward: s?.defaultReward ? String(s.defaultReward) : "",
    }
    setForm(next)
    setSavedForm(next)
  }

  const [featureVisible, setFeatureVisible] = useState(true)

  useEffect(() => {
    let alive = true
    adminAPI
      .getCustomizationSettings()
      .then((res) => alive && setFeatureVisible(res?.data?.data?.delivery_refer_earn_enabled !== false))
      .catch(() => {})
    adminAPI
      .getDeliveryReferralSettings()
      .then((res) => alive && applySettings(res?.data?.data?.settings))
      .catch(() => toast.error("Failed to load Refer & Earn settings"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await adminAPI.getDeliveryReferrals({ page, limit: 20, status: statusFilter || undefined, search: search || undefined })
      const data = res?.data?.data
      if (data) setHistory(data)
    } catch {
      toast.error("Failed to load referral history")
    } finally {
      setHistoryLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Debounce search so typing doesn't fire a request per key
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const maxReferrals = Math.max(0, Math.floor(Number(form.maxReferrals) || 0))
  const tierAmounts = form.tiers.map((t) => Number(t) || 0)
  const defaultReward = Number(form.defaultReward) || 0
  const referralsAfterTiers = Math.max(0, maxReferrals - form.tiers.length)

  const preview = {
    total: tierAmounts.slice(0, maxReferrals).reduce((sum, a) => sum + a, 0) + referralsAfterTiers * defaultReward,
  }

  const setTier = (idx, value) =>
    setForm((prev) => ({ ...prev, tiers: prev.tiers.map((t, i) => (i === idx ? cleanAmount(value) : t)) }))

  const addTier = () =>
    setForm((prev) => {
      const nextMax = Math.max(Number(prev.maxReferrals) || 0, prev.tiers.length + 1)
      return { ...prev, tiers: [...prev.tiers, ""], maxReferrals: String(nextMax) }
    })

  const removeTier = (idx) => setForm((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== idx) }))

  const validationError = (() => {
    if (form.enabled && maxReferrals < 1) return "Set max referrals to at least 1"
    if (form.tiers.length > maxReferrals && maxReferrals > 0)
      return `You have ${form.tiers.length} referral levels but max referrals is ${maxReferrals}`
    if (form.enabled && preview.total <= 0) return "Add a reward amount for at least one referral"
    return ""
  })()

  const payload = toPayload(form)
  const isDirty = JSON.stringify(payload) !== JSON.stringify(toPayload(savedForm))

  const handleSave = async () => {
    if (!isDirty) return
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      const res = await adminAPI.saveDeliveryReferralSettings(payload)
      applySettings(res?.data?.data?.settings)
      toast.success("Refer & Earn settings saved")
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const summary = history.summary
  const statCards = [
    { label: "Total referrals", value: summary?.totalReferrals ?? 0, icon: Users, tone: "text-sky-600 bg-sky-50" },
    { label: "Rewards credited", value: summary?.credited ?? 0, icon: BadgeCheck, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Total paid", value: formatINR(summary?.totalPaid), icon: Wallet, tone: "text-violet-600 bg-violet-50" },
    { label: "Awaiting approval", value: summary?.awaitingApproval ?? 0, icon: Clock, tone: "text-amber-600 bg-amber-50" },
  ]

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Delivery Boy Refer & Earn</h1>
            <p className="text-sm text-slate-500 mt-1">
              Set how much a delivery partner earns for each partner they refer. The reward goes to their pocket balance
              when you approve the new partner.
            </p>
          </div>
        </div>

        {!featureVisible && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Delivery Refer &amp; Earn is turned off in{" "}
            <Link to="/admin/food/customization-settings" className="font-semibold underline">
              Customization Settings
            </Link>
            . Delivery partners don&apos;t see it and no rewards are credited until you turn it back on.
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="text-lg font-bold text-slate-900">{historyLoading && !summary ? "–" : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Gift className="w-5 h-5 text-orange-600" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">Reward settings</h2>
                <p className="text-xs text-slate-500">Changes apply to partners approved after you save.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: Boolean(checked) }))}
                  disabled={loading}
                />
                {form.enabled ? "On" : "Off"}
              </label>
              <Button
                onClick={handleSave}
                disabled={saving || loading || !isDirty}
                title={isDirty ? "Save changes" : "No changes to save"}
                className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2 disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-100"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
            </div>
          ) : (
            <div className={`grid lg:grid-cols-5 gap-6 p-6 ${form.enabled ? "" : "opacity-60"}`}>
              <div className="lg:col-span-3 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max referrals per partner</label>
                  <p className="text-xs text-slate-500 mb-2">After this many rewarded referrals, a partner stops earning.</p>
                  <input
                    value={form.maxReferrals}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, maxReferrals: String(e.target.value).replace(/\D/g, "").slice(0, 4) }))
                    }
                    inputMode="numeric"
                    placeholder="e.g. 10"
                    className="w-full sm:w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Reward for each referral</p>
                      <p className="text-xs text-slate-500">Set a different amount for the 1st, 2nd, 3rd referral and so on.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {form.tiers.map((amount, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-sm font-medium text-slate-600">{ordinal(idx + 1)} referral</span>
                        <div className="relative flex-1 sm:flex-none sm:w-48">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                          <input
                            value={amount}
                            onChange={(e) => setTier(idx, e.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTier(idx)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addTier}
                    disabled={form.tiers.length >= MAX_LEVELS}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" /> Add {ordinal(form.tiers.length + 1)} referral
                  </button>
                </div>

                {referralsAfterTiers > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {form.tiers.length > 0
                        ? `Every referral after the ${ordinal(form.tiers.length)} (up to ${ordinal(maxReferrals)})`
                        : `Every referral (up to ${maxReferrals})`}
                    </label>
                    <div className="relative w-full sm:w-48">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                      <input
                        value={form.defaultReward}
                        onChange={(e) => setForm((prev) => ({ ...prev, defaultReward: cleanAmount(e.target.value) }))}
                        inputMode="decimal"
                        placeholder="0"
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                      />
                    </div>
                  </div>
                )}

                {validationError && <p className="text-sm text-rose-600">{validationError}</p>}
              </div>

              {/* Live preview */}
              <div className="lg:col-span-2">
                <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">What partners will see</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">Earn up to {formatINR(preview.total)}</p>
                  <p className="text-sm text-slate-600">by referring up to {maxReferrals || 0} delivery partners</p>

                  <div className="mt-4 space-y-1.5">
                    {form.tiers.slice(0, maxReferrals || form.tiers.length).map((amount, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-slate-600">{ordinal(idx + 1)} referral</span>
                        <span className="font-semibold text-slate-900">{formatINR(amount)}</span>
                      </div>
                    ))}
                    {referralsAfterTiers > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">
                          {form.tiers.length > 0
                            ? `${ordinal(form.tiers.length + 1)} to ${ordinal(maxReferrals)}`
                            : `1st to ${ordinal(maxReferrals)}`}
                        </span>
                        <span className="font-semibold text-slate-900">{formatINR(defaultReward)} each</span>
                      </div>
                    )}
                    {maxReferrals === 0 && form.tiers.length === 0 && (
                      <p className="text-sm text-slate-500">Set max referrals and add rewards to see the preview.</p>
                    )}
                  </div>

                  <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                    A referral counts when the new partner signs up with the referrer&apos;s code or link and you approve
                    them.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-6 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Referral history</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, phone or DP code"
                  className="w-full sm:w-64 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setPage(1)
                  setStatusFilter(e.target.value)
                }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">All status</option>
                <option value="credited">Credited</option>
                <option value="rejected">Not eligible</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-3">Referred by</th>
                  <th className="px-6 py-3">New partner</th>
                  <th className="px-6 py-3">Referral</th>
                  <th className="px-6 py-3">Reward</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-orange-600 inline" />
                    </td>
                  </tr>
                ) : history.referrals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No referrals yet
                    </td>
                  </tr>
                ) : (
                  history.referrals.map((row) => {
                    const style = STATUS_STYLES[row.status] || STATUS_STYLES.pending
                    return (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-6 py-3">
                          <p className="font-medium text-slate-900">{row.referrer.name}</p>
                          <p className="text-xs text-slate-500">
                            {row.referrer.code}
                            {row.referrer.phone ? ` · ${row.referrer.phone}` : ""}
                          </p>
                        </td>
                        <td className="px-6 py-3">
                          <p className="font-medium text-slate-900">{row.referee.name}</p>
                          <p className="text-xs text-slate-500">
                            {row.referee.code}
                            {row.referee.phone ? ` · ${row.referee.phone}` : ""}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-slate-700">{row.referralNumber ? ordinal(row.referralNumber) : "–"}</td>
                        <td className="px-6 py-3 font-semibold text-slate-900">
                          {row.status === "credited" ? formatINR(row.rewardAmount) : "–"}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${style.className}`}>
                            {style.label}
                          </span>
                          {row.status === "rejected" && row.reason && (
                            <p className="text-xs text-slate-500 mt-1">{REASON_LABELS[row.reason] || row.reason}</p>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "–"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {history.pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-sm">
              <span className="text-slate-500">
                Page {history.pagination.page} of {history.pagination.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= history.pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
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
