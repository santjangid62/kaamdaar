import Link from "next/link";
import InfoPage, { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "Help & Support",
  "Get help with a booking, your account or payments.",
);

export default function HelpPage() {
  return (
    <div>
      <InfoPage
        title="Help & Support"
        intro="Stuck with a booking, a payment or your account? Here is the fastest way to get it sorted."
        blocks={[
          {
            heading: "Talk to us",
            paragraphs: [
              "Support is available every day between 7:00 AM and 10:00 PM. Average first response is under 10 minutes on chat.",
              "Write to support@kaamdaar.in with your registered mobile number and booking ID — we reply within 24 hours.",
            ],
          },
          {
            heading: "Common questions",
            bullets: [
              "OTP not arriving? Wait 30 seconds and tap Resend OTP, then check your SMS/WhatsApp.",
              "Wrong address? Open My bookings, cancel and rebook with the correct address.",
              "Rate differs from the site? The final amount reflects your address and scope; anything extra is always quoted first.",
              "Need to change your number? Contact support — number changes need manual verification.",
            ],
          },
          {
            heading: "Cancellation & refunds",
            paragraphs: [
              "Cancellation windows and refunds differ for instant, scheduled and recurring bookings. The applicable rule is shown before you confirm a cancellation.",
            ],
          },
        ]}
      />
      <div className="section-shell -mt-4 pb-12">
        <Link href="/profile" className="btn-primary">
          Open my bookings
        </Link>
      </div>
    </div>
  );
}