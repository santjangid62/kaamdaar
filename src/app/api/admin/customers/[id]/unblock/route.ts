import { NextResponse } from "next/server";
import { get, insert, patch, ready, uid } from "../../../../../../server/db";
import { isAuthed } from "../../../../../../lib/admin/auth";
import { recordAudit } from "../../../../../../server/audit";
import type { User } from "../../../../../../lib/types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const { id } = await ctx.params;
  const user = await get<User>("users", id);
  if (!user) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (user.status !== "blocked") return NextResponse.json({ error: "Customer account is not blocked" }, { status: 409 });

  const updated = await patch<User>("users", id, { status: "active", updatedAt: Date.now() });
  if (!updated) return NextResponse.json({ error: "Could not unblock customer" }, { status: 500 });

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Customer";
  const now = Date.now();
  await insert("notifications", {
    id: uid("ntf"), type: "customer_account_unblocked",
    title: "Your Kaamdaar account is active again",
    message: "Your account has been unblocked by Kaamdaar Admin. You can now sign in and book services again.",
    userId: user.id, userName: name, phone: user.phone, platform: "Admin account review",
    readAt: null, createdAt: now,
  });

  let emailSent = false;
  let emailStatus = user.email ? "Email service is not configured; in-app notification was saved." : "Customer has no email address; in-app notification was saved.";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (user.email && apiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [user.email],
          subject: "Your Kaamdaar account has been unblocked",
          html: `<p>Hello ${escapeHtml(name)},</p><p>Your Kaamdaar account has been reviewed and unblocked by our Admin team. You can now sign in using your registered mobile number and book services again.</p><p>Thank you,<br/>Kaamdaar Support</p>`,
        }),
      });
      if (response.ok) {
        emailSent = true;
        emailStatus = "Unblock confirmation email sent.";
      } else {
        emailStatus = `Email provider returned HTTP ${response.status}; in-app notification was saved.`;
      }
    } catch {
      emailStatus = "Email could not be sent; in-app notification was saved.";
    }
  }

  await recordAudit({
    actor: "admin", action: "status_changed", module: "Customers",
    title: "Customer account unblocked",
    description: `${name} (${user.phone}); emailSent=${emailSent}`,
    reference: user.id, severity: "success",
  });
  return NextResponse.json({ ok: true, emailSent, emailStatus, user: updated });
}
