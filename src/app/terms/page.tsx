import InfoPage, { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "Terms of Service",
  "Terms governing the use of the Kaamdaar website and bookings.",
);

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of Service"
      intro="These terms govern your use of the Kaamdaar website, your account and every booking you place with us."
      updated="24 October 2026"
      blocks={[
        {
          heading: "Accounts and login",
          paragraphs: [
            "Login is tied to your mobile number. You are responsible for activity that happens from your verified number and should log out on shared devices.",
            "You agree to provide accurate profile details. We store your name, mobile number, and — only if you choose to add it — your email address and profile photo.",
          ],
        },
        {
          heading: "Bookings, pricing and payment",
          bullets: [
            "The price shown at confirmation is the price you pay for the selected scope.",
            "Rates may vary with location, service complexity, demand and time of booking.",
            "Additional work outside the published scope is quoted separately before it is started.",
            "Instant bookings depend on provider availability; we may offer a different slot if no professional is free.",
          ],
        },
        {
          heading: "Cancellation and refunds",
          paragraphs: [
            "Cancellation terms depend on the booking mode — instant, scheduled or recurring — and on how close to the slot you cancel. Refunds, where applicable, are returned to the original payment method.",
          ],
        },
        {
          heading: "Your conduct",
          bullets: [
            "Provide a safe working environment for the professional.",
            "Do not engage professionals outside the platform for bookings made through Kaamdaar.",
            "Report issues through Help & Support instead of resolving disputes directly.",
          ],
        },
        {
          heading: "Termination",
          paragraphs: [
            "We may suspend or close accounts that violate these terms. You can request deletion of your account at any time from your profile.",
          ],
        },
      ]}
    />
  );
}