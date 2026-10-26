import InfoPage, { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "About us",
  "Kaamdaar is a home-services marketplace connecting households with trained, verified professionals.",
);

export default function AboutPage() {
  return (
    <InfoPage
      title="About us"
      intro="Kaamdaar connects households with trained, verified professionals for everyday chores — cleaning, laundry, kitchen work and flexible hourly help."
      blocks={[
        {
          heading: "What we do",
          paragraphs: [
            "We operate a service catalogue managed by our team: every service has a published scope, a transparent starting rate and a defined duration, so you know what you are paying for before you confirm.",
            "Professionals are trained and background-verified before they appear in your list of nearby providers.",
          ],
        },
        {
          heading: "How booking works on the website",
          bullets: [
            "Your current location is detected and shown in the navbar.",
            "You browse services, search and check rates without logging in.",
            "Logging in needs only your phone number and an OTP; you stay signed in until you log out.",
            "Choosing a service lists every provider available within a 2–3 km radius of your address.",
            "Confirm the slot and the booking appears in your profile under My bookings.",
          ],
        },
        {
          heading: "Our promise",
          bullets: [
            "Transparent pricing shown before you confirm.",
            "Trained and verified professionals only.",
            "Support 7 AM to 10 PM, every day.",
            "Your data stays yours — request deletion any time from your profile.",
          ],
        },
      ]}
    />
  );
}