import { ComingSoon } from "@/components/Section";

export const metadata = { title: "Settings · Fund X-Ray" };

export default function SettingsPage() {
  return (
    <ComingSoon
      kicker="Settings"
      title="Your benchmark, targets and alerts"
      week={1}
      body="Benchmark, index target band, monthly investment amount, alert thresholds, theme, your Kite connection and a delete-my-data button. Built on Day 3, after Google login."
    />
  );
}
