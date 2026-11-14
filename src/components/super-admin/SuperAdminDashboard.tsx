"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, Bell, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Download, FileBarChart, Globe2, Headphones, LayoutDashboard, MapPin, Printer, RefreshCw, Search, Settings, Share2, ShieldCheck, Star, Users, Wallet } from "lucide-react";

type DashboardData = {
  generatedAt:number;
  metrics:{customers:number;providers:number;onlineProviders:number;bookings:number;completed:number;cancelled:number;revenue:number;commission:number;live:number;activeAdmins:number;completionRate:number;cancellationRate:number};
  queues:{pendingKyc:number;pendingPayments:number;pendingComplaints:number;pendingPayouts:number};
  charts:{daily:{day:string;total:number;completed:number;cancelled:number;revenue:number}[];services:{name:string;bookings:number;revenue:number}[];cities:{city:string;count:number}[]};
  recentBookings:Record<string,unknown>[];
  recentActivity:Record<string,unknown>[];
  counts:Record<string,number>;
};
const money=(v:number)=>"₹"+Math.round(v).toLocaleString("en-IN");
const num=(v:number)=>v.toLocaleString("en-IN");
const sections=[
  {title:"Platform Operations",items:[["Bookings","/admin/all-bookings",ClipboardList],["Live Operations","/admin/live-bookings",Activity],["Customers","/admin/customers",Users],["Providers","/admin/service-providers",BriefcaseBusiness],["Services Catalogue","/admin/services",BookOpen],["Pricing & Commission","/admin/pricing-commission",Banknote]]},
  {title:"Finance & Trust",items:[["Payments & Wallets","/admin/payments",Wallet],["Provider Payouts","/admin/provider-payouts",Banknote],["KYC Management","/admin/kyc-queue",ShieldCheck],["Reviews & Ratings","/admin/reviews",Star],["Complaints","/admin/customer-complaints",Headphones]]},
  {title:"Control Centre",items:[["Admin Users","/admin/admin-users",Users],["Roles & Permissions","/admin/roles-permissions",ShieldCheck],["Reports & Insights","/admin/reports",FileBarChart],["Notifications","/admin/notifications",Bell],["System Settings","/admin/system-settings",Settings],["Activity Logs","/admin/activity-log",Activity]]},
] as const;
function Metric({label,value,sub,icon:Icon,tone="blue"}:{label:string;value:string;sub:string;icon:typeof Users;tone?:string}) {
 const tones:Record<string,string>={blue:"bg-blue-600",green:"bg-emerald-500",orange:"bg-orange-500",purple:"bg-violet-500",red:"bg-rose-500",gold:"bg-amber-500"};
 return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-tight text-[#102a56]">{value}</p><p className="mt-1 text-[11px] text-slate-500">{sub}</p></div><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${tones[tone]??tones.blue}`}><Icon size={19}/></span></div></div>;
}
function Panel({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}) {return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-bold text-[#102a56]">{title}</h2>{action}</div>{children}</section>;}
export default function SuperAdminDashboard(){
 const [data,setData]=useState<DashboardData|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [range,setRange]=useState("30");
 const [query,setQuery]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/super-admin/overview",{cache:"no-store"});if(!r.ok)throw new Error(r.status===401?"Session expired. Please sign in again.":"Could not load platform overview.");setData(await r.json());}catch(e){setError(e instanceof Error?e.message:"Something went wrong");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 const daily=useMemo(()=>data?.charts.daily.slice(-Number(range))??[],[data,range]);
 const exportReport=()=>{
  if(!data)return;
  const rows=[["Section","Metric","Value"],...Object.entries(data.metrics).map(([k,v])=>["Platform KPIs",k,String(v)]),...Object.entries(data.queues).map(([k,v])=>["Pending queues",k,String(v)]),...Object.entries(data.counts).map(([k,v])=>["Collection totals",k,String(v)])];
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="kaamdaar-super-admin-report.csv";a.click();URL.revokeObjectURL(url);
 };
 const share=async()=>{
  const url=window.location.href;
  const text=`Kaamdaar Super Admin Report\nCustomers: ${num(data?.metrics.customers??0)}\nProviders: ${num(data?.metrics.providers??0)}\nBookings: ${num(data?.metrics.bookings??0)}\nRevenue: ${money(data?.metrics.revenue??0)}\nReport: ${url}`;
  if(navigator.share){try{await navigator.share({title:"Kaamdaar Platform Report",text,url});}catch{}}
  else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert("Report summary and link copied.");}
 };
 const m=data?.metrics;
 const max=Math.max(1,...daily.map(x=>x.total));
 const filtered=(data?.recentBookings??[]).filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase()));
 return <div className="space-y-5">
  <header className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-white to-blue-50 p-5 shadow-sm">
   <div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600"><ShieldCheck size={15}/> Global control centre</div><h1 className="text-2xl font-black tracking-tight text-[#102a56]">Super Admin Dashboard</h1><p className="mt-1 text-sm text-slate-500">Complete overview and control of Kaamdaar platform operations</p></div>
   <div className="flex flex-wrap gap-2"><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><RefreshCw size={14}/> Refresh</button><button onClick={exportReport} disabled={!data} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Download size={14}/> Export CSV</button><button onClick={()=>void share()} disabled={!data} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><Share2 size={14}/> Share</button><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><Printer size={14}/> Print</button></div>
  </header>
  {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <Link href="/admin/login" className="font-bold underline">Admin sign in</Link></div>}
  {loading&&!data&&<div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Loading live platform data…</div>}
  {data&&m&&<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
    <Metric label="Total Customers" value={num(m.customers)} sub="Registered customer accounts" icon={Users}/>
    <Metric label="Total Providers" value={num(m.providers)} sub={`${num(m.onlineProviders)} currently online`} icon={BriefcaseBusiness} tone="green"/>
    <Metric label="Total Bookings" value={num(m.bookings)} sub={`${num(m.live)} live / in progress`} icon={CalendarDays} tone="orange"/>
    <Metric label="Completed Bookings" value={num(m.completed)} sub={`${m.completionRate}% completion rate`} icon={CheckCircle2} tone="purple"/>
    <Metric label="Cancelled Bookings" value={num(m.cancelled)} sub={`${m.cancellationRate}% cancellation rate`} icon={AlertTriangle} tone="red"/>
    <Metric label="Gross Service Revenue" value={money(m.revenue)} sub={`Commission ${money(m.commission)}`} icon={Banknote} tone="gold"/>
   </div>
   <div className="grid gap-4 xl:grid-cols-12">
    <div className="xl:col-span-7"><Panel title="Bookings & Revenue Trend" action={<select value={range} onChange={e=>setRange(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs"><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select>}>
     <div className="flex items-center gap-4 text-[11px] text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-500"/>Bookings</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500"/>Completed</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500"/>Cancelled</span></div>
     <div className="mt-4 flex h-48 items-end gap-1 border-b border-slate-100 pb-1">{daily.map(d=><div key={d.day} title={`${d.day}: ${d.total} bookings · ${d.completed} completed · ${d.cancelled} cancelled · ${money(d.revenue)}`} className="group flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]"><div className="w-full max-w-3 rounded-t bg-blue-500" style={{height:`${Math.max(2,d.total/max*100)}%`}}/><div className="w-full max-w-3 rounded-t bg-emerald-500" style={{height:`${Math.max(1,d.completed/max*100)}%`}}/><div className="w-full max-w-3 rounded-t bg-rose-400" style={{height:`${Math.max(1,d.cancelled/max*100)}%`}}/></div>)}</div>
     <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{daily[0]?.day??"—"}</span><span>{daily[Math.floor(daily.length/2)]?.day??"—"}</span><span>{daily.at(-1)?.day??"—"}</span></div>
    </Panel></div>
    <div className="xl:col-span-5"><Panel title="Pending Action Centre"><div className="grid grid-cols-2 gap-2">
     {[[ "KYC pending",data.queues.pendingKyc,"/admin/kyc-queue",ShieldCheck,"orange"],["Payment checks",data.queues.pendingPayments,"/admin/payment-confirmations",Wallet,"blue"],["Open complaints",data.queues.pendingComplaints,"/admin/customer-complaints",Headphones,"red"],["Payouts pending",data.queues.pendingPayouts,"/admin/provider-payouts",Banknote,"purple"]] .map(([label,value,href,Icon,tone])=>{const I=Icon as typeof Users;return <Link key={String(label)} href={String(href)} className="rounded-xl border border-slate-100 p-3 hover:border-blue-200 hover:bg-blue-50/40"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{String(label)}</span><I size={15} className="text-slate-400"/></div><p className="mt-2 text-2xl font-extrabold text-[#102a56]">{num(Number(value))}</p><span className="text-[10px] font-semibold text-blue-600">Review queue →</span></Link>})}
    </div></Panel></div>
   </div>
   <div className="grid gap-4 xl:grid-cols-12">
    <div className="xl:col-span-4"><Panel title="Top Services by Bookings"><div className="space-y-3">{data.charts.services.map((s,i)=><div key={s.name}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-slate-600">{i+1}. {s.name}</span><b className="text-[#102a56]">{num(s.bookings)}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{width:`${s.bookings/Math.max(1,data.charts.services[0]?.bookings??1)*100}%`}}/></div></div>)}{!data.charts.services.length&&<p className="text-sm text-slate-400">No booking data yet.</p>}</div></Panel></div>
    <div className="xl:col-span-4"><Panel title="Bookings by Location"><div className="space-y-3">{data.charts.cities.map((c,i)=><div key={c.city} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-slate-600"><MapPin size={13}/>{c.city}</span><b className="text-[#102a56]">{num(c.count)}</b></div>)}{!data.charts.cities.length&&<p className="text-sm text-slate-400">No location data yet.</p>}</div></Panel></div>
    <div className="xl:col-span-4"><Panel title="Platform Health & Data"><div className="space-y-2">{Object.entries(data.counts).map(([name,count])=><div key={name} className="flex items-center justify-between border-b border-slate-50 pb-1.5 text-xs"><span className="capitalize text-slate-500">{name.replace(/([A-Z])/g," $1")}</span><b className="text-[#102a56]">{num(count)}</b></div>)}</div></Panel></div>
   </div>
   <Panel title="Global Management Shortcuts"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{sections.flatMap(g=>g.items).map(([label,href,Icon])=><Link key={href} href={href} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50"><Icon size={16} className="text-blue-600"/>{label}<span className="ml-auto text-slate-300">↗</span></Link>)}</div></Panel>
   <Panel title="Recent Bookings" action={<div className="flex items-center gap-2"><label className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1"><Search size={12}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search bookings…" className="w-28 text-xs outline-none"/></label><Link href="/admin/all-bookings" className="text-xs font-semibold text-blue-600">View all</Link></div>}>
    <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead><tr className="border-b text-slate-400"><th className="pb-2">Booking ID</th><th className="pb-2">Customer</th><th className="pb-2">Service</th><th className="pb-2">Provider</th><th className="pb-2">Amount</th><th className="pb-2">Status</th></tr></thead><tbody>{filtered.map((b,i)=><tr key={String(b.id??i)} className="border-b border-slate-50"><td className="py-2 font-semibold text-blue-700">{String(b.id??"—")}</td><td>{String(b.userId??b.customer??"—")}</td><td>{String(b.serviceName??"—")}</td><td>{String(b.providerName??"—")}</td><td>{money(Number(b.amount??0))}</td><td><span className="rounded-full bg-slate-100 px-2 py-1">{String(b.status??"—")}</span></td></tr>)}</tbody></table>{!filtered.length&&<p className="py-6 text-center text-slate-400">No matching bookings.</p>}</div>
   </Panel>
   <Panel title="Recent Audit Activity" action={<Link href="/admin/activity-log" className="text-xs font-semibold text-blue-600">Full activity log</Link>}>
    <div className="space-y-2">{data.recentActivity.map((a,i)=><div key={String(a.id??i)} className="flex items-start gap-3 border-b border-slate-50 pb-2"><span className="mt-1 h-2 w-2 rounded-full bg-blue-500"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-700">{String(a.title??a.action??"System activity")}</p><p className="text-[11px] text-slate-500">{String(a.description??"")} · {String(a.actor??"system")}</p></div><span className="text-[10px] text-slate-400">{a.at?new Date(Number(a.at)).toLocaleString("en-IN"):"—"}</span></div>)}{!data.recentActivity.length&&<p className="text-sm text-slate-400">No audit events recorded yet.</p>}</div>
   </Panel>
   <p className="text-right text-[10px] text-slate-400">Live database snapshot · Updated {new Date(data.generatedAt).toLocaleString("en-IN")} · Active admin accounts: {num(m.activeAdmins)}</p>
  </>}
  <style jsx global>{`@media print{body{background:#fff!important}.no-print,button{display:none!important}main{padding:0!important}.rounded-xl,.rounded-2xl{break-inside:avoid;box-shadow:none!important}}`}</style>
 </div>;
}
