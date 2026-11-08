import { infoMetadata } from "../../components/InfoPage";
import HelpView from "../../components/HelpView";

export const metadata = infoMetadata(
  "Help & Support",
  "Find answers, track complaints or raise a request with the support team.",
);

export default function HelpPage() {
  return <HelpView />;
}
