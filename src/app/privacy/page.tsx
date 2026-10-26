import InfoPage, { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "Privacy Policy",
  "How Kaamdaar collects, uses and protects your personal data.",
);

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      intro="This policy explains what we collect, why we collect it, and the control you have over your information."
      updated="24 October 2026"
      blocks={[
        {
          heading: "Information we collect",
          bullets: [
            "Mobile number — required for login and OTP verification.",
            "First name, last name and email — optional, added by you on your profile.",
            "Profile photo — optional, uploaded by you.",
            "Addresses — as many as you add, including label and pincode.",
            "Device location — only when you allow it, used to show your area in the navbar and to find nearby professionals.",
            "Bookings — service, provider, slot, address and amount.",
          ],
        },
        {
          heading: "How we use it",
          paragraphs: [
            "To verify your identity, personalise your experience, match you with nearby professionals, and to provide booking history and support.",
            "We do not sell your personal information.",
          ],
        },
        {
          heading: "Location data",
          paragraphs: [
            "Location is read from your browser only when you grant permission, and it is used to show your area and to calculate provider distance. You can deny permission and still browse the site; you would then pick a saved address manually.",
          ],
        },
        {
          heading: "Data retention and deletion",
          paragraphs: [
            "You can request account deletion from your profile at any time. Deletion removes your profile details, addresses and booking history associated with your number, subject to records we are legally required to keep.",
          ],
        },
        {
          heading: "Security",
          paragraphs: [
            "Access to production data is restricted to authorised personnel, transmitted over HTTPS, and stored in access-controlled systems.",
          ],
        },
        {
          heading: "Contact",
          paragraphs: [
            "Questions about this policy can be raised through the Help & Support page.",
          ],
        },
      ]}
    />
  );
}