# Regime backtest

Run 30 Sep 2026 from Actions → NSE data → `backtest` (`jobs/backtest_regime.py`), on 145 weeks,
29 Dec 2023 to 29 Sep 2026. Rerun it the same way after the history grows; it reads only.

## Result

No setting predicts the next 4 or 8 weeks better than chance, so the rule is unchanged (threshold
±2, market breadth above 50%) and the Rotation page presents the label as which group is ahead
now, not a forecast.

- Base rate: the cyclical group beat the defensive group in 53% of 4-week and 8-week windows.
- The current rule was right 49% (4 weeks) and 41% (8 weeks), and the average gap after a
  Cyclical lead was 1.6 points *below* the gap after a Defensive lead.
- Every setting was near 55–60% right in the earlier half (Dec 2023 to early 2025) and 10–40% in
  the later half. That looks like a change in how the market behaved, with leads reversing rather
  than continuing, not a threshold that is slightly off. Flipping the rule to bet against the lead
  would only fit the later half, so it isn't done.
- Labels change about once every four weeks (flip rate 20–35%).

Limits: 145 weeks is about one market cycle, and the 4 and 8 week outcomes overlap, so there are
far fewer independent readings than rows. Group returns are equal-weight averages of the indices.

## Table

Calls = weeks labelled Cyclical or Defensive lead with a known outcome. Halves = hit rate in the
earlier / later half of history. Edge = average outcome after Cyclical lead minus after Defensive
lead, in points. Flip rate = label changes per week.

