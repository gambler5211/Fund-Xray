"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { chartTheme } from "@/lib/chartTheme";

// Only the pieces we use, so the bundle stays small.
echarts.use([LineChart, BarChart, ScatterChart, GridComponent, LegendComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LabelLayout, SVGRenderer]);

/** Below this width the chart is drawn in its phone form. */
export const COMPACT_WIDTH = 640;
export type ChartContext = { width: number; height: number; compact: boolean };

/**
 * An ECharts chart that follows the Day / Night theme.
 * Pass a plain ECharts option, or a function that builds one: it runs again when the theme
 * switches (so colours read from the tokens stay right) and when the width crosses COMPACT_WIDTH.
 * Colours come from the tokens via chartTheme(). Size with `height` or a height `className`.
 */
export function Chart({
  option,
  height = 280,
  className,
  label,
  onClick,
}: {
  option: EChartsCoreOption | ((ctx: ChartContext) => EChartsCoreOption);
  height?: number;
  className?: string;
  label: string;
  /** A click or tap: `data` is the clicked item (null for empty space inside the plot). */
  onClick?: (data: unknown) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const click = useRef(onClick);
  click.current = onClick;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let chart: echarts.ECharts | undefined;
    let compact = node.clientWidth < COMPACT_WIDTH;

    const draw = () => {
      chart?.dispose();
      echarts.registerTheme("fx", chartTheme());
      chart = echarts.init(node, "fx", { renderer: "svg" });
      compact = node.clientWidth < COMPACT_WIDTH;
      chart.setOption(typeof option === "function" ? option({ width: node.clientWidth, height: node.clientHeight, compact }) : option);
      chart.on("click", (p) => click.current?.((p as { data?: unknown }).data ?? null));
      chart.getZr().on("click", (e) => {
        if (!e.target) click.current?.(null); // tapped the background
      });
    };
    draw();

    // Redraw when the theme switches, resize with the container.
    const themeWatch = new MutationObserver(draw);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const sizeWatch = new ResizeObserver(() => {
      // An option built from the size (label placement, phone layout) is rebuilt; others just resize.
      if (typeof option === "function") draw();
      else chart?.resize();
    });
    sizeWatch.observe(node);

    return () => {
      themeWatch.disconnect();
      sizeWatch.disconnect();
      chart?.dispose();
    };
  }, [option]);

  return <div ref={el} role="img" aria-label={label} style={className ? undefined : { height }} className={`w-full ${className ?? ""}`} />;
}
