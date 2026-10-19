// Week 1 check: create order -> buyer approves -> capture -> partial refund, in the PayPal sandbox.
//
//   npm run paypal:week1                          full flow, $40 order, 30% refund
//   npm run paypal:week1 -- --amount 80 --refund-pct 25
//   npm run paypal:week1 -- --order <id>          resume: capture an already-approved order
//   npm run paypal:week1 -- --capture <id> --refund 5.00   refund only

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  PayPalError,
  approveLink,
  firstCapture,
  payPalFromEnv,
  toMoney,
  type PayPalCapture,
} from "../src/lib/paypal";

const { values: args } = parseArgs({
  options: {
    amount: { type: "string", default: "40" },
    "refund-pct": { type: "string", default: "30" },
    refund: { type: "string" },
    order: { type: "string" },
    capture: { type: "string" },
  },
});

if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  console.error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. Copy .env.example to .env and fill in your sandbox app keys.");
  process.exit(1);
}
const paypal = payPalFromEnv();
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

function step(label: string) {
  console.log(`\n== ${label}`);
}

async function waitForApproval(link: string) {
  console.log(`\nOpen this link, log in with your SANDBOX personal (buyer) account and approve:\n\n  ${link}\n`);
  console.log("After approving, PayPal redirects to localhost (a 404 there is fine).");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("Press Enter once you've approved... ");
  rl.close();
}

async function refund(capture: PayPalCapture, refundAmount: number) {
  const currency = capture.amount.currency_code;
  step(`Partial refund of ${refundAmount.toFixed(2)} ${currency} on capture ${capture.id}`);
  const result = await paypal.refundCapture(
    capture.id,
    toMoney(refundAmount, currency),
    `week1-refund-${capture.id}-${refundAmount.toFixed(2)}`,
    "ClipPay partial refund for reported damage",
  );
  console.log(`Refund ${result.id}: ${result.status}`);
  if (result.seller_payable_breakdown?.total_refunded_amount) {
    const t = result.seller_payable_breakdown.total_refunded_amount;
    console.log(`Total refunded on this capture so far: ${t.value} ${t.currency_code}`);
  }

  step("Re-read capture to confirm");
  const after = await paypal.getCapture(capture.id);
  console.log(`Capture ${after.id} status: ${after.status}`);
  if (after.status !== "PARTIALLY_REFUNDED" && after.status !== "REFUNDED") {
    throw new Error(`Expected PARTIALLY_REFUNDED, got ${after.status}`);
  }
}

async function main() {
  // Refund-only mode.
  if (args.capture) {
    if (!args.refund) throw new Error("--capture needs --refund <amount>");
    const capture = await paypal.getCapture(args.capture);
    console.log(`Capture ${capture.id}: ${capture.status}, ${capture.amount.value} ${capture.amount.currency_code}`);
    await refund(capture, Number(args.refund));
    return;
  }

  const amount = Number(args.amount);
  let orderId = args.order;

  if (!orderId) {
    step(`Create order for ${amount.toFixed(2)} USD`);
    const order = await paypal.createOrder({
      amount: toMoney(amount),
      description: "ClipPay demo item: ceramic mug",
      referenceId: `demo-${Date.now()}`,
      returnUrl: `${appUrl}/paypal/return`,
      cancelUrl: `${appUrl}/paypal/cancel`,
    });
    orderId = order.id;
    console.log(`Order ${order.id}: ${order.status}`);
    const link = approveLink(order);
    if (!link) throw new Error("No approval link on order");
    await waitForApproval(link);
  }

  step(`Capture order ${orderId}`);
  const before = await paypal.getOrder(orderId);
  if (before.status !== "APPROVED" && before.status !== "COMPLETED") {
    throw new Error(
      `Order is ${before.status}, not APPROVED. Approve it, then resume with: npm run paypal:week1 -- --order ${orderId}`,
    );
  }
  const captured = before.status === "COMPLETED" ? before : await paypal.captureOrder(orderId);
  const capture = firstCapture(captured);
  if (!capture) throw new Error("Order captured but no capture found");
  console.log(`Capture ${capture.id}: ${capture.status}, ${capture.amount.value} ${capture.amount.currency_code}`);
  if (capture.status !== "COMPLETED") {
    throw new Error(`Capture is ${capture.status}; refunds need a COMPLETED capture`);
  }

  const refundAmount = args.refund
    ? Number(args.refund)
    : Math.round(Number(capture.amount.value) * Number(args["refund-pct"])) / 100;
  await refund(capture, refundAmount);

  console.log("\nWeek 1 flow works: create -> approve -> capture -> partial refund.");
  console.log(`Save for later tests: capture id ${capture.id}`);
}

main().catch((err) => {
  if (err instanceof PayPalError) {
    console.error(`\nPayPal error: ${err.message}`);
    if (err.debugId) console.error(`debug_id: ${err.debugId}`);
    console.error(JSON.stringify(err.details, null, 2));
  } else {
    console.error(`\n${err instanceof Error ? err.message : err}`);
  }
  process.exit(1);
});
