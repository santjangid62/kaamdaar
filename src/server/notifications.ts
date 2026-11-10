import { insert, uid } from "./db";
import type { User } from "../lib/types";

export async function createUserRegisteredNotification(user: User): Promise<void> {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "New customer";
  await insert("notifications", {
    id: uid("ntf"),
    type: "user_registered",
    title: "New customer registered",
    message: name + " registered on Kaamdaar.",
    userId: user.id,
    userName: name,
    phone: user.phone,
    platform: user.registrationPlatform === "mobile_app" ? "Mobile App" : "Website",
    readAt: null,
  });
}
