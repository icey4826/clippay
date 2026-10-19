import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "paypal" | "danger";

const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-black",
  secondary: "border border-line bg-surface text-ink hover:border-ink/30",
  ghost: "text-muted hover:text-ink hover:bg-ink/5",
  paypal: "bg-[#ffc439] text-[#0c2a72] hover:bg-[#f5b919]",
  danger: "border border-bad/30 bg-surface text-bad hover:bg-bad-soft",
};

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "lg" | "sm" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    size === "lg" && "h-12 px-6 text-[15px]",
    size === "md" && "h-10 px-5 text-sm",
    size === "sm" && "h-8 px-3 text-xs",
    BUTTON[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "md" | "lg" | "sm" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-surface shadow-card", className)} {...props} />;
}

type Tone = "neutral" | "brand" | "good" | "warn" | "bad";
const BADGE: Record<Tone, string> = {
  neutral: "bg-ink/5 text-muted",
  brand: "bg-brand-soft text-brand-ink",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE[tone], className)}>
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">{children}</p>;
}

/** Horizontal progress for the buyer flow. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs font-medium">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cx(
              "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
              i < current && "bg-ink text-white",
              i === current && "bg-brand text-white ring-4 ring-brand/15",
              i > current && "bg-ink/5 text-faint",
            )}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className={cx("hidden sm:inline", i === current ? "text-ink" : "text-faint")}>{s}</span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <rect width="24" height="24" rx="7" fill="var(--brand)" />
        <path
          d="M15.5 8.5 10 14a1.6 1.6 0 0 1-2.3-2.3l6-6a2.8 2.8 0 0 1 4 4l-6.3 6.3a4 4 0 0 1-5.7-5.7l5.6-5.6"
          fill="none"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(0.5 1.5) scale(0.92)"
        />
      </svg>
      ClipPay
    </span>
  );
}
