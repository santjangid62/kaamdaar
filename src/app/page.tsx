import type { Metadata } from "next";
import HomeView from "../components/HomeView";

export const metadata: Metadata = {
  title: "Kaamdaar — Har Kaam Turant | Trusted house help in minutes",
};

export default function HomePage() {
  return <HomeView />;
}
