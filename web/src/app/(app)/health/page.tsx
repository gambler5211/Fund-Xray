import { ComingSoon } from "@/components/Section";

export const metadata = { title: "Health · Fund X-Ray" };

export default function HealthPage() {
  return (
    <ComingSoon
      kicker="Health checks"
      title="Red flags, surveillance and pledges for what you own"
      week={4}
      body="NSE surveillance lists, promoter pledge and holding changes, insider trades, and a weekly list of holdings meeting two or more red-flag rules, each linked to its evidence."
    />
  );
}
