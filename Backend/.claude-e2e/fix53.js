// #53: an approved restaurant must stay approved when it edits its profile / images.
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'src', 'modules', 'food', 'restaurant', 'services', 'restaurant.service.js');
let s = fs.readFileSync(f, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');
const rep = (a, b, expected) => {
  const n = s.split(a).length - 1;
  if (n !== expected) throw new Error(`expected ${expected} got ${n}: ${a.slice(0, 60)}`);
  s = s.split(a).join(b);
  console.log('replaced', n, a.split('\n')[0].trim().slice(0, 60));
};

// 1) updateRestaurantProfile
rep(
`    update.status = 'pending';
    if (currentRestaurant.status !== 'pending') {
        update.pendingApprovalType = 'changes';
    }
`,
`    // An approved restaurant stays approved (and listed) when it edits its profile; only a
    // restaurant that is not approved yet (onboarding / rejected resubmission) goes to review.
    const sendToReview = currentRestaurant.status !== 'approved';
    if (sendToReview) {
        update.status = 'pending';
        if (currentRestaurant.status !== 'pending') {
            update.pendingApprovalType = 'changes';
        }
    }
`, 1);
rep(
`            {
                $set: update,
                $unset: {
                    approvedAt: 1,
                    rejectedAt: 1,
                    rejectionReason: 1
                }
            },`,
`            {
                $set: update,
                ...(sendToReview
                    ? { $unset: { approvedAt: 1, rejectedAt: 1, rejectionReason: 1 } }
                    : {})
            },`, 1);
rep(
`        if (currentRestaurant.status !== 'pending') {
            const restaurantNameForNotification =`,
`        if (sendToReview && currentRestaurant.status !== 'pending') {
            const restaurantNameForNotification =`, 1);

// 2) image uploads (profile / cover / menu): same rule
const before = s;
s = s.replace(/(\n(\s*)const (\w+) = \{\n(?:\s*[\w]+: [^\n]+,\n)*?)\s*status: 'pending'\n(\s*)\};\n(\s*)if \(currentRestaurant\.status !== 'pending'\) \{\n\s*\3\.pendingApprovalType = 'changes';\n\s*\}\n/g,
  (m, head, ind, name, ind2, ind3) => {
    const body = head.replace(/,\n$/, '\n');
    return `${body}${ind2}};\n${ind3}const sendToReview = currentRestaurant.status !== 'approved'; // approved stays approved\n${ind3}if (sendToReview) {\n${ind3}    ${name}.status = 'pending';\n${ind3}    if (currentRestaurant.status !== 'pending') ${name}.pendingApprovalType = 'changes';\n${ind3}}\n`;
  });
console.log('upload blocks changed:', before !== s, (s.match(/approved stays approved/g) || []).length);
s = s.replace(/\$unset: \{\n(\s*)approvedAt: 1,\n\s*rejectedAt: 1,\n\s*rejectionReason: 1\n(\s*)\}/g,
  (m) => m); // left as-is below, handled per block
// unset + notify in upload functions
s = s.replace(/(\{\n\s*\$set: (profileUpdate|coverUpdate|menuUpdate|\w+Update),\n)(\s*)\$unset: \{\n\s*approvedAt: 1,\n\s*rejectedAt: 1,\n\s*rejectionReason: 1\n\s*\}\n/g,
  (m, head, name, ind) => `${head}${ind}...(sendToReview ? { $unset: { approvedAt: 1, rejectedAt: 1, rejectionReason: 1 } } : {})\n`);
s = s.replace(/if \(currentRestaurant\.status !== 'pending'\) \{\n(\s*)void notifyAdminsAboutRestaurantProfileReview/g,
  (m, ind) => `if (sendToReview && currentRestaurant.status !== 'pending') {\n${ind}void notifyAdminsAboutRestaurantProfileReview`);
fs.writeFileSync(f, s.replace(/\n/g, nl));
console.log('sendToReview uses:', (s.match(/sendToReview/g) || []).length);
