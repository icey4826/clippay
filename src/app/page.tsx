import { formatCents, PRODUCTS } from "@/lib/catalog";

export default async function Shop({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const { error, cancelled } = await searchParams;
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Demo shop</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Buy something with a PayPal sandbox account. If it &quot;arrives damaged&quot;, file a claim with a photo and
          get a partial refund in seconds, with no return shipping.
        </p>
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {cancelled && <p className="rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">Checkout cancelled.</p>}

      <ul className="grid gap-4 sm:grid-cols-3">
        {PRODUCTS.map((p) => (
          <li key={p.sku} className="flex flex-col rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="font-medium">{p.name}</h2>
            <p className="mt-1 flex-1 text-sm text-neutral-600 dark:text-neutral-400">{p.blurb}</p>
            <p className="mt-4 text-lg font-semibold">{formatCents(p.priceCents, p.currency)}</p>
            <form action="/api/checkout" method="post" className="mt-3">
              <input type="hidden" name="sku" value={p.sku} />
              <button className="w-full rounded-full bg-[#ffc439] py-2 text-sm font-semibold text-[#003087] hover:brightness-95">
                Buy with PayPal
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
