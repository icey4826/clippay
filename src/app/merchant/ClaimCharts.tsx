"use client";

// AG Charts overview above the claims grid. Every chart is also a filter: clicking a slice or bar
// narrows the grid to those claims, and clicking it again clears the filter.

import { AllCommunityModule, ModuleRegistry, type AgChartOptions, type AgChartTheme } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo, useState } from "react";
import { Card, cx } from "@/components/ui";
import { formatCents } from "@/lib/catalog";
import type { MerchantRow } from "@/lib/merchant";

ModuleRegistry.registerModules([AllCommunityModule]);

export type ChartFilter = { kind: "outcome" | "severity" | "product"; value: string };

export const OUTCOMES = ["Auto-settled", "Settled by you", "Needs review", "In progress", "Declined", "Ineligible"] as const;
export type Outcome = (typeof OUTCOMES)[number];

const OUTCOME_COLOR: Record<Outcome, string> = {
  "Auto-settled": "#11865a",
  "Settled by you": "#2f4bff",
  "Needs review": "#e08a00",
  "In progress": "#9aa7ff",
  Declined: "#c42b35",
  Ineligible: "#c9ccd4",
};

export function outcomeOf(r: MerchantRow): Outcome {
  if (r.status === "refunded") return r.resolution === "merchant" ? "Settled by you" : "Auto-settled";
  if (r.status === "review" || r.status === "refund_failed") return "Needs review";
  if (r.status === "denied") return "Declined";
  if (r.status === "ineligible") return "Ineligible";
  return "In progress";
}

const SEVERITIES = ["none", "cosmetic", "minor", "moderate", "severe", "unusable"] as const;
const SEVERITY_COLOR = ["#c9ccd4", "#c7cfff", "#9aa7ff", "#6b7dff", "#2f4bff", "#1b2fc4"];
export const severityLabel = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export function matchesChartFilter(r: MerchantRow, f: ChartFilter | null) {
  if (!f) return true;
  if (f.kind === "outcome") return outcomeOf(r) === f.value;
  if (f.kind === "severity") return r.severity === f.value;
  return r.productName === f.value;
}

const dollars = (cents: number) => Math.round(cents) / 100;

