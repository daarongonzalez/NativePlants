import { useState } from "react";
import type { Route } from "./+types/home";
import landingStyles from "../styles/landing.css?url";
import type { AddressState } from "../components/landing/AddressForm";
import { Closing } from "../components/landing/Closing";
import { Hero } from "../components/landing/Hero";
import { Nav } from "../components/landing/Nav";
import { NativeYard } from "../components/landing/NativeYard";
import { RebateCalculator } from "../components/landing/RebateCalculator";
import { ThreeAnswers } from "../components/landing/ThreeAnswers";
import { WaterFacts } from "../components/landing/WaterFacts";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: landingStyles }];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Nativo · Native plants for the Wasatch Front" },
    {
      name: "description",
      content:
        "One street address unlocks your soil and climate, Utah's water-wise lawn rebate, and a ranked list of native plants for your yard.",
    },
  ];
}

export default function Home() {
  const [addr, setAddrValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Shared by both address forms. Editing the field clears the confirmation.
  const address: AddressState = {
    addr,
    submitted,
    setAddr: (value) => {
      setAddrValue(value);
      setSubmitted(false);
    },
    submit: () => setSubmitted(true),
  };

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
