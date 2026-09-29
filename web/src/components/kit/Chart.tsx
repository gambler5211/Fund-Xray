"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { chartTheme } from "@/lib/chartTheme";

// Only the pieces we use, so the bundle stays small.
echarts.use([LineChart, BarChart, ScatterChart, GridComponent, LegendComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);

/**
 * An ECharts chart that follows the Day / Night theme.
 * Pass a plain ECharts option; colours come from the tokens via chartTheme().
 */
export function Chart({ option, height = 280, label }: { option: EChartsCoreOption; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let chart: echarts.ECharts | undefined;

    const draw = () => {
      chart?.dispose();
      echarts.registerTheme("fx", chartTheme());
      chart = echarts.init(node, "fx", { renderer: "svg" });
      chart.setOption(option);
    };
    draw();

    // Redraw when the theme switches, resize with the container.
    const themeWatch = new MutationObserver(draw);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const sizeWatch = new ResizeObserver(() => chart?.resize());
    sizeWatch.observe(node);

    return () => {
      themeWatch.disconnect();
      sizeWatch.disconnect();
      chart?.dispose();
    };
  }, [option]);

  return <div ref={el} role="img" aria-label={label} style={{ height }} className="w-full" />;
}
