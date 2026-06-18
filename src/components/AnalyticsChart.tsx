import React, { useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  BoxplotChart,
  FunnelChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { AlertTriangle, Download, GripHorizontal, Trash2 } from "lucide-react";
import type { AnalyticsResult } from "../analytics/types";

echarts.use([
  BarChart,
  BoxplotChart,
  FunnelChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

interface AnalyticsChartProps {
  result?: AnalyticsResult;
  loading?: boolean;
  onRemove: () => void;
}

function truncateLabel(value: unknown, maxLength = 18) {
  const label = String(value ?? "");
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function downloadCsv(result: AnalyticsResult) {
  const rows = result.rows || result.series.map((point) => ({
    label: point.label,
    group: point.group || "",
    value: point.value,
  }));
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${result.spec.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function chartOption(result: AnalyticsResult) {
  const { spec, series, summary } = result;
  const groups = [...new Set(series.map((point) => point.group).filter(Boolean))] as string[];
  const labels = [...new Set(series.map((point) => point.label))];
  const base = {
    animationDuration: 500,
    color: [spec.color, "#a78b65", "#6b8fa3", "#9c6f7d", "#80996b"],
    tooltip: { trigger: "axis" as const, confine: true },
    grid: { left: 20, right: 20, top: 28, bottom: 32, containLabel: true },
    textStyle: { fontFamily: "Inter, system-ui, sans-serif", color: "#64748b" },
  };

  if (spec.chartType === "donut") {
    return {
      ...base,
      tooltip: { trigger: "item" as const, confine: true },
      legend: {
        bottom: 0,
        left: "center",
        width: "92%",
        type: "scroll" as const,
        formatter: (name: string) => truncateLabel(name, 24),
        textStyle: { overflow: "truncate" as const, width: 180 },
      },
      series: [{
        type: "pie",
        center: ["50%", "43%"],
        radius: ["39%", "64%"],
        itemStyle: { borderRadius: 7, borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: series.map((point) => ({ name: point.label, value: point.value })),
      }],
    };
  }

  if (spec.chartType === "funnel") {
    return {
      ...base,
      tooltip: { trigger: "item" as const },
      series: [{
        type: "funnel",
        left: "10%",
        width: "80%",
        top: 20,
        bottom: 20,
        sort: "descending",
        data: series.map((point) => ({ name: point.label, value: point.value })),
      }],
    };
  }

  if (spec.chartType === "box-plot") {
    return {
      ...base,
      xAxis: { type: "category", data: [spec.title] },
      yAxis: { type: "value", scale: true },
      series: [{
        type: "boxplot",
        data: [[summary.min || 0, summary.q1 || 0, summary.median || 0, summary.q3 || 0, summary.max || 0]],
      }],
    };
  }

  if (spec.chartType === "scatter") {
    return {
      ...base,
      xAxis: { type: "value", name: spec.dimension || "Dimension" },
      yAxis: { type: "value", name: spec.measure },
      series: [{
        type: "scatter",
        symbolSize: 10,
        data: series.map((point) => [Number(point.label), point.value]),
      }],
    };
  }

  if (spec.chartType === "heatmap") {
    const yGroups = groups.length ? groups : ["All"];
    return {
      ...base,
      tooltip: { position: "top" as const },
      xAxis: { type: "category", data: labels, splitArea: { show: true } },
      yAxis: { type: "category", data: yGroups, splitArea: { show: true } },
      visualMap: { min: 0, max: Math.max(1, ...series.map((point) => point.value)), calculable: true, orient: "horizontal", left: "center", bottom: 0 },
      series: [{
        type: "heatmap",
        data: series.map((point) => [labels.indexOf(point.label), yGroups.indexOf(point.group || "All"), point.value]),
      }],
    };
  }

  if (spec.chartType === "kaplan-meier") {
    return {
      ...base,
      tooltip: { trigger: "axis" as const, valueFormatter: (value: number) => `${(value * 100).toFixed(1)}%` },
      xAxis: { type: "value", name: "Months", min: 0 },
      yAxis: { type: "value", name: "Survival", min: 0, max: 1, axisLabel: { formatter: (value: number) => `${value * 100}%` } },
      series: [{
        type: "line",
        step: "end",
        showSymbol: false,
        data: series.map((point) => [Number(point.label), point.value]),
        areaStyle: { opacity: 0.08 },
      }],
    };
  }

  const chartType = spec.chartType === "line" || spec.chartType === "area" || spec.chartType === "timeline"
    ? "line"
    : "bar";
  const chartSeries = groups.length
    ? groups.map((group) => ({
        name: group,
        type: chartType,
        stack: spec.chartType === "stacked-bar" ? "total" : undefined,
        areaStyle: spec.chartType === "area" ? { opacity: 0.2 } : undefined,
        smooth: spec.chartType === "line" || spec.chartType === "area",
        data: labels.map((label) => series.find((point) => point.label === label && point.group === group)?.value || 0),
      }))
    : [{
        type: chartType,
        areaStyle: spec.chartType === "area" ? { opacity: 0.2 } : undefined,
        smooth: spec.chartType === "line" || spec.chartType === "area",
        barMaxWidth: 84,
        data: series.map((point) => point.value),
      }];
  return {
    ...base,
    legend: groups.length ? { top: 0, type: "scroll" as const } : undefined,
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        interval: 0,
        hideOverlap: true,
        rotate: labels.some((label) => label.length > 12) ? 28 : 0,
        formatter: (value: string) => truncateLabel(value),
      },
    },
    yAxis: { type: "value" },
    series: chartSeries,
  };
}

export default function AnalyticsChart({ result, loading, onRemove }: AnalyticsChartProps) {
  const chartRef = useRef<ReactEChartsCore>(null);
  const option = useMemo(() => result ? chartOption(result) : {}, [result]);

  const exportPng = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || !result) return;
    const link = document.createElement("a");
    link.href = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    link.download = `${result.spec.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    link.click();
  };

  return (
    <section className="h-full min-w-0 minimal-card rounded-2xl overflow-hidden flex flex-col border border-natural-border/40">
      <header className="analytics-drag-handle relative min-h-[82px] px-4 py-3 pr-[118px] border-b border-natural-border/35 cursor-move">
        <div className="min-w-0 flex items-start gap-2">
          <GripHorizontal className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-bold text-sm leading-5 text-slate-800 dark:text-slate-100 break-words" title={result?.spec.title}>
              {result?.spec.title || "Loading analysis"}
            </h3>
            {result && (
              <p
                className="text-[11.5px] leading-4 text-slate-500 mt-1 overflow-hidden"
                title={`n=${result.eligibleCount} · missing=${result.missingCount} · ${result.method}`}
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                }}
              >
                n={result.eligibleCount} · missing={result.missingCount} · {result.method}
              </p>
            )}
          </div>
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1">
          {result && (
            <>
              <button type="button" onClick={exportPng} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Export PNG">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => downloadCsv(result)} className="btn-clr-csv px-2 py-1 rounded-lg text-[11.5px] font-bold" title="Export CSV">
                CSV
              </button>
            </>
          )}
          <button type="button" onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Remove chart">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 p-3 overflow-hidden">
        {loading && <div className="h-full flex items-center justify-center text-xs text-slate-500">Calculating clinical analytics...</div>}
        {!loading && result?.spec.chartType === "kpi" && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <strong className="max-w-full text-4xl sm:text-5xl leading-none text-natural-accent break-all">
              {result.series[0]?.value ?? result.eligibleCount}
            </strong>
            <span className="mt-2 text-xs font-semibold text-slate-500">{result.series[0]?.label || "Eligible patients"}</span>
          </div>
        )}
        {!loading && result?.spec.chartType === "table" && (
          <div className="h-full overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left border-b"><th className="p-2">Category</th><th className="p-2">Group</th><th className="p-2 text-right">Value</th></tr></thead>
              <tbody>{result.series.map((point, index) => (
                <tr key={`${point.label}-${point.group}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2">{point.label}</td><td className="p-2">{point.group || "-"}</td><td className="p-2 text-right font-bold">{point.value.toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {!loading && result && !["kpi", "table"].includes(result.spec.chartType) && (
          <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: "100%", minHeight: 220 }} notMerge lazyUpdate />
        )}
      </div>

      {result?.warnings.length ? (
        <footer className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[11.5px] flex gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{result.warnings.join(" ")}</span>
        </footer>
      ) : null}
    </section>
  );
}
