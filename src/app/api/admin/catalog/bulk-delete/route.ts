import { NextResponse } from "next/server";
import { all, remove, ready } from "../../../../../server/db";
import { isAuthed } from "../../../../../lib/admin/auth";
import { recordAudit } from "../../../../../server/audit";

type Scope = "categories" | "services" | "sub-services" | "all";

/** Bulk catalogue cleanup only. Booking snapshots, customers, providers and finance history are never touched. */
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  let body: { scope?: Scope; confirm?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const scope = body.scope;
  if (!scope || !["categories", "services", "sub-services", "all"].includes(scope)) {
    return NextResponse.json({ error: "Choose a valid catalogue scope" }, { status: 422 });
  }
  if (body.confirm !== "DELETE CATALOGUE") {
    return NextResponse.json({ error: "Explicit DELETE CATALOGUE confirmation is required" }, { status: 422 });
  }

  const serviceRows = await all<{ id: string; parent?: string }>("services");
  const categoryRows = scope === "categories" || scope === "all" ? await all<{ id: string }>("categories") : [];
  const targets = scope === "all"
    ? serviceRows
    : scope === "services"
      ? serviceRows.filter((s) => !s.parent)
      : scope === "sub-services"
        ? serviceRows.filter((s) => Boolean(s.parent))
        : [];
  // Deleting a parent also removes its child rows, but only within the selected scope.
  const deleteServices = scope === "services"
    ? serviceRows.filter((s) => !s.parent || targets.some((p) => p.id === s.parent))
    : scope === "all" ? serviceRows : targets;

  let deletedServices = 0, deletedCategories = 0;
  for (const row of deleteServices) if (await remove("services", row.id)) deletedServices++;
  for (const row of categoryRows) if (await remove("categories", row.id)) deletedCategories++;
  await recordAudit({
    action: "deleted",
    module: "catalogue",
    title: "Bulk catalogue deletion",
    description: `Scope ${scope}; removed ${deletedCategories} categories and ${deletedServices} services/sub-services. Booking and payment history preserved.`,
    severity: "warning",
  });
  return NextResponse.json({ ok: true, scope, deleted: { categories: deletedCategories, services: deletedServices } });
}
