/** Guarded admin panel: requires the signed session cookie, else → login. */
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isAuthed } from "../../../lib/admin/auth";
import AdminShell from "../../../components/admin/AdminShell";

// the session check reads cookies() + the clock on every request — this route
// blocks at request time instead of trying to prerender a static shell
export const instant = false;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await connection();
  if (!(await isAuthed())) redirect("/admin/login");
  return <AdminShell>{children}</AdminShell>;
}
