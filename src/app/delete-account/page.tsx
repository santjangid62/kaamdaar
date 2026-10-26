import InfoPage, { infoMetadata } from "../../components/InfoPage";

export const metadata = infoMetadata(
  "Request account deletion",
  "Delete your Kaamdaar account and personal data.",
);

export default function DeleteAccountPage() {
  return (
    <InfoPage
      title="Request account deletion"
      intro="You can delete your account and the personal data attached to it at any time."
      blocks={[
        {
          heading: "How to request",
          bullets: [
            "Sign in and open My profile.",
            "Tap Request account deletion in the menu.",
            "Confirm the request — your registered number is used to verify it.",
          ],
          paragraphs: [
            "Alternatively write to support@kaamdaar.in from your registered number with the subject “Account deletion request”.",
          ],
        },
        {
          heading: "What gets removed",
          bullets: [
            "Profile details — name, email, profile photo.",
            "Saved addresses.",
            "Active bookings are cancelled first; completed bookings may be retained where law requires it.",
          ],
        },
        {
          heading: "Timeline",
          paragraphs: [
            "Deletion is processed within 7 days of a verified request. Once deleted, the account cannot be restored — you would sign up again as a new user.",
          ],
        },
      ]}
    />
  );
}