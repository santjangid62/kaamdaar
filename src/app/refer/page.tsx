import InfoPage, { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "Refer & Earn",
  "Share your referral code and earn credits on your friends' bookings.",
);

export default function ReferPage() {
  return (
    <InfoPage
      title="Refer & Earn"
      intro="Invite friends to Kaamdaar and earn credits they can adjust against their bookings. Your code is shown on your profile."
      blocks={[
        {
          heading: "How it works",
          bullets: [
            "Open your profile and copy your referral code.",
            "Share it with friends before their first booking.",
            "When their first booking is completed, credits are added to both accounts.",
            "Credits are adjusted against your next booking total automatically.",
          ],
        },
        {
          heading: "Terms of the offer",
          paragraphs: [
            "Credits are granted per new customer, once per referred number. Credits have no cash value and cannot be transferred to a bank account. We may withdraw or change the offer with notice.",
            "The offer applies to customer bookings. Professionals who want to refer other professionals should use the Pro referral programme in the partner app.",
          ],
        },
        {
          heading: "Where do I find my code?",
          paragraphs: [
            "Sign in with your phone number, open My profile, and your code sits right under the Refer & Earn card.",
          ],
        },
      ]}
    />
  );
}