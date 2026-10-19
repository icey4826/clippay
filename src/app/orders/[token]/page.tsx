import { CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductArt } from "@/components/ProductArt";
import { buttonClass, Card, Eyebrow } from "@/components/ui";
import { formatCents } from "@/lib/catalog";
import { getClaimForOrder, getOrderByToken } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const claim = await getClaimForOrder(order.id);
  const money = (c: number) => formatCents(c, order.currency);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-good animate-pop" />
        <div>
          <Eyebrow>Order confirmed</Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">Thanks for your order</h1>
        </div>
      </div>

      <Card className="flex gap-5 overflow-hidden p-0">
        <ProductArt sku={order.productSku} className="w-36 shrink-0 sm:w-44" />
        <dl className="grid flex-1 grid-cols-[auto_1fr] content-center gap-x-6 gap-y-2 py-5 pr-5 text-sm">
          <dt className="text-faint">Item</dt>
          <dd className="font-medium">{order.productName}</dd>
          <dt className="text-faint">Paid</dt>
          <dd className="tabular-nums">{money(order.priceCents)} via PayPal</dd>
          {order.refundedCents > 0 && (
            <>
              <dt className="text-faint">Refunded</dt>
              <dd className="tabular-nums text-good">{money(order.refundedCents)}</dd>
            </>
          )}
          <dt className="text-faint">Order</dt>
          <dd className="truncate font-mono text-xs leading-5 text-muted">{order.id}</dd>
        </dl>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">Did it arrive damaged?</p>
            <p className="mt-1 text-sm text-muted">
              Send one photo and get an offer in about a minute. You keep the item; there&apos;s nothing to ship back.
            </p>
            <Link href={`/claim/${token}`} className={buttonClass("primary") + " mt-4"}>
              {claim ? "View your claim" : "Report damage"}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
