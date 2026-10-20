// #96-98: restaurant finance amounts from the order's own pricing (orderMoney helper).
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'src', 'modules', 'food', 'restaurant', 'services', 'restaurantFinance.service.js');
let s = fs.readFileSync(f, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');
const rep = (a, b, expected) => {
  const n = s.split(a).length - 1;
  if (n !== expected) throw new Error(`expected ${expected} got ${n}: ${a.slice(0, 70)}`);
  s = s.split(a).join(b);
  console.log('replaced', n, a.trim().split('\n')[0].slice(0, 70));
};

// current cycle mapping
rep(`        const orderTotalExclTax = Math.max(
            0,
            Number(
              order?.pricing?.baseSubtotal ??
                (Number(order?.pricing?.subtotal ?? 0) - Number(order?.pricing?.markupTotal ?? 0))
            ) || 0
        );
        return {
            orderId: order?.order_id || tx.orderReadableId,
            createdAt: tx.createdAt,
            items,
            foodNames,
            orderTotal: orderTotalExclTax,
            totalAmount: tx.amounts?.totalCustomerPaid || 0,
            payout: tx.amounts?.restaurantShare || 0,
            commission: tx.amounts?.restaurantCommission || 0,`,
`        const money = orderMoney(order, tx);
        return {
            orderId: order?.order_id || tx.orderReadableId,
            createdAt: tx.createdAt,
            items,
            foodNames,
            orderTotal: money.food,
            totalAmount: money.customerPaid,
            payout: money.earning,
            commission: money.commission,
            tax: money.tax,`, 1);

// past cycles mapping
rep(`            const orderTotalExclTax = Math.max(
                0,
                Number(order?.pricing?.total ?? 0) - Number(order?.pricing?.tax ?? 0) || 0
            );

            return {
                orderId: order?.order_id || tx.orderReadableId,
                createdAt: tx.createdAt,
                items,
                foodNames,
                orderTotal: orderTotalExclTax,
                totalAmount: tx.amounts?.totalCustomerPaid || 0,
                payout: tx.amounts?.restaurantShare || 0,
                commission: tx.amounts?.restaurantCommission || 0,`,
`            const money = orderMoney(order, tx);

            return {
                orderId: order?.order_id || tx.orderReadableId,
                createdAt: tx.createdAt,
                items,
                foodNames,
                orderTotal: money.food,
                totalAmount: money.customerPaid,
                payout: money.earning,
                commission: money.commission,
                tax: money.tax,`, 1);

// available balance: same earning formula
rep(`    }).populate({ path: 'orderId', select: 'orderStatus' }).lean();`,
`    }).populate({ path: 'orderId', select: 'orderStatus pricing' }).lean();`, 1);
rep(`            (sum, tx) => sum + (Number(tx.amounts?.restaurantShare) || 0),`,
`            (sum, tx) => sum + orderMoney(tx.orderId, tx).earning,`, 1);

// invoice summary: gross = food total (not what the customer paid)
rep(`        taxes: currentCycleOrders.reduce((sum, o) => sum + Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.orderTotal) || 0)), 0),
        gross: currentCycleOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)`,
`        taxes: currentCycleOrders.reduce((sum, o) => sum + (Number(o.tax) || 0), 0),
        gross: currentCycleOrders.reduce((sum, o) => sum + (Number(o.orderTotal) || 0), 0),
        commission: currentCycleOrders.reduce((sum, o) => sum + (Number(o.commission) || 0), 0),
        earnings: currentCycleOrders.reduce((sum, o) => sum + (Number(o.payout) || 0), 0)`, 1);

fs.writeFileSync(f, s.replace(/\n/g, nl));
