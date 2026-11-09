/**
 * Admin Dashboard — every widget renders REAL database aggregates via
 * getOverview() (same source as /api/admin/overview). Empty datasets show
 * honest empty states instead of placeholder numbers.
 */
import Link from "next/link";
import { Calendar, Download } from "lucide-react";
import { getOverview } from "../../../server/adminStats";
import { BarChart, ChartLegend, LineChart } from "../../../components/admin/charts";
import TopServicesCard from "../../../components/admin/TopServicesCard";
import {
  AreaServiceList,
  AutoRefresh,
  BookingTable,
  CategoryBreakdown,
  LiveBookingsList,
  LocationMap,
  MetricCards,
  ProviderServiceList,
  ReviewsList,
  StatStrip,
  SystemStatus,
  TopProvidersTable,
  ViewAll,
  WidgetCard,
} from "../../../components/admin/widgets";
import {
  ActivityLog,
  LiveTrackMap,
  TrackingTable,
} from "../../../components/admin/tracking";

// the dashboard reads the whole database on the server — same blocking rule
// as the panel layout, so Next does not try to prerender it
export const instant = false;

function PageHeader() {
  return (
    <div className="relative mb-1 flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-white to-blue-50/80 p-5 shadow-[0_12px_34px_-28px_rgba(18,97,160,0.35)] sm:p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-navy sm:text-[1.7rem]">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back! Here&apos;s what&apos;s happening with Kaamdaar today.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700"
        >
          <Download className="h-3.5 w-3.5" /> Export Report
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <Calendar className="h-3.5 w-3.5" /> Last 30 Days
        </button>
      </div>
    </div>
  );
}

function RangePill() {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">
      <Calendar className="h-3 w-3" /> Last 30 Days
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 py-10 text-center">
      <p className="max-w-xs text-sm text-slate-400">{text}</p>
    </div>
  );
}

const RUNNING_COLUMNS = [
  { key: "id", label: "#" },
  { key: "service", label: "Service" },
  { key: "customer", label: "Customer" },
  { key: "provider", label: "Provider" },
  { key: "area", label: "Area" },
  { key: "status", label: "Status" },
  { key: "waiting", label: "Since", align: "right" as const },
];

const PENDING_COLUMNS = [
  { key: "id", label: "#" },
  { key: "service", label: "Service" },
  { key: "customer", label: "Customer" },
  { key: "area", label: "Area" },
  { key: "status", label: "Status" },
  { key: "waiting", label: "Waiting", align: "right" as const },
];

const TODAY_COLUMNS = [
  { key: "id", label: "#" },
  { key: "service", label: "Service" },
  { key: "customer", label: "Customer" },
  { key: "provider", label: "Provider" },
  { key: "area", label: "Area" },
  { key: "slot", label: "Slot" },
  { key: "amount", label: "Amount", align: "right" as const },
  { key: "status", label: "Status" },
];

const UPCOMING_COLUMNS = [
  { key: "id", label: "#" },
  { key: "service", label: "Service" },
  { key: "customer", label: "Customer" },
  { key: "area", label: "Area" },
  { key: "slot", label: "Scheduled" },
  { key: "status", label: "Status" },
];

