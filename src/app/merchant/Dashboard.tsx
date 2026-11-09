"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type ICellRendererParams, type RowStyle } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AlertTriangle, Check, Clock, Download, PiggyBank, RotateCw, Search, ShieldCheck, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ProductArt } from "@/components/ProductArt";
import { Badge, Button, Card, cx, Eyebrow } from "@/components/ui";
import { formatCents } from "@/lib/catalog";
import type { MerchantRow, MerchantStats } from "@/lib/merchant";
import type { MerchantPolicy } from "@/lib/rules";
import ClaimCharts, { matchesChartFilter, severityLabel, type ChartFilter } from "./ClaimCharts";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  browserColorScheme: "inherit", // keep the page's "only light" so Chrome's forced dark mode skips the grid
  fontFamily: "inherit",
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 600,
  headerTextColor: "#8d92a0",
  headerBackgroundColor: "#ffffff",
  backgroundColor: "#ffffff",
  foregroundColor: "#15171c",
  borderColor: "#e7e3da",
  rowBorder: { color: "#efece5" },
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  accentColor: "#2f4bff",
  selectedRowBackgroundColor: "#eceffe",
  rowHoverColor: "#faf9f6",
  spacing: 7,
});

type Tone = "neutral" | "brand" | "good" | "warn" | "bad";
const STATUS: Record<MerchantRow["status"], { label: string; tone: Tone }> = {
  awaiting_photos: { label: "Waiting for photos", tone: "neutral" },
  offered: { label: "Offer sent", tone: "brand" },
  review: { label: "Needs review", tone: "warn" },
  ineligible: { label: "Ineligible", tone: "neutral" },
  denied: { label: "Declined", tone: "bad" },
  refunding: { label: "Refunding", tone: "brand" },
  refunded: { label: "Refunded", tone: "good" },
  refund_failed: { label: "Refund failed", tone: "bad" },
};

const RESOLUTION_LABEL: Record<string, string> = {
  auto_offer: "Auto · offer",
  auto_counter: "Auto · counter",
  merchant: "Merchant",
};

const REASON_LABEL: Record<string, string> = {
  PHOTO_UNUSABLE: "Unclear photo",
  NOT_REAL_PHOTO: "Not a real photo",
  ITEM_MISMATCH: "Wrong item",
  CODE_MISSING_OR_WRONG: "Code missing",
  DUPLICATE_IMAGE: "Duplicate photo",
  TOO_MANY_CLAIMS: "Repeat claimer",
  LOW_CONFIDENCE: "Low confidence",
  ABOVE_CEILING: "Above ceiling",
  ABOVE_AUTO_APPROVE_LIMIT: "Above auto limit",
  ORDER_TOO_OLD: "Order too old",
  NOTHING_LEFT_TO_REFUND: "Fully refunded",
  NO_DAMAGE_VISIBLE: "No damage",
};

const money = (c: number | null | undefined, cur = "USD") => (c == null ? "–" : formatCents(c, cur));

function seconds(s: number | null) {
  if (s == null) return "–";
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}

type Filter = "all" | "review" | "refunded" | "other";

const inTab = (r: MerchantRow, f: Filter) =>
  f === "all"
    ? true
    : f === "review"
      ? r.status === "review" || r.status === "refund_failed"
      : f === "refunded"
        ? r.status === "refunded"
        : !["review", "refund_failed", "refunded"].includes(r.status);

const TOTAL_ID = "__total";
const isTotal = (p: { node?: { rowPinned?: string | null } | null }) => !!p.node?.rowPinned;

// The pinned bottom row sums whatever the grid is showing after tabs, chart, search and column filters.
function totalRow(rows: MerchantRow[]): MerchantRow {
  const sum = (pick: (r: MerchantRow) => number | null) => rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
  const settled = rows.filter((r) => r.settleSeconds != null).map((r) => r.settleSeconds!).sort((a, b) => a - b);
  return {
    id: TOTAL_ID,
    productName: `${rows.length} claim${rows.length === 1 ? "" : "s"}`,
    refundedCents: sum((r) => r.refundedCents),
    savingsCents: sum((r) => r.savingsCents),
    settleSeconds: settled.length ? settled[Math.floor(settled.length / 2)] : null,
    reasons: [],
  } as unknown as MerchantRow;
}

