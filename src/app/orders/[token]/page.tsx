import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@/lib/catalog";
import { getClaimForOrder, getOrderByToken } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const claim = await getClaimForOrder(order.id);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Thanks for your order</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <dt className="text-neutral-500">Item</dt>
        <dd>{order.productName}</dd>
        <dt className="text-neutral-500">Paid</dt>
        <dd>{formatCents(order.priceCents, order.currency)}</dd>
        {order.refundedCents > 0 && (
          <>
            <dt className="text-neutral-500">Refunded</dt>
            <dd>{formatCents(order.refundedCents, order.currency)}</dd>
          </>
        )}
        <dt className="text-neutral-500">PayPal order</dt>
        <dd className="font-mono text-xs leading-5">{order.id}</dd>
      </dl>
      <div className="rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900">
        <p className="font-medium">Did it arrive damaged?</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Send a photo and we&apos;ll offer a partial refund right away. You keep the item.
        </p>
        <Link
          href={`/claim/${token}`}
          className="mt-3 inline-block rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {claim ? "View your claim" : "Report damage"}
        </Link>
      </div>
    </div>
  );
}