export default async function AdminDashboardPage() {
  const data = await getOverview();
  const topServices = data.topServices.map((s) => ({ ...s, rating: 0 }));

  return (
    <div className="space-y-5">
      <PageHeader />
      <MetricCards cards={data.metrics.cards} revenue={data.metrics.revenue} revenueDelta={data.metrics.revenueDelta} commission={data.metrics.commission} />

      {/* ---- ops view: today, running, waiting, upcoming ---- */}
      <WidgetCard title="Today at a Glance" right={<AutoRefresh seconds={20} />}>
        <StatStrip
          items={[
            { label: "Services today", value: data.today.total },
            { label: "Running right now", value: data.running.length, tone: "sky" },
            { label: "Waiting for a Pro", value: data.pending.length, tone: "orange" },
            { label: "Upcoming", value: data.upcoming.length, tone: "blue" },
            { label: "Completed today", value: data.today.completed, tone: "green" },
            { label: "Collected today", value: data.today.revenue, tone: "green" },
          ]}
        />
      </WidgetCard>

      {/* ---- live tracking: where every working Pro is right now ---- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <WidgetCard title="Live Pro Tracking" right={<AutoRefresh seconds={10} />}>
            <LiveTrackMap row={data.tracking.find((r) => r.point && r.destination) ?? null} />
            <p className="mt-2 text-[11px] text-slate-400">
              {data.tracking.length === 0
                ? "No Pro is on a job right now."
                : `${data.tracking.length} Pro${data.tracking.length === 1 ? "" : "s"} on a job · ${data.tracking.filter((r) => r.hasGps).length} sending GPS · the map follows the newest ping`}
            </p>
          </WidgetCard>
        </div>
        <div className="xl:col-span-7">
          <WidgetCard
            title="Who Is Where"
            right={`${data.tracking.filter((r) => r.hasGps).length} live`}
          >
            {data.tracking.length === 0 ? (
              <Empty text="No Pro is currently travelling to or working on a job." />
            ) : (
              <TrackingTable rows={data.tracking} />
            )}
          </WidgetCard>
        </div>
      </div>

      <WidgetCard
        title="Activity Log"
        right={
          <Link
            href="/admin/activity-log"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Full log · {data.activity.length}
          </Link>
        }
      >
        <ActivityLog rows={data.activity.slice(0, 12)} />
      </WidgetCard>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <WidgetCard title="Currently Running Services" right={`${data.running.length} live`}>
            {data.running.length === 0 ? (
              <Empty text="No service is in progress right now." />
            ) : (
              <BookingTable rows={data.running} columns={RUNNING_COLUMNS} dense />
            )}
          </WidgetCard>
        </div>
        <div className="xl:col-span-5">
          <WidgetCard title="Pending — Waiting for a Pro" right={`${data.pending.length} open`}>
            {data.pending.length === 0 ? (
              <Empty text="Nothing is waiting on a Pro right now." />
            ) : (
              <BookingTable rows={data.pending} columns={PENDING_COLUMNS} dense />
            )}
          </WidgetCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <WidgetCard title="Today's Services" right={`${data.today.total} on ${data.today.key}`}>
            {data.todayBookings.length === 0 ? (
              <Empty text="No service has been booked or scheduled for today yet." />
            ) : (
              <BookingTable rows={data.todayBookings} columns={TODAY_COLUMNS} dense />
            )}
          </WidgetCard>
        </div>
        <div className="xl:col-span-5">
          <WidgetCard title="Upcoming Services" right={`${data.upcoming.length} scheduled`}>
            {data.upcoming.length === 0 ? (
              <Empty text="No future-dated bookings on the calendar yet." />
            ) : (
              <BookingTable rows={data.upcoming} columns={UPCOMING_COLUMNS} dense />
            )}
          </WidgetCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <WidgetCard
          title="Services by Area"
          right={<span className="text-[10px] font-semibold text-slate-400">area → services · Pros</span>}
        >
          {data.areaServices.length === 0 ? (
            <Empty text="Area-wise service demand appears once bookings carry an address." />
          ) : (
            <AreaServiceList rows={data.areaServices} />
          )}
        </WidgetCard>
        <WidgetCard
          title="Providers & Their Services"
          right={<span className="text-[10px] font-semibold text-slate-400">who delivered what</span>}
        >
          {data.providerServices.length === 0 ? (
            <Empty text="Provider service history appears after the first accepted booking." />
          ) : (
            <ProviderServiceList rows={data.providerServices} />
          )}
        </WidgetCard>
      </div>

      {/* Row 1: charts + live bookings */}
      <div className="grid gap-5 xl:grid-cols-3">
        <WidgetCard title="Bookings Overview" right={<RangePill />}>
          <ChartLegend
            items={[
              { label: "Total Bookings", color: "#1261A0" },
              { label: "Completed", color: "#22c55e" },
              { label: "Cancelled", color: "#ef4444" },
            ]}
          />
          <div className="mt-2">
            <LineChart
              labels={data.bookingsSeries.labels}
              series={[
                { name: "Total", color: "#1261A0", values: data.bookingsSeries.total },
                { name: "Completed", color: "#22c55e", values: data.bookingsSeries.completed },
                { name: "Cancelled", color: "#ef4444", values: data.bookingsSeries.cancelled },
              ]}
            />
          </div>
        </WidgetCard>

        <WidgetCard title="Revenue Overview" right={<RangePill />}>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-slate-500">Total Revenue</span>
            <span className="text-lg font-extrabold text-navy">{data.metrics.revenue}</span>
            <span className="text-xs font-bold text-emerald-600">{data.metrics.revenueDelta}</span>
          </div>
          <div className="mt-1">
            <ChartLegend
              items={[
                { label: "Commission (10%)", color: "#1261A0" },
                { label: "Provider Payout", color: "#FF7A00" },
              ]}
            />
          </div>
          <div className="mt-1">
            <BarChart
              labels={data.revenueSeries.labels}
              series={[
                { name: "Commission", color: "#1261A0", values: data.revenueSeries.commission },
                { name: "Payout", color: "#FF7A00", values: data.revenueSeries.payout },
              ]}
            />
          </div>
        </WidgetCard>

        <WidgetCard title="Live Bookings" right={<ViewAll />}>
          {data.live.length === 0 ? (
            <Empty text="No live bookings right now. New dispatches appear here the moment a customer books." />
          ) : (
            <LiveBookingsList rows={data.live} />
          )}
        </WidgetCard>
      </div>

      {/* Row 2: categories, top services, map, reviews */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <WidgetCard title="Service Categories" right={<ViewAll />}>
          {data.categories.total === 0 ? (
            <Empty text="The category split appears once the first bookings are recorded." />
          ) : (
            <CategoryBreakdown slices={data.categories.slices} total={data.categories.total} />
          )}
        </WidgetCard>
        <TopServicesCard rows={topServices} />
        <WidgetCard
          title="Bookings by Location"
          right={
            <span className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">
              Jaipur
            </span>
          }
        >
          {data.areas.length === 0 ? (
            <Empty text="Area heat appears on the map as bookings come in with addresses." />
          ) : (
            <LocationMap areas={data.areas} />
          )}
        </WidgetCard>
        <WidgetCard title="Recent Customer Reviews" right={<ViewAll />}>
          {data.reviews.length === 0 ? (
            <Empty text="No reviews yet — they show up after customers rate completed work." />
          ) : (
            <ReviewsList rows={data.reviews} />
          )}
        </WidgetCard>
      </div>

      {/* Row 3: latest bookings, top providers, system status */}
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <WidgetCard title="Latest Bookings" right={<ViewAll />}>
            {data.latest.length === 0 ? (
              <Empty text="No bookings yet. They will list here as soon as customers book services." />
            ) : (
              <BookingTable
                rows={data.latest}
                columns={[
                  { key: "id", label: "#" },
                  { key: "customer", label: "Customer" },
                  { key: "service", label: "Service" },
                  { key: "location", label: "Location" },
                  { key: "amount", label: "Amount", align: "right" },
                  { key: "status", label: "Status" },
                  { key: "time", label: "Time" },
                ]}
                dense
              />
            )}
          </WidgetCard>
        </div>
        <div className="xl:col-span-3">
          <WidgetCard title="Top Providers" right={<ViewAll />}>
            {data.topProviders.length === 0 ? (
              <Empty text="Provider leaderboard fills in from completed bookings." />
            ) : (
              <TopProvidersTable rows={data.topProviders} />
            )}
          </WidgetCard>
        </div>
        <div className="xl:col-span-3">
          <WidgetCard title="System Status">
            <SystemStatus rows={data.systemStatus} />
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}