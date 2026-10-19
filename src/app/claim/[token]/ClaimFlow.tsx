"use client";

import { Camera, CheckCircle2, Clock, ImagePlus, PackageCheck, Search, Sun, Truck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductArt } from "@/components/ProductArt";
import { Badge, Button, Card, cx, Eyebrow, Steps } from "@/components/ui";
import { formatCents } from "@/lib/catalog";
import type { BuyerClaimView } from "@/lib/claims";

const MAX_PHOTOS = 3;
const STEPS = ["Photo", "Offer", "Refund"];

export default function ClaimFlow({ token, initial }: { token: string; initial: BuyerClaimView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState<null | "grading" | "refunding">(null);
  const [error, setError] = useState<string | null>(null);
  const money = (c: number) => formatCents(c, view.currency);

  async function post(path: string, body: FormData | object, busyAs: "grading" | "refunding") {
    setBusy(busyAs);
    setError(null);
    try {
      const isForm = body instanceof FormData;
      const res = await fetch(`/api/claims/${token}/${path}`, {
        method: "POST",
        body: isForm ? body : JSON.stringify(body),
        headers: isForm ? undefined : { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      setView(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const step =
    view.status === "awaiting_photos" ? 0 : view.status === "refunded" ? 3 : ["offered", "refund_failed"].includes(view.status) ? 1 : 2;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProductArt sku={view.productSku} className="h-14 w-[75px] rounded-xl" />
          <div>
            <Eyebrow>Damage claim</Eyebrow>
            <h1 className="text-2xl font-semibold tracking-tight">{view.productName}</h1>
            <p className="text-sm text-muted">Paid {money(view.priceCents)}</p>
          </div>
        </div>
        <Steps steps={STEPS} current={step} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}

      {view.status === "awaiting_photos" && (
        <PhotoStep view={view} busy={busy === "grading"} onSubmit={(fd) => post("submit", fd, "grading")} />
      )}

      {view.status === "offered" && view.offer && (
        <OfferStep
          view={view}
          offerCents={view.offer.refundCents}
          busy={busy !== null}
          money={money}
          onAccept={() => post("accept", {}, "refunding")}
          onCounter={(cents) => post("counter", { cents }, "refunding")}
        />
      )}

      {view.status === "refunding" && (
        <StatusCard icon={<Clock className="h-6 w-6" />} tone="neutral" title="Sending your refund…">
          This usually takes a few seconds. You can refresh this page.
        </StatusCard>
      )}

      {view.status === "refunded" && view.agreedCents != null && (
        <StatusCard
          icon={<CheckCircle2 className="h-7 w-7 animate-pop" />}
          tone="good"
          title={`${money(view.agreedCents)} is on its way back`}
          footer={<Findings view={view} />}
        >
          Refunded to your PayPal account. Keep the item, and sorry it arrived damaged.
        </StatusCard>
      )}

      {view.status === "review" && (
        <StatusCard icon={<Search className="h-6 w-6" />} tone="neutral" title="We're taking a closer look">
          {view.message}
        </StatusCard>
      )}

      {view.status === "ineligible" && (
        <StatusCard icon={<X className="h-6 w-6" />} tone="bad" title="We can't offer a refund on this claim" footer={<Findings view={view} />}>
          {view.message}
        </StatusCard>
      )}

      {view.status === "denied" && (
        <StatusCard icon={<X className="h-6 w-6" />} tone="bad" title="The store reviewed your claim">
          {view.message}
        </StatusCard>
      )}

      {view.status === "refund_failed" && (
        <StatusCard icon={<X className="h-6 w-6" />} tone="bad" title="The refund didn't go through">
          <p>Your offer still stands.</p>
          <Button className="mt-4" disabled={busy !== null} onClick={() => post("accept", {}, "refunding")}>
            {busy ? "Trying again…" : `Try again (${money(view.agreedCents ?? 0)})`}
          </Button>
        </StatusCard>
      )}

      <p className="text-center text-xs text-faint">
        <Link href="/" className="underline-offset-2 hover:underline">
          Back to the shop
        </Link>
      </p>
    </div>
  );
}

// ---------- Step 1: photo ----------

function PhotoStep({ view, busy, onSubmit }: { view: BuyerClaimView; busy: boolean; onSubmit: (fd: FormData) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const secondsLeft = useCountdown(view.codeExpiresAt);
  const expired = secondsLeft <= 0;

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function add(list: FileList | null) {
    const picked = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("description", description);
    for (const f of files) fd.append("photos", f);
    onSubmit(fd);
  }

  if (busy) return <Grading preview={previews[0]} />;

  return (
    <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <Card className="flex flex-col p-6">
        <p className="text-sm font-medium">1 · Write this code on paper</p>
        <div className="my-6 flex justify-center">
          <div className="-rotate-2 rounded-lg bg-[#fffdf6] px-6 py-5 shadow-[0_12px_30px_-12px_rgb(0_0_0/0.35)] ring-1 ring-black/5">
            <p className="font-mono text-5xl font-bold tracking-[0.25em] text-ink" aria-label={`Code ${view.code.split("").join(" ")}`}>
              {view.code}
            </p>
          </div>
        </div>
        <ul className="space-y-2.5 text-sm text-muted">
          <Tip icon={<Camera className="h-4 w-4" />}>Put the paper next to the damage, both in the same shot.</Tip>
          <Tip icon={<Sun className="h-4 w-4" />}>Good light and a plain background work best.</Tip>
          <Tip icon={<Clock className="h-4 w-4" />}>
            {expired ? (
              <span className="font-medium text-bad">
                Code expired.{" "}
                <button type="button" className="underline" onClick={() => location.reload()}>
                  Get a new one
                </button>
              </span>
            ) : (
              <span suppressHydrationWarning>
                Valid for <span className="font-medium tabular-nums text-ink">{formatDuration(secondsLeft)}</span>. It proves the
                photo is new.
              </span>
            )}
          </Tip>
        </ul>
      </Card>

      <Card className="space-y-5 p-6">
        <div className="space-y-3">
          <p className="text-sm font-medium">2 · Add up to {MAX_PHOTOS} photos</p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              add(e.dataTransfer.files);
            }}
            className={cx(
              "grid grid-cols-3 gap-3 rounded-xl border-2 border-dashed p-3 transition-colors",
              dragging ? "border-brand bg-brand-soft" : "border-line",
            )}
          >
            {previews.map((src, i) => (
              <div key={src} className="group relative aspect-square overflow-hidden rounded-lg bg-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-90 hover:bg-black"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {files.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg bg-ink/[0.03] text-xs text-muted hover:bg-brand-soft hover:text-brand"
              >
                <ImagePlus className="h-6 w-6" />
                {files.length ? "Add another" : "Add photo"}
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            aria-label="Choose photos"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-faint">JPEG, PNG or WebP · drag photos here or tap to choose</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="description">
            3 · What&apos;s wrong with it? <span className="font-normal text-faint">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="e.g. One mug has a chip on the rim"
            className="w-full resize-none rounded-xl border border-line bg-paper/50 p-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>

        <Button size="lg" className="w-full" disabled={files.length === 0 || expired}>
          Get my offer
        </Button>
      </Card>
    </form>
  );
}

const GRADING_STAGES = ["Uploading your photos", "Reading your code", "Looking for damage", "Checking the store's policy"];

function Grading({ preview }: { preview?: string }) {
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setStage(Math.min(GRADING_STAGES.length - 1, elapsed < 2 ? 0 : elapsed < 5 ? 1 : elapsed < 12 ? 2 : 3));
  }, [elapsed]);

  return (
    <Card className="grid items-center gap-8 p-6 md:grid-cols-[220px_1fr]" aria-live="polite">
      <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-xl bg-ink/5">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-x-0 top-0 h-1/4 animate-scan bg-gradient-to-b from-transparent via-brand/40 to-transparent" />
      </div>
      <div>
        <p className="text-lg font-semibold">Checking your photos…</p>
        <ol className="mt-4 space-y-2.5">
          {GRADING_STAGES.map((s, i) => (
            <li key={s} className={cx("flex items-center gap-3 text-sm", i > stage ? "text-faint" : "text-ink")}>
              <span
                className={cx(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                  i < stage && "bg-good text-white",
                  i === stage && "border-2 border-brand border-t-transparent animate-spin",
                  i > stage && "border border-line",
                )}
              >
                {i < stage ? "✓" : ""}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-faint">
          Usually under a minute · <span className="tabular-nums">{elapsed}s</span>
        </p>
      </div>
    </Card>
  );
}

// ---------- Step 2: offer ----------

function OfferStep(props: {
  view: BuyerClaimView;
  offerCents: number;
  busy: boolean;
  money: (c: number) => string;
  onAccept: () => void;
  onCounter: (cents: number) => void;
}) {
  const { view, offerCents, busy, money } = props;
  const [counter, setCounter] = useState("");
  const [countering, setCountering] = useState(false);
  const counterCents = Math.round(Number(counter) * 100);
  const counterValid = counter !== "" && Number.isFinite(counterCents) && counterCents > offerCents;

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <Card className="p-7">
        <Eyebrow>Your offer</Eyebrow>
        <p className="mt-2 text-6xl font-semibold tracking-tight tabular-nums animate-pop">{money(offerCents)}</p>
        <p className="mt-2 text-sm text-muted">Refunded to your PayPal account straight away.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="good">
            <PackageCheck className="h-3.5 w-3.5" /> Keep the item
          </Badge>
          <Badge tone="good">
            <Truck className="h-3.5 w-3.5" /> Nothing to ship back
          </Badge>
        </div>
        <Button size="lg" className="mt-7 w-full" disabled={busy} onClick={props.onAccept}>
          {busy ? "Sending refund…" : `Accept ${money(offerCents)}`}
        </Button>

        {view.canCounter && !countering && (
          <button
            type="button"
            onClick={() => setCountering(true)}
            className="mt-3 w-full text-center text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Think it&apos;s worth more?
          </button>
        )}
        {view.canCounter && countering && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (counterValid) props.onCounter(counterCents);
            }}
            className="mt-5 space-y-2 border-t border-line pt-5"
          >
            <label htmlFor="counter" className="block text-sm font-medium">
              Ask for a different amount (once)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint">$</span>
                <input
                  id="counter"
                  autoFocus
                  inputMode="decimal"
                  value={counter}
                  onChange={(e) => setCounter(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder={(offerCents / 100 + 3).toFixed(2)}
                  className="h-10 w-full rounded-full border border-line bg-paper/50 pl-8 pr-4 text-sm tabular-nums outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </div>
              <Button variant="secondary" disabled={busy || !counterValid}>
                Ask
              </Button>
            </div>
            <p className="text-xs text-faint">If the store&apos;s policy allows it, you&apos;re refunded straight away. If not, a person reviews it.</p>
          </form>
        )}
      </Card>

      <Card className="p-6">
        <Findings view={view} />
      </Card>
    </div>
  );
}

const SEVERITY_LABEL: Record<string, string> = {
  none: "No damage",
  cosmetic: "Cosmetic",
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
  unusable: "Unusable",
};

function Findings({ view }: { view: BuyerClaimView }) {
  const f = view.findings;
  if (!f) return null;
  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>What we saw</Eyebrow>
        <Badge tone={f.severity === "none" ? "neutral" : "warn"}>{SEVERITY_LABEL[f.severity] ?? f.severity}</Badge>
      </div>
      {f.defects.length === 0 ? (
        <p className="text-sm text-muted">No visible damage in the photos.</p>
      ) : (
        <ul className="space-y-3">
          {f.defects.map((d, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium capitalize text-ink">
                {d.type.replace(/_/g, " ")} <span className="font-normal text-faint">· {d.location}</span>
              </p>
              <p className="text-muted">{d.description}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line pt-3 text-xs text-faint">
        Graded by AI from your photos. The amount comes from the store&apos;s refund policy, not the AI.
      </p>
    </div>
  );
}

// ---------- Shared ----------

function StatusCard(props: {
  icon: React.ReactNode;
  tone: "good" | "bad" | "neutral";
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ring = { good: "bg-good-soft text-good", bad: "bg-bad-soft text-bad", neutral: "bg-brand-soft text-brand" }[props.tone];
  return (
    <Card className="p-8 text-center">
      <span className={cx("mx-auto flex h-14 w-14 items-center justify-center rounded-full", ring)}>{props.icon}</span>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{props.title}</p>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted">{props.children}</div>
      {props.footer && <div className="mx-auto mt-8 max-w-md border-t border-line pt-6">{props.footer}</div>}
    </Card>
  );
}

function Tip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 text-brand">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function useCountdown(until: string): number {
  const target = Date.parse(until);
  const [left, setLeft] = useState(() => Math.round((target - Date.now()) / 1000));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.round((target - Date.now()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
