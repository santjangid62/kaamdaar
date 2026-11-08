/** Generic page for every sidebar section — rows come from the database. */
import { notFound } from "next/navigation";
import SectionClient from "../../../../components/admin/SectionClient";
import { buildSection } from "../../../../server/sections";

export const instant = false;

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const def = await buildSection(section);
  if (!def) notFound();
  return <SectionClient def={def} />;
}
