import { ReturnScreen } from "./ReturnScreen";

export const metadata = { title: "Connected · Fund X-Ray" };

export default async function ConnectedPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  return <ReturnScreen kiteUserId={as ?? null} />;
}
