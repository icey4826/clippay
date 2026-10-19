import { Camera, ScanSearch, Scale, Wallet } from "lucide-react";
import { ProductArt } from "@/components/ProductArt";
import { buttonClass, Card, Eyebrow } from "@/components/ui";
import { formatCents, PRODUCTS } from "@/lib/catalog";

const HOW = [
  { icon: Camera, title: "Snap the damage", body: "Photo with a one-time code on paper, so it's taken now, not found online." },
  { icon: ScanSearch, title: "AI grades it", body: "A vision model describes the defect and its severity as strict JSON." },
  { icon: Scale, title: "Rules set the price", body: "The merchant's policy, not the AI, turns the grade into an offer." },
  { icon: Wallet, title: "PayPal pays", body: "A partial refund lands in seconds. No return label, no warehouse trip." },
];

export default async function Shop({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const { error, cancelled } = await searchParams;
  return (
    <div className="space-y-14">
      <section className="grid items-end gap-6 pt-6 sm:pt-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Eyebrow>Demo shop</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Arrived chipped? Get money back in a minute, keep the item.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Buy something with a PayPal sandbox account, then file a damage claim with one photo. ClipPay settles it with a
            partial refund instead of a full return.
          </p>
        </div>
        <Card className="p-5 text-sm">
          <p className="font-medium">Why merchants want this</p>
          <p className="mt-1 text-muted">
            A $40 mug set returned costs the price plus about $8 shipping. Settling a chip for $4–8 keeps the sale and the
            customer.
          </p>
        </Card>
      </section>

      {error && <p className="rounded-xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      {cancelled && <p className="rounded-xl bg-ink/5 p-3 text-sm text-muted">Checkout cancelled. Nothing was charged.</p>}

      <section className="grid gap-5 sm:grid-cols-3">
        {PRODUCTS.map((p) => (
          <Card key={p.sku} className="flex flex-col overflow-hidden">
            <ProductArt sku={p.sku} className="aspect-[4/3] w-full" />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium">{p.name}</h2>
                <p className="font-semibold tabular-nums">{formatCents(p.priceCents, p.currency)}</p>
              </div>
              <p className="mt-1 flex-1 text-sm text-muted">{p.blurb}</p>
              <form action="/api/checkout" method="post" className="mt-5">
                <input type="hidden" name="sku" value={p.sku} />
                <button className={buttonClass("paypal", "md") + " w-full"}>
                  Buy with <span className="font-bold italic">PayPal</span>
                </button>
              </form>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-5">
        <Eyebrow>How a claim works</Eyebrow>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl border border-line p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-faint">0{i + 1}</span>
              </div>
              <p className="mt-4 font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