export default function ClaimCharts({
  rows,
  filter,
  onFilter,
}: {
  rows: MerchantRow[];
  filter: ChartFilter | null;
  onFilter: (f: ChartFilter | null) => void;
}) {
  // Canvas text can't inherit CSS, so hand the page font to the charts. Read lazily on the client;
  // the server render only emits an empty container, so there's nothing to mismatch.
  const [fontFamily] = useState(() => (typeof document === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily));

  const theme = useMemo<AgChartTheme>(
    () => ({
      baseTheme: "ag-default",
      params: { fontFamily, fontSize: 12, foregroundColor: "#15171c", backgroundColor: "#ffffff" },
      overrides: {
        common: {
          title: { fontSize: 13, fontWeight: 600, textAlign: "left" },
          subtitle: { fontSize: 11, color: "#8d92a0", textAlign: "left" },
          padding: { top: 14, right: 16, bottom: 10, left: 16 },
        },
      },
    }),
    [fontFamily],
  );

  // Toggle: clicking the active slice or bar again clears the filter.
  const pick = (kind: ChartFilter["kind"], value: string) =>
    onFilter(filter?.kind === kind && filter.value === value ? null : { kind, value });
  const dim = (kind: ChartFilter["kind"], value: string) => (filter?.kind === kind && filter.value !== value ? 0.3 : 1);

  const outcomeOptions = useMemo<AgChartOptions>(() => {
    const data = OUTCOMES.map((outcome) => ({ outcome, count: rows.filter((r) => outcomeOf(r) === outcome).length })).filter((d) => d.count > 0);
    return {
      theme,
      title: { text: "Where claims ended up" },
      subtitle: { text: "Click a slice to filter the grid" },
      data,
      series: [
        {
          type: "donut",
          angleKey: "count",
          legendItemKey: "outcome",
          innerRadiusRatio: 0.64,
          fills: data.map((d) => OUTCOME_COLOR[d.outcome]),
          strokes: data.map(() => "#ffffff"),
          strokeWidth: 2,
          cursor: "pointer",
          itemStyler: ({ datum }) => ({ fillOpacity: dim("outcome", datum.outcome) }),
          innerLabels: [
            { text: String(rows.length), fontSize: 24, fontWeight: 600 },
            { text: "claims", fontSize: 11, color: "#8d92a0" },
          ],
          tooltip: { renderer: ({ datum }) => ({ heading: datum.outcome, data: [{ label: "Claims", value: String(datum.count) }] }) },
          listeners: { seriesNodeClick: ({ datum }) => pick("outcome", (datum as { outcome: string }).outcome) },
        },
      ],
      legend: { position: "right", item: { marker: { shape: "circle", size: 8 }, label: { fontSize: 11 } }, toggleSeries: false },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick/dim only depend on filter
  }, [rows, theme, filter]);

  const moneyOptions = useMemo<AgChartOptions>(() => {
    const byProduct = new Map<string, { product: string; refunded: number; kept: number }>();
    for (const r of rows) {
      if (r.refundedCents == null) continue;
      const p = byProduct.get(r.productName) ?? { product: r.productName, refunded: 0, kept: 0 };
      p.refunded += dollars(r.refundedCents);
      p.kept += dollars(r.savingsCents ?? 0);
      byProduct.set(r.productName, p);
    }
    const data = [...byProduct.values()].sort((a, b) => b.refunded + b.kept - (a.refunded + a.kept));
    const usd = (v: number) => formatCents(Math.round(v * 100), "USD");
    const bar = (yKey: "refunded" | "kept", yName: string, fill: string) => ({
      type: "bar" as const,
      direction: "horizontal" as const,
      xKey: "product",
      yKey,
      yName,
      stacked: true,
      fill,
      cornerRadius: 3,
      cursor: "pointer",
      itemStyler: ({ datum }: { datum: { product: string } }) => ({ fillOpacity: dim("product", datum.product) }),
      tooltip: { renderer: ({ datum }: { datum: { product: string } & Record<typeof yKey, number> }) => ({ heading: datum.product, data: [{ label: yName, value: usd(datum[yKey]) }] }) },
      listeners: { seriesNodeClick: ({ datum }: { datum: unknown }) => pick("product", (datum as { product: string }).product) },
    });
    return {
      theme,
      title: { text: "Refunded vs. kept, by item" },
      subtitle: { text: "Kept = price not refunded + return shipping saved" },
      data,
      series: [bar("refunded", "Refunded", "#2f4bff"), bar("kept", "Kept vs. a return", "#11865a")],
      axes: {
        y: { type: "category", position: "left", label: { fontSize: 11 } },
        x: { type: "number", position: "bottom", label: { fontSize: 10, formatter: ({ value }: { value: number }) => `$${value}` }, gridLine: { style: [{ stroke: "#efece5" }] } },
      },
      legend: { position: "bottom", item: { marker: { size: 8 }, label: { fontSize: 11 } } },
    } as AgChartOptions;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick/dim only depend on filter
  }, [rows, theme, filter]);

  const severityOptions = useMemo<AgChartOptions>(() => {
    const data = SEVERITIES.map((s, i) => ({
      severity: severityLabel(s),
      key: s,
      claims: rows.filter((r) => r.severity === s).length,
      color: SEVERITY_COLOR[i],
    })).filter((d) => d.claims > 0 || d.key !== "none");
    return {
      theme,
      title: { text: "Damage the AI graded" },
      subtitle: { text: "Claims by overall severity" },
      data,
      series: [
        {
          type: "bar",
          xKey: "severity",
          yKey: "claims",
          yName: "Claims",
          cornerRadius: 3,
          cursor: "pointer",
          itemStyler: ({ datum }) => ({ fill: datum.color, fillOpacity: dim("severity", datum.key) }),
          label: { formatter: ({ value }) => (value ? String(value) : ""), placement: "outside-end", fontSize: 11, color: "#5d6270" },
          tooltip: { renderer: ({ datum }) => ({ heading: datum.severity, data: [{ label: "Claims", value: String(datum.claims) }] }) },
          listeners: { seriesNodeClick: ({ datum }) => pick("severity", (datum as { key: string }).key) },
        },
      ],
      axes: {
        x: { type: "category", position: "bottom", label: { fontSize: 11 } },
        y: { type: "number", position: "left", interval: { step: 1 }, label: { fontSize: 10 }, gridLine: { style: [{ stroke: "#efece5" }] } },
      },
    } as AgChartOptions;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick/dim only depend on filter
  }, [rows, theme, filter]);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {[outcomeOptions, moneyOptions, severityOptions].map((options, i) => (
        <Card key={i} className={cx("h-[240px] overflow-hidden")}>
          <AgCharts options={options} style={{ height: "100%" }} />
        </Card>
      ))}
    </div>
  );
}
