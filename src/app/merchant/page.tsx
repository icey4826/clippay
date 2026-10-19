import { merchantRows, merchantStats } from "@/lib/merchant";
import { DEFAULT_POLICY } from "@/lib/rules";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claims · ClipPay merchant" };

export default async function MerchantPage() {
  const rows = await merchantRows();
  return <Dashboard rows={rows} stats={merchantStats(rows)} policy={DEFAULT_POLICY} />;
}
