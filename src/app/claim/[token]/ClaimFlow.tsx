"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/catalog";
import type { BuyerClaimView } from "@/lib/claims";

const MAX_PHOTOS = 3;

export default function ClaimFlow({ token, initial }: { token: string; initial: BuyerClaimView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState<null | "grading" | "refunding">(null);
  const [error, setError] = useState<string | null>(null);
  const money = (c: number) => formatCents(c, view.currency);

  async function post(path: string, body: BodyInit | object, busyAs: "grading" | "refunding") {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Damage claim</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          {view.productName} · paid {money(view.priceCents)}
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

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

      {view.status === "refunding" && <Notice tone="neutral" title="Sending your refund…" />}

      {view.status === "refunded" && view.agreedCents != null && (
        <Notice
          tone="good"
          title={`Refunded ${money(view.agreedCents)}`}
          body="The money is on its way back to your PayPal account. You keep the item. Sorry it arrived damaged."
        />
      )}

      {view.status === "review" && <Notice tone="neutral" title="We're taking a closer look" body={view.message} />}

      {view.status === "ineligible" && <Notice tone="bad" title="We can't offer a refund on this claim" body={view.message} />}

      {view.status === "refund_failed" && (
        <div className="space-y-3">
          <Notice tone="bad" title="The refund didn't go through" body="Your offer still stands. Try again." />
          <button
            disabled={busy !== null}
            onClick={() => post("accept", {}, "refunding")}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {busy ? "Trying again…" : `Try again (${money(view.agreedCents ?? 0)})`}
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoStep({ view, busy, onSubmit }: { view: BuyerClaimView; busy: boolean; onSubmit: (fd: FormData) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const secondsLeft = useCountdown(view.codeExpiresAt);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("description", description);
    for (const f of files) fd.append("photos", f);
    onSubmit(fd);
  }

  const expired = secondsLeft <= 0;

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm font-medium">1. Write this code on a piece of paper</p>
        <p className="mt-3 font-mono text-5xl font-bold tracking-[0.3em]">{view.code}</p>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          Put it next to the damage so both are in the same photo. It shows the photo was taken just now.{" "}
          {expired ? (
            <span className="font-medium text-red-700">
              Code expired.{" "}
              <button type="button" className="underline" onClick={() => location.reload()}>
                Get a new one
              </button>
            </span>
          ) : (
            <span suppressHydrationWarning>Valid for {formatDuration(secondsLeft)}.</span>
          )}
        </p>
      </section>

      <section className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="photos">
          2. Take up to {MAX_PHOTOS} photos of the damage
        </label>
        <input
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:file:bg-white dark:file:text-neutral-900"
        />
        {previews.length > 0 && (
          <div className="flex gap-2">
            {previews.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element -- local blob previews
              <img key={src} src={src} alt="" className="h-24 w-24 rounded-lg object-cover" />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="description">
          3. What&apos;s wrong with it? <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. One mug has a chip on the rim"
          className="w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm dark:border-neutral-700"
        />
      </section>

      <button
        disabled={busy || files.length === 0 || expired}
        className="w-full rounded-full bg-neutral-900 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {busy ? "Checking your photos…" : "Send photos"}
      </button>
    </form>
  );
}

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
  const counterCents = Math.round(Number(counter) * 100);
  const counterValid = counter !== "" && Number.isFinite(counterCents) && counterCents > offerCents;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Our offer</p>
        <p className="mt-1 text-4xl font-semibold">{money(offerCents)}</p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Refunded to your PayPal account now. Keep the item; there&apos;s nothing to send back.
        </p>
        <button
          disabled={busy}
          onClick={props.onAccept}
          className="mt-4 w-full rounded-full bg-neutral-900 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {busy ? "Sending refund…" : `Accept ${money(offerCents)}`}
        </button>
      </section>

      {view.canCounter && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (counterValid) props.onCounter(counterCents);
          }}
          className="space-y-2"
        >
          <label htmlFor="counter" className="block text-sm font-medium">
            Think it&apos;s worth more? Ask once.
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
              <input
                id="counter"
                inputMode="decimal"
                value={counter}
                onChange={(e) => setCounter(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={(offerCents / 100 + 5).toFixed(2)}
                className="w-full rounded-full border border-neutral-300 bg-transparent py-2 pl-7 pr-3 text-sm dark:border-neutral-700"
              />
            </div>
            <button
              disabled={busy || !counterValid}
              className="rounded-full border border-neutral-900 px-5 py-2 text-sm font-medium disabled:opacity-40 dark:border-white"
            >
              Ask
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            If we can approve it, you&apos;re refunded straight away. Otherwise a person reviews it.
          </p>
        </form>
      )}
    </div>
  );
}

function Notice({ tone, title, body }: { tone: "good" | "bad" | "neutral"; title: string; body?: string | null }) {
  const styles = {
    good: "bg-emerald-50 text-emerald-900",
    bad: "bg-red-50 text-red-900",
    neutral: "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100",
  }[tone];
  return (
    <section className={`rounded-xl p-5 ${styles}`}>
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm">{body}</p>}
    </section>
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
