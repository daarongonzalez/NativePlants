import type { Route } from "./+types/terms";
import { TERMS } from "../content/terms";
import { Policy } from "../components/site/Policy";
import { pageMeta } from "../lib/meta";

export function meta(_: Route.MetaArgs) {
  return pageMeta({ title: TERMS.title, description: TERMS.description, draft: TERMS.draft });
}

export default function TermsPage() {
  return <Policy page={TERMS} />;
}
