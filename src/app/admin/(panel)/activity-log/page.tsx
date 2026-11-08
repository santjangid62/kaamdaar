/**
 * Admin → Activity Log. Every booking action the server recorded, newest
 * first: who did what, on which job, and when. Read-only by design — the log
 * is written by the booking API, never by the panel.
 */
import { getOverview } from "../../../../server/adminStats";
import { ActivityLog } from "../../../../components/admin/tracking";
import { AutoRefresh, StatStrip, WidgetCard } from "../../../../components/admin/widgets";

export const instant = false;

export default async function ActivityLogPage() {
  const data = await getOverview();
  const rows = data.activity;
  const count = (actor: string) => rows.filter((r) => r.actor === actor).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Activity Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every action on a booking, written by the server the moment it happens.
        </p>
      </div>

      <WidgetCard title="Last 80 events" right={<AutoRefresh seconds={15} />}>
        <StatStrip
          items={[
            { label: "Events logged", value: rows.length },
            { label: "By providers", value: count("provider"), tone: "green" },
            { label: "By customers", value: count("customer"), tone: "blue" },
            { label: "By admin", value: count("admin"), tone: "sky" },
            { label: "System", value: count("system"), tone: "grey" },
            { label: "Live jobs tracked", value: data.tracking.length, tone: "orange" },
          ]}
        />
      </WidgetCard>

      <WidgetCard
        title="Timeline"
        right={<span className="text-[10px] font-semibold text-slate-400">newest first</span>}
      >
        <ActivityLog rows={rows} />
      </WidgetCard>
    </div>
  );
}
