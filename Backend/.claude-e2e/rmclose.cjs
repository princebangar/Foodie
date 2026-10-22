const fs=require('fs');
const root='C:/Users/Prince/Prince Bangar/Coding/Foodie/Frontend/src/modules/Food/pages/';
for (const f of ['admin/restaurant/AddRestaurant.jsx','admin/restaurant/RestaurantsList.jsx','restaurant/EditOwner.jsx','restaurant/Onboarding.jsx']) {
  const raw=fs.readFileSync(root+f,'utf8'); const crlf=raw.includes('\r\n'); let s=raw.replace(/\r\n/g,'\n'); const before=s;
  s=s.replace(/\} else if \(closingMinutes < openingMinutes\) \{\n\s*errors\.push\("Closing time cannot be less than opening time"\)\n\s*\}/g,'}');
  s=s.replace(/\n[ \t]*if \(closingMinutes < openingMinutes\) \{\n[ \t]*(?:toast\.error|setError|alert)\("Closing time cannot be less than opening time"\)\n[ \t]*return\n[ \t]*\}/g,'');
  if (s===before) throw new Error('nochange '+f);
  fs.writeFileSync(root+f, crlf?s.replace(/\n/g,'\r\n'):s);
}
console.log('ok');
