import type { Metadata } from "next";
import HowItWorksPage from "../../components/HowItWorksPage";

export const metadata: Metadata = {
  title: "How It Works | Kaamdaar",
  description: "See how easy it is to find and book trusted home services with Kaamdaar.",
};

export default function HowItWorksRoute() {
  return <HowItWorksPage />;
}
