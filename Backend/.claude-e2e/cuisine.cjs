const fs=require('fs');
const p='C:/Users/Prince/Prince Bangar/Coding/Foodie/Frontend/src/modules/Food/pages/restaurant/Onboarding.jsx';
const raw=fs.readFileSync(p,'utf8');const crlf=raw.includes('\r\n');let s=raw.replace(/\r\n/g,'\n');
const rep=(a,b)=>{ if(!s.includes(a)) throw new Error('missing '+a.slice(0,60)); s=s.replace(a,b); };
rep(`const OUTSIDE_ZONE_MESSAGE =`,`const CUISINE_OPTIONS = ["North Indian", "South Indian", "Chinese", "Pizza", "Burgers", "Bakery", "Cafe"]
const MAX_CUISINES = 3

const OUTSIDE_ZONE_MESSAGE =`);
rep(`    if (!step2.openingTime?.trim()) {
      errors.push("Opening time is required")
    }`,`    if (!Array.isArray(step2.cuisines) || step2.cuisines.length === 0) {
      errors.push("Please select at least one cuisine")
    }

    if (!step2.openingTime?.trim()) {
      errors.push("Opening time is required")
    }`);
rep(`        {/* Timings with popover time selectors */}
        <div className="space-y-3">`,`        {/* Cuisines (shown to customers, used in dining filters) */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-700">Select cuisines (up to {MAX_CUISINES})*</Label>
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map((cuisine) => {
              const active = (step2.cuisines || []).includes(cuisine)
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() =>
                    setStep2((prev) => {
                      const current = Array.isArray(prev.cuisines) ? prev.cuisines : []
                      if (current.includes(cuisine)) return { ...prev, cuisines: current.filter((c) => c !== cuisine) }
                      if (current.length >= MAX_CUISINES) return prev
                      return { ...prev, cuisines: [...current, cuisine] }
                    })
                  }
                  className={\`px-3 py-1.5 text-xs rounded-full border transition-colors \${
                    active ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-300"
                  }\`}
                >
                  {cuisine}
                </button>
              )
            })}
          </div>
        </div>

        {/* Timings with popover time selectors */}
        <div className="space-y-3">`);
fs.writeFileSync(p,crlf?s.replace(/\n/g,'\r\n'):s);
console.log('ok');
