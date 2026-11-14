import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import { userAPI } from "@food/api"
import { DIAMOND_FONT } from "@food/components/user/diamond/DiamondBrand"

/** Admin-written Diamond terms. Plain text: blank lines split paragraphs, lines starting "-" or "•" become bullets. */
function TermsText({ text }) {
  const blocks = String(text || "").trim().split(/\n\s*\n/)
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
        // A heading line ("1. Payment and refunds"), optionally followed by bullets.
        if (lines.length && /^\d+\.\s+\S/.test(lines[0]) && lines[0].length < 70) {
          const rest = lines.slice(1)
          return (
            <div key={i} className="space-y-2">
              <h3 className="pt-2 text-[16px] font-semibold text-gray-900">{lines[0]}</h3>
              {rest.length > 0 && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {rest.map((l, j) => (
                    <li key={j}>{l.replace(/^[-•*]\s+/, "")}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        }
        const bullets = lines.every((l) => /^[-•*]\s+/.test(l))
        if (bullets) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^[-•*]\s+/, "")}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {lines.join("\n")}
          </p>
        )
      })}
    </div>
  )
}

export default function DiamondTerms() {
  const navigate = useNavigate()
  const [terms, setTerms] = useState(null)

  useEffect(() => {
    userAPI
      .getDiamondTerms()
      .then((res) => setTerms(res?.data?.data?.terms || ""))
      .catch(() => setTerms(""))
  }, [])

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: DIAMOND_FONT }}>
      <div
        className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-gray-100 bg-white px-3"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "content-box" }}
      >
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-1.5 active:bg-gray-100">
          <ArrowLeft className="h-6 w-6 text-gray-900" strokeWidth={1.75} />
        </button>
        <h1 className="text-[19px] font-semibold text-gray-900">Terms and Conditions</h1>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        <h2 className="mb-4 text-[24px] font-bold text-gray-900">Foodie Diamond</h2>
        {terms === null ? (
          <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-gray-400" />
        ) : terms.trim() ? (
          <TermsText text={terms} />
        ) : (
          <p className="text-[15px] text-gray-500">Terms will be published soon.</p>
        )}
      </div>
    </div>
  )
}
