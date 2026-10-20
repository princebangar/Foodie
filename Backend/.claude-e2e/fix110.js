// #110: takeaway + cash -> show the amount to collect on the card and in Verify & Complete.
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', '..', 'Frontend', 'src', 'modules', 'Food', 'pages', 'restaurant', 'OrdersMain.jsx');
let s = fs.readFileSync(f, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');
const rep = (a, b, expected) => {
  const n = s.split(a).length - 1;
  if (n !== expected) throw new Error(`expected ${expected} got ${n}: ${a.slice(0, 70)}`);
  s = s.split(a).join(b);
  console.log('replaced', n, a.trim().split('\n')[0].slice(0, 70));
};

// card props
rep(`  onVerifyTakeaway,
  acceptedAt = null,
  adminStatusNote
}) {`, `  onVerifyTakeaway,
  acceptedAt = null,
  adminStatusNote,
  amount = 0
}) {`, 1);

// pass payment info to the verify popup
rep(`onVerifyTakeaway({ orderId, mongoId, customerName, photoUrl, photoAlt, type, itemsSummary });`,
  `onVerifyTakeaway({ orderId, mongoId, customerName, photoUrl, photoAlt, type, itemsSummary, paymentMethod, amount });`, 1);

// "Collect cash" line on the card (takeaway + cash, until completed)
rep(`          {/* Time Placed */}
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-1">
            {timePlaced}
          </div>`,
`          {normalizedType === "takeaway" &&
            ["cash", "cod"].includes(String(paymentMethod || "").toLowerCase()) &&
            !["delivered", "completed", "cancelled"].includes(normalizedStatus) && (
              <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-black text-amber-700">
                  Collect cash: ₹{Number(amount || 0).toFixed(2)}
                </span>
              </div>
            )}

          {/* Time Placed */}
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-1">
            {timePlaced}
          </div>`, 1);

// payment block in the Verify & Complete popup
rep(`              {/* OTP Section */}
              <div className="px-5 pt-5 pb-2">`,
`              {/* Payment to collect */}
              {(() => {
                const isCash = ["cash", "cod"].includes(String(verifyingOrder.paymentMethod || "").toLowerCase());
                return (
                  <div className={\`mx-5 mt-4 rounded-2xl px-4 py-3 flex items-center justify-between border \${isCash ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}\`}>
                    <span className={\`text-xs font-black uppercase tracking-wider \${isCash ? "text-amber-700" : "text-green-700"}\`}>
                      {isCash ? "Collect cash from customer" : "Paid online"}
                    </span>
                    {isCash && (
                      <span className="text-lg font-black text-amber-800">₹{Number(verifyingOrder.amount || 0).toFixed(2)}</span>
                    )}
                  </div>
                );
              })()}

              {/* OTP Section */}
              <div className="px-5 pt-5 pb-2">`, 1);

fs.writeFileSync(f, s.replace(/\n/g, nl));