const dateFilterParams = {
  comparator: (day: Date, cell: string | null) => {
    if (!cell) return -1;
    const d = new Date(cell);
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return local === day.getTime() ? 0 : local < day.getTime() ? -1 : 1;
  },
};

export default function Dashboard({ rows, stats, policy }: { rows: MerchantRow[]; stats: MerchantStats; policy: MerchantPolicy }) {
  const gridRef = useRef<AgGridReact<MerchantRow>>(null);
  const [selectedId, setSelectedId] = useState<string | null>(rows.find((r) => r.status === "review")?.id ?? rows[0]?.id ?? null);
  const [filter, setFilter] = useState<Filter>("all");
  const [chartFilter, setChartFilter] = useState<ChartFilter | null>(null);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(rows.length);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const filtered = useMemo(() => rows.filter((r) => inTab(r, filter) && matchesChartFilter(r, chartFilter)), [rows, filter, chartFilter]);

  const columns = useMemo<ColDef<MerchantRow>[]>(
    () => [
      {
        headerName: "Filed",
        field: "submittedAt",
        width: 96,
        sort: "desc",
        filter: "agDateColumnFilter",
        filterParams: dateFilterParams,
        valueFormatter: (p) =>
          isTotal(p) ? "Total" : p.value ? new Date(p.value).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "–",
        tooltipValueGetter: (p) => (p.value && !isTotal(p) ? new Date(p.value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : undefined),
        cellClass: (p) => (isTotal(p) ? "font-semibold" : undefined),
      },
      {
        headerName: "Item",
        field: "productName",
        width: 170,
        tooltipValueGetter: (p) => (isTotal(p) ? undefined : `${p.value}${p.data?.demo ? " (demo data)" : ""}`),
        pinned: "left",
        cellRenderer: (p: ICellRendererParams<MerchantRow>) =>
          isTotal(p) ? (
            <span className="font-semibold">{p.value}</span>
          ) : (
            <span className="flex items-center gap-2.5">
              <ProductArt sku={p.data!.productSku} className="h-7 w-9 shrink-0 rounded-md" />
              <span className="truncate">{p.value}</span>
            </span>
          ),
      },
      {
        headerName: "Status",
        field: "status",
        width: 142,
        valueFormatter: (p) => (isTotal(p) ? "" : STATUS[p.value as MerchantRow["status"]].label),
        filterValueGetter: (p) => STATUS[p.data!.status].label,
        getQuickFilterText: (p) => STATUS[p.data.status].label,
        cellRenderer: (p: ICellRendererParams<MerchantRow>) => {
          if (isTotal(p)) return null;
          const r = p.data!;
          const s = STATUS[r.status];
          const by = r.status === "refunded" && r.resolution ? (r.resolution === "merchant" ? "by you" : "auto") : null;
          return (
            <span className="flex h-full items-center gap-1.5">
              <Badge tone={s.tone}>{s.label}</Badge>
              {by && <span className="text-[11px] text-faint">{by}</span>}
            </span>
          );
        },
      },
      {
        headerName: "Severity",
        field: "severity",
        width: 92,
        valueFormatter: (p) => (isTotal(p) ? "" : p.value ? severityLabel(String(p.value)) : "–"),
      },
      {
        headerName: "Flags",
        field: "reasons",
        flex: 1,
        minWidth: 116,
        sortable: false,
        valueFormatter: (p) => (p.value as MerchantRow["reasons"]).map((r) => REASON_LABEL[r.code] ?? r.code).join(", "),
        filterValueGetter: (p) => p.data!.reasons.map((r) => REASON_LABEL[r.code] ?? r.code).join(", "),
        getQuickFilterText: (p) => p.data.reasons.map((r) => REASON_LABEL[r.code] ?? r.code).join(" "),
        tooltipValueGetter: (p) => (isTotal(p) ? undefined : p.data?.reasons.map((r) => `${REASON_LABEL[r.code] ?? r.code}: ${r.message}`).join("\n") || undefined),
        cellRenderer: (p: ICellRendererParams<MerchantRow>) => {
          if (isTotal(p)) return null;
          const reasons = p.data!.reasons;
          if (!reasons.length) return <span className="text-faint">–</span>;
          return (
            <span className="flex h-full items-center gap-1 overflow-hidden">
              {reasons.map((r) => (
                <Badge key={r.code} tone={r.code === "NO_DAMAGE_VISIBLE" || r.code === "ORDER_TOO_OLD" ? "neutral" : "warn"}>
                  {REASON_LABEL[r.code] ?? r.code}
                </Badge>
              ))}
            </span>
          );
        },
      },
      {
        headerName: "Refund",
        colId: "refund",
        width: 88,
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        valueGetter: (p) => (p.data ? (p.data.refundedCents ?? p.data.offerCents ?? null) : null),
        filterValueGetter: (p) => ((p.data!.refundedCents ?? p.data!.offerCents) ?? 0) / 100,
        valueFormatter: (p) => money(p.value, p.data?.currency),
        cellRenderer: (p: ICellRendererParams<MerchantRow>) => {
          const r = p.data!;
          if (isTotal(p) || r.refundedCents != null) return <span className="font-medium tabular-nums">{money(r.refundedCents, r.currency)}</span>;
          return (
            <span className="tabular-nums text-faint" title="Offered or suggested, not paid">
              {money(r.offerCents, r.currency)}
            </span>
          );
        },
      },
      {
        headerName: "Kept",
        headerTooltip: "Price not refunded plus the return shipping a full return would have cost",
        field: "savingsCents",
        width: 84,
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        filterValueGetter: (p) => (p.data!.savingsCents ?? 0) / 100,
        valueFormatter: (p) => money(p.value, p.data?.currency),
        cellClass: (p) => cx("tabular-nums", p.value != null && "text-good", isTotal(p) && "font-semibold"),
      },
      {
        headerName: "Settled by",
        field: "resolution",
        hide: true,
        valueFormatter: (p) => (isTotal(p) ? "" : p.data?.status === "refunded" || p.data?.status === "denied" ? (p.value === "merchant" ? "You" : p.value ? "Auto" : "–") : "–"),
        filterValueGetter: (p) => (p.data!.resolution === "merchant" ? "You" : p.data!.resolution ? "Auto" : ""),
      },
      {
        headerName: "Time",
        headerTooltip: "From photo to money (or decision). The total row shows the median.",
        field: "settleSeconds",
        width: 76,
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        valueFormatter: (p) => (isTotal(p) && p.value != null ? `≈ ${seconds(p.value)}` : seconds(p.value)),
        cellClass: "tabular-nums",
      },
      { headerName: "Buyer", field: "buyer", hide: true },
      { headerName: "PayPal order", field: "orderId", hide: true },
      { headerName: "PayPal refund", field: "refundId", hide: true },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<MerchantRow>>(() => ({ filter: true, resizable: true, sortable: true, suppressHeaderMenuButton: false }), []);

  const counts = {
    all: rows.filter((r) => matchesChartFilter(r, chartFilter)).length,
    review: rows.filter((r) => inTab(r, "review") && matchesChartFilter(r, chartFilter)).length,
    refunded: rows.filter((r) => inTab(r, "refunded") && matchesChartFilter(r, chartFilter)).length,
    other: rows.filter((r) => inTab(r, "other") && matchesChartFilter(r, chartFilter)).length,
  };

  const chartLabel =
    chartFilter && (chartFilter.kind === "severity" ? `${severityLabel(chartFilter.value)} damage` : chartFilter.value);

  function refreshTotals(api: GridApi<MerchantRow>) {
    const visible: MerchantRow[] = [];
    api.forEachNodeAfterFilterAndSort((n) => n.data && visible.push(n.data));
    api.setGridOption("pinnedBottomRowData", [totalRow(visible)]);
    setShown(visible.length);
  }

  function select(api: GridApi<MerchantRow>, id: string | undefined) {
    if (!id || id === TOTAL_ID) return;
    setSelectedId(id);
    api.getRowNode(id)?.setSelected(true, true);
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Merchant</Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">Damage claims</h1>
        </div>
        <PolicySummary policy={policy} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={<Wallet className="h-4 w-4" />} label="Refunded" value={money(stats.refundedCents)} sub={stats.avgRefundPct != null ? `avg ${stats.avgRefundPct}% of price` : undefined} />
        <Stat
          icon={<PiggyBank className="h-4 w-4" />}
          label="Saved vs. full returns"
          value={money(stats.savingsCents)}
          sub="price kept + return shipping"
          highlight
        />
        <Stat
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Settled automatically"
          value={stats.autoSettledPct == null ? "–" : `${stats.autoSettledPct}%`}
          sub={`${stats.claims} claims filed`}
        />
        <Stat icon={<Clock className="h-4 w-4" />} label="Median time to refund" value={seconds(stats.medianSettleSeconds)} sub="photo to money, automatic" />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Needs review"
          value={String(stats.inReview)}
          sub={stats.inReview ? "waiting on you" : "all clear"}
          warn={stats.inReview > 0}
        />
      </div>

      {rows.length > 0 && <ClaimCharts rows={rows} filter={chartFilter} onFilter={setChartFilter} />}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <div className="flex gap-1">
              {(["all", "review", "refunded", "other"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cx(
                    "rounded-full px-3 py-1.5 text-xs font-medium",
                    filter === f ? "bg-ink text-white" : "text-muted hover:bg-ink/5",
                  )}
                >
                  {{ all: "All", review: "Needs action", refunded: "Refunded", other: "Other" }[f]}
                  <span className="ml-1.5 opacity-60">{counts[f]}</span>
                </button>
              ))}
            </div>
            {chartFilter && (
              <button
                onClick={() => setChartFilter(null)}
                className="flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink hover:bg-brand/15"
                aria-label={`Clear chart filter ${chartLabel}`}
              >
                {chartLabel} <X className="h-3 w-3" />
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <input
                  aria-label="Search claims"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search buyer, item, flag…"
                  className="h-8 w-48 rounded-full border border-line bg-surface pl-8 pr-3 text-xs outline-none focus:border-brand"
                />
              </label>
              <Button
                variant="secondary"
                size="sm"
                disabled={rows.length === 0}
                onClick={() =>
                  gridRef.current?.api.exportDataAsCsv({
                    fileName: `clippay-claims-${new Date().toISOString().slice(0, 10)}.csv`,
                    allColumns: true,
                  })
                }
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted">
              No claims yet. Buy something in the shop and report damage, or run <code className="font-mono">npm run seed:demo</code>.
            </div>
          ) : (
            <div className="h-[560px]">
              <AgGridReact<MerchantRow>
                ref={gridRef}
                theme={gridTheme}
                rowData={filtered}
                columnDefs={columns}
                defaultColDef={defaultColDef}
                getRowId={(p) => p.data.id}
                quickFilterText={search}
                includeHiddenColumnsInQuickFilter
                rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
                onRowClicked={(e) => select(e.api, e.data?.id)}
                // Arrow keys walk through claims and the detail panel follows.
                onCellFocused={(e) => {
                  if (e.rowPinned || e.rowIndex == null) return;
                  select(e.api, e.api.getDisplayedRowAtIndex(e.rowIndex)?.data?.id);
                }}
                onFirstDataRendered={(e) => {
                  if (selectedId) e.api.getRowNode(selectedId)?.setSelected(true);
                }}
                onModelUpdated={(e) => refreshTotals(e.api)}
                getRowStyle={(p): RowStyle | undefined =>
                  p.node.rowPinned
                    ? { background: "#faf9f6" }
                    : p.data?.status === "review" || p.data?.status === "refund_failed"
                      ? { boxShadow: "inset 3px 0 0 #e08a00" }
                      : undefined
                }
                tooltipShowDelay={250}
                overlayNoRowsTemplate="No claims match these filters."
                rowHeight={46}
                headerHeight={40}
                animateRows
              />
            </div>
          )}
          {rows.length > 0 && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
              Showing {shown} of {rows.length}. Column menus filter and sort; the total row follows every filter. ↑/↓ moves through claims.
            </p>
          )}
        </Card>

        {selected ? <ClaimDetail key={selected.id} row={selected} /> : <Card className="p-8 text-center text-sm text-muted">Pick a claim to see the photos and grade.</Card>}
      </div>
    </div>
  );
}

function Stat(props: { icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean; warn?: boolean }) {
  return (
    <Card className={cx("p-4", props.highlight && "border-good/30 bg-good-soft/40", props.warn && "border-warn/30 bg-warn-soft/50")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className={cx(props.highlight ? "text-good" : props.warn ? "text-warn" : "text-brand")}>{props.icon}</span>
        {props.label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{props.value}</p>
      {props.sub && <p className="mt-0.5 text-xs text-faint">{props.sub}</p>}
    </Card>
  );
}

function PolicySummary({ policy }: { policy: MerchantPolicy }) {
  const b = policy.refundPctBySeverity;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span className="font-medium text-ink">Policy</span>
      <Badge>Cosmetic {b.cosmetic}%</Badge>
      <Badge>Minor {b.minor}%</Badge>
      <Badge>Moderate {b.moderate}%</Badge>
      <Badge>Severe {b.severe}%</Badge>
      <Badge tone="brand">Cap {policy.maxRefundPct}%</Badge>
      <Badge tone="brand">Auto ≤ {money(policy.autoApproveLimitCents)}</Badge>
    </div>
  );
}

function ClaimDetail({ row }: { row: MerchantRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approve" | "deny" | "retry">(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(row.offerCents != null ? (row.counterCents ?? row.offerCents) / 100 : "");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(0);
  const status = STATUS[row.status];
  const canRetry = row.status === "refund_failed" || row.status === "refunding";

  async function act(kind: "approve" | "deny" | "retry", body: object = {}) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/merchant/claims/${row.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const g = row.grade;
  return (
    <Card className="flex max-h-[700px] flex-col overflow-hidden">
      {row.photos.length > 0 && (
        <div className="relative bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
          <img src={row.photos[photo]} alt={`Claim photo ${photo + 1}`} className="aspect-[4/3] w-full object-contain" />
          {row.photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {row.photos.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setPhoto(i)}
                  className={cx("h-2 w-2 rounded-full", i === photo ? "bg-white" : "bg-white/40")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">
              {row.productName} {row.demo && <Badge className="ml-1 align-middle">Demo data</Badge>}
            </p>
            <p className="text-xs text-faint">
              {money(row.priceCents, row.currency)} · {row.buyer ?? "unknown buyer"}
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        {row.reasons.length > 0 && (
          <ul className="space-y-1.5">
            {row.reasons.map((r) => (
              <li key={r.code} className="flex gap-2 rounded-lg bg-warn-soft/70 px-3 py-2 text-xs text-warn">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">{REASON_LABEL[r.code] ?? r.code}.</span> {r.message}
                </span>
              </li>
            ))}
          </ul>
        )}
        {row.reviewNote && <p className="rounded-lg bg-warn-soft/70 px-3 py-2 text-xs text-warn">{row.reviewNote}</p>}

        {g && (
          <div className="space-y-2">
            <Eyebrow>AI grade</Eyebrow>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-faint">Severity</dt>
              <dd className="font-medium capitalize">{g.overall_severity}</dd>
              <dt className="text-faint">Confidence</dt>
              <dd className="capitalize">{g.confidence}</dd>
              <dt className="text-faint">Item seen</dt>
              <dd>{g.item_seen}</dd>
              <dt className="text-faint">Code read</dt>
              <dd className="flex items-center gap-1 font-mono">
                {g.verification_code_read ?? "none"}
                {row.codeMatches ? <Check className="h-3.5 w-3.5 text-good" /> : <X className="h-3.5 w-3.5 text-bad" />}
              </dd>
              <dt className="text-faint">Real photo</dt>
              <dd>{g.looks_like_real_photo ? "Yes" : "No"}</dd>
              <dt className="text-faint">Function</dt>
              <dd className="capitalize">{g.functional_impact === "none" ? "Unaffected" : `${g.functional_impact} loss`}</dd>
            </dl>
            {g.defects.length > 0 && (
              <ul className="space-y-1 pt-1 text-xs">
                {g.defects.map((d, i) => (
                  <li key={i}>
                    <span className="font-medium capitalize">{d.type.replace(/_/g, " ")}</span>{" "}
                    <span className="text-faint">({d.severity}, {d.location})</span> {d.description}
                  </li>
                ))}
              </ul>
            )}
            {g.reviewer_note && <p className="rounded-lg bg-ink/[0.04] p-2.5 text-xs text-muted">{g.reviewer_note}</p>}
          </div>
        )}

        {row.description && (
          <div className="space-y-1">
            <Eyebrow>Buyer said</Eyebrow>
            <p className="text-sm text-muted">&ldquo;{row.description}&rdquo;</p>
          </div>
        )}

        <div className="space-y-1 text-xs text-muted">
          {row.offerCents != null && <p>Rules engine: {money(row.offerCents, row.currency)}</p>}
          {row.counterCents != null && <p>Buyer countered: {money(row.counterCents, row.currency)}</p>}
          {row.refundedCents != null && (
            <p className="text-good">
              Refunded {money(row.refundedCents, row.currency)} · PayPal refund <span className="font-mono">{row.refundId}</span>
            </p>
          )}
          {row.resolution && (
            <p>
              Settled by: {RESOLUTION_LABEL[row.resolution]}
              {row.settleSeconds != null && ` in ${seconds(row.settleSeconds)}`}
              {row.savingsCents != null && <span className="text-good"> · saved {money(row.savingsCents, row.currency)} vs. a return</span>}
            </p>
          )}
          {row.merchantNote && <p>Your note: {row.merchantNote}</p>}
          {row.refundError && <p className="text-bad">PayPal: {row.refundError}</p>}
          {row.model && <p className="text-faint">Graded by {row.model}</p>}
        </div>

        {error && <p className="rounded-lg bg-bad-soft p-2.5 text-xs text-bad">{error}</p>}
      </div>

      {row.status === "review" && (
        <div className="space-y-2.5 border-t border-line bg-paper/60 p-4">
          <div className="flex gap-2">
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">$</span>
              <input
                aria-label="Refund amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="h-10 w-full rounded-full border border-line bg-surface pl-7 pr-3 text-sm tabular-nums outline-none focus:border-brand"
              />
            </div>
            <input
              aria-label="Note to buyer"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note to buyer (optional)"
              className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={busy !== null || !(Number(amount) > 0)}
              onClick={() => act("approve", { cents: Math.round(Number(amount) * 100), note })}
            >
              <Check className="h-4 w-4" /> {busy === "approve" ? "Refunding…" : `Refund ${amount ? money(Math.round(Number(amount) * 100), row.currency) : ""}`}
            </Button>
            <Button variant="danger" disabled={busy !== null} onClick={() => act("deny", { note })}>
              {busy === "deny" ? "Declining…" : "Decline"}
            </Button>
          </div>
        </div>
      )}

      {canRetry && (
        <div className="border-t border-line bg-paper/60 p-4">
          <Button className="w-full" disabled={busy !== null} onClick={() => act("retry")}>
            <RotateCw className={cx("h-4 w-4", busy === "retry" && "animate-spin")} /> Retry refund
          </Button>
        </div>
      )}
    </Card>
  );
}
