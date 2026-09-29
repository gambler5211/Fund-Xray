/**
 * ECharts theme built from the same CSS colour tokens as the rest of the app,
 * so charts switch with Day / Night and never carry their own hex values.
 * Read at runtime from <html>; call again after the theme changes.
 */
export function readToken(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

export function chartTheme() {
  const t = (n: string) => readToken(n);
  const sans = '"Source Sans 3", system-ui, sans-serif';
  const axis = {
    axisLine: { lineStyle: { color: t("ink-3") } },
    axisTick: { lineStyle: { color: t("ink-3") } },
    axisLabel: { color: t("ink-3"), fontFamily: sans, fontSize: 12 },
    splitLine: { lineStyle: { color: t("rule"), type: "solid" as const } },
    nameTextStyle: { color: t("ink-3"), fontFamily: sans, fontSize: 12 },
  };
  return {
    // Series order: leading, improving, weakening, lagging, then ink and accent.
    color: [t("q-leading"), t("q-improving"), t("q-weakening"), t("q-lagging"), t("ink-2"), t("accent")],
    backgroundColor: "transparent",
    textStyle: { color: t("ink-2"), fontFamily: sans },
    title: { textStyle: { color: t("ink"), fontFamily: sans }, subtextStyle: { color: t("ink-3") } },
    legend: { textStyle: { color: t("ink-3"), fontFamily: sans, fontSize: 12 }, icon: "rect", itemWidth: 10, itemHeight: 10 },
    tooltip: {
      backgroundColor: t("paper"),
      borderColor: t("ink"),
      borderWidth: 1,
      textStyle: { color: t("ink"), fontFamily: sans, fontSize: 13 },
      extraCssText: "border-radius:0;box-shadow:none;",
    },
    categoryAxis: axis,
    valueAxis: { ...axis, axisLine: { show: false }, axisTick: { show: false } },
    timeAxis: axis,
    line: { symbol: "none", lineStyle: { width: 2 } },
    bar: { itemStyle: { borderRadius: 0 } },
    markLine: { lineStyle: { color: t("ink-3") }, label: { color: t("ink-3") } },
  };
}
