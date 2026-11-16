import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSuperAuthed } from "../../lib/super-admin/auth";
import SuperAdminDashboard from "../../components/super-admin/SuperAdminDashboard";

export const instant = false;

export default async function SuperAdminPage() {
  await connection();
  if (!(await isSuperAuthed())) redirect("/super-admin/login");
  return <main className="min-h-screen bg-[#f3f6fb] px-3 py-5 text-slate-900 sm:px-5 lg:px-7"><SuperAdminDashboard /></main>;
}
