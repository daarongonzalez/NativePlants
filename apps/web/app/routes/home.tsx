import { useState } from "react";
import type { Route } from "./+types/home";
import type { AddressState } from "../components/landing/AddressForm";
import { Closing } from "../components/landing/Closing";
import { Hero } from "../components/landing/Hero";
import { Nav } from "../components/landing/Nav";
import { NativeYard } from "../components/landing/NativeYard";
import { RebateCalculator } from "../components/landing/RebateCalculator";
import { ThreeAnswers } from "../components/landing/ThreeAnswers";
import { WaterFacts } from "../components/landing/WaterFacts";
import { shareImageMeta } from "../lib/meta";

const TITLE = "Nativo · Native plants and lawn rebates for your yard";
const DESCRIPTION =
  "One street address unlocks your soil and climate, the lawn rebate your water provider offers, and native plants that suit your yard. Now serving the Wasatch Front.";

export function meta(_: Route.MetaArgs) {
  return [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESCRIPTION },
    { property: "og:site_name", content: "Nativo" },
    ...shareImageMeta,
  ];
}

export default function Home() {
  const [addr, setAddr] = useState("");

  // Shared by both address forms, so typing in one fills the other.
  const address: AddressState = { addr, setAddr };

  return (
    <div className="lp">
      <Nav />
      <main>
        <Hero address={address} />
        <ThreeAnswers />
        <WaterFacts />
        <NativeYard />
        <RebateCalculator />
        <Closing address={address} />
      </main>
    </div>
  );
}