| Threshold | Breadth above | Calls 4w | Hit 4w | Halves 4w | Edge 4w | Calls 8w | Hit 8w | Halves 8w | Edge 8w | Flip rate | |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ±1 | off | 108 | 46% | 52% / 38% | −1.1 | 106 | 44% | 59% / 24% | −1.1 | 27% | |
| ±1 | 40% | 98 | 45% | 54% / 33% | −1.4 | 96 | 45% | 59% / 25% | −1.0 | 31% | |
| ±1 | 45% | 97 | 45% | 54% / 34% | −1.3 | 96 | 45% | 59% / 25% | −1.0 | 30% | |
| ±1 | 50% | 92 | 46% | 53% / 35% | −1.5 | 92 | 43% | 58% / 22% | −1.4 | 28% | |
| ±1 | 55% | 84 | 44% | 51% / 33% | −1.5 | 84 | 42% | 55% / 21% | −1.9 | 32% | |
| ±1 | 60% | 77 | 45% | 53% / 32% | −1.3 | 77 | 42% | 55% / 18% | −1.8 | 28% | |
| ±1.5 | off | 91 | 46% | 52% / 40% | −1.1 | 89 | 40% | 56% / 22% | −1.5 | 35% | |
| ±1.5 | 40% | 85 | 46% | 54% / 36% | −1.3 | 83 | 42% | 59% / 22% | −1.2 | 33% | |
| ±1.5 | 45% | 84 | 46% | 54% / 37% | −1.2 | 83 | 42% | 59% / 22% | −1.2 | 32% | |
| ±1.5 | 50% | 80 | 46% | 53% / 37% | −1.3 | 80 | 41% | 58% / 20% | −1.6 | 31% | |
| ±1.5 | 55% | 72 | 44% | 51% / 35% | −1.4 | 72 | 39% | 54% / 19% | −2.2 | 33% | |
| ±1.5 | 60% | 65 | 46% | 54% / 35% | −1.3 | 65 | 38% | 54% / 15% | −2.2 | 30% | |
| ±2 | off | 75 | 48% | 55% / 39% | −1.5 | 75 | 40% | 55% / 21% | −1.8 | 29% | |
| ±2 | 40% | 70 | 49% | 58% / 37% | −1.6 | 70 | 41% | 58% / 20% | −1.7 | 25% | |
| ±2 | 45% | 70 | 49% | 58% / 37% | −1.6 | 70 | 41% | 58% / 20% | −1.7 | 25% | |
| ±2 | 50% | 68 | 49% | 58% / 36% | −1.6 | 68 | 41% | 58% / 18% | −1.8 | 25% | current |
| ±2 | 55% | 61 | 46% | 54% / 33% | −1.7 | 61 | 39% | 54% / 17% | −2.4 | 28% | |
| ±2 | 60% | 54 | 48% | 57% / 32% | −1.5 | 54 | 39% | 54% / 11% | −2.5 | 24% | |
| ±2.5 | off | 62 | 48% | 56% / 38% | −1.2 | 62 | 42% | 58% / 19% | −1.7 | 29% | |
| ±2.5 | 40% | 58 | 48% | 57% / 35% | −1.3 | 58 | 43% | 60% / 17% | −1.5 | 26% | |
| ±2.5 | 45% | 58 | 48% | 57% / 35% | −1.3 | 58 | 43% | 60% / 17% | −1.5 | 26% | |
| ±2.5 | 50% | 56 | 48% | 57% / 33% | −1.3 | 56 | 43% | 60% / 14% | −1.6 | 26% | |
| ±2.5 | 55% | 50 | 46% | 53% / 33% | −1.3 | 50 | 42% | 56% / 17% | −2.2 | 26% | |
| ±2.5 | 60% | 47 | 47% | 55% / 31% | −1.3 | 47 | 43% | 58% / 12% | −2.0 | 24% | |
| ±3 | off | 51 | 49% | 57% / 38% | −0.9 | 51 | 43% | 63% / 14% | −1.2 | 26% | |
| ±3 | 40% | 48 | 48% | 57% / 33% | −1.0 | 48 | 44% | 63% / 11% | −0.9 | 25% | |
| ±3 | 45% | 48 | 48% | 57% / 33% | −1.0 | 48 | 44% | 63% / 11% | −0.9 | 25% | |
| ±3 | 50% | 47 | 47% | 57% / 29% | −1.1 | 47 | 45% | 63% / 12% | −0.9 | 24% | |
| ±3 | 55% | 42 | 45% | 54% / 29% | −0.8 | 42 | 45% | 61% / 14% | −1.2 | 22% | |
| ±3 | 60% | 40 | 48% | 56% / 31% | −0.7 | 40 | 48% | 63% / 15% | −0.9 | 21% | |
| ±3.5 | off | 41 | 49% | 52% / 44% | −0.8 | 41 | 44% | 64% / 12% | −1.4 | 24% | |
| ±3.5 | 40% | 39 | 49% | 52% / 43% | −0.8 | 39 | 46% | 64% / 14% | −0.9 | 23% | |
| ±3.5 | 45% | 39 | 49% | 52% / 43% | −0.8 | 39 | 46% | 64% / 14% | −0.9 | 23% | |
| ±3.5 | 50% | 38 | 47% | 52% / 38% | −0.9 | 38 | 47% | 64% / 15% | −1.0 | 22% | |
| ±3.5 | 55% | 34 | 47% | 50% / 40% | −0.4 | 34 | 50% | 62% / 20% | −1.1 | 20% | |
| ±3.5 | 60% | 33 | 48% | 52% / 40% | −0.3 | 33 | 52% | 65% / 20% | −0.5 | 20% | |
| ±4 | off | 32 | 47% | 55% / 33% | −1.1 | 32 | 44% | 65% / 8% | −2.4 | 20% | |
| ±4 | 40% | 31 | 48% | 55% / 36% | −1.0 | 31 | 45% | 65% / 9% | −2.0 | 20% | |
| ±4 | 45% | 31 | 48% | 55% / 36% | −1.0 | 31 | 45% | 65% / 9% | −2.0 | 20% | |
| ±4 | 50% | 31 | 48% | 55% / 36% | −1.0 | 31 | 45% | 65% / 9% | −2.0 | 20% | |
| ±4 | 55% | 28 | 46% | 53% / 33% | −0.9 | 28 | 46% | 63% / 11% | −2.3 | 19% | |
| ±4 | 60% | 27 | 48% | 56% / 33% | −0.8 | 27 | 48% | 67% / 11% | −1.6 | 19% | |

Weeks by label under the current rule: Cyclical lead 40, Defensive lead 30, Neutral 75.
