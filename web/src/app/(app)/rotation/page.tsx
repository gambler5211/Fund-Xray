import { ComingSoon } from "@/components/Section";

export const metadata = { title: "Rotation · Fund X-Ray" };

export default function RotationPage() {
  return (
    <ComingSoon
      kicker="Sector rotation"
      title="Which sectors are gaining strength, and which are fading"
      week={2}
      body="Every Nifty sector and thematic index placed by relative strength and momentum against your benchmark, with the sectors you hold in bold and a detail panel for each."
    />
  );
}
