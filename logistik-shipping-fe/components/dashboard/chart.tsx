"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-md bg-muted/40" />,
});

/** Chart colours per mode. Categorical hues keep a fixed order; both sets were checked with the palette validator. */
export const PALETTE = {
  light: { series: ["#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7"], neutral: "#9b9a95", text: "#52514e", muted: "#8a8984", grid: "#e9e8e4", surface: "#fcfcfb" },
  dark: { series: ["#3987e5", "#d95926", "#199e70", "#9085e9"], neutral: "#7a7974", text: "#c3c2b7", muted: "#8f8e86", grid: "#2e2e2c", surface: "#1a1a19" },
};

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  return { mode, ...PALETTE[mode] } as const;
}

/** Shared look: thin recessive grid, no toolbar, muted axis text, theme-aware tooltip. */
export function baseOptions(theme: ReturnType<typeof useChartTheme>): ApexOptions {
  return {
    chart: { toolbar: { show: false }, fontFamily: "inherit", foreColor: theme.text, background: "transparent", animations: { speed: 350 } },
    grid: { borderColor: theme.grid, strokeDashArray: 0, padding: { left: 4, right: 8 } },
    dataLabels: { enabled: false },
    tooltip: { theme: theme.mode },
    legend: { labels: { colors: theme.text }, markers: { size: 6 } },
    xaxis: { axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: theme.muted } } },
    yaxis: { labels: { style: { colors: theme.muted } } },
    states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
  };
}

export function Chart({ options, series, type, height }: { options: ApexOptions; series: ApexOptions["series"]; type: "area" | "bar" | "donut"; height: number }) {
  return (
    <div style={{ height }}>
      <ReactApexChart options={options} series={series} type={type} height={height} width="100%" />
    </div>
  );
}
