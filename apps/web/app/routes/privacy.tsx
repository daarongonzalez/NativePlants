import type { Route } from "./+types/privacy";
import { PRIVACY } from "../content/privacy";
import { Policy } from "../components/site/Policy";
import { pageMeta } from "../lib/meta";

export function meta(_: Route.MetaArgs) {
  return pageMeta({ title: PRIVACY.title, description: PRIVACY.description, draft: PRIVACY.draft });
}

export default function PrivacyPage() {
  return <Policy page={PRIVACY} />;
}
