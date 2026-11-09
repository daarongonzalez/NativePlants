import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { EventType, Fit, Layout, useRive, type Event as RiveEvent } from "@rive-app/react-webgl2";
import gardenUrl from "../../assets/nativo-garden.riv?url";
import { Responsive, Window } from "./primitives";

/**
 * The game canvas. Built from the Rive project "Nativo Interactions"; the .riv
 * must be built with `rive . --publish` (signed), because web runtimes refuse
 * unsigned scripts.
 */
function GardenCanvas() {
  const navigate = useNavigate();
  const { rive, RiveComponent } = useRive({
    src: gardenUrl,
    artboard: "Garden",
    stateMachine: "Garden Machine",
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain }),
  });

  // The game's "Plan your real yard" button fires a Rive event; the site does the navigating.
  useEffect(() => {
    if (!rive) return;
    const onEvent = (event: RiveEvent) => {
      const data = event.data as { name?: string } | undefined;
      if (data?.name === "planRealYard") navigate("/plan");
    };
    rive.on(EventType.RiveEvent, onEvent);
    return () => rive.off(EventType.RiveEvent, onEvent);
  }, [rive, navigate]);

  return <RiveComponent className="lp-garden__canvas" />;
}

/**
 * "Try it": Nativo Garden, a calm top-down game. Swap a 1,000 sq ft lawn for
 * native plants, water them, rest until morning and watch the rebate add up.
 */
export function GardenGame() {
  // The Rive player needs a browser; the server renders the sized, empty frame.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Window
      label={<Responsive desktop="try-it · grow a native yard" phone="try-it · native yard" />}
      tone="paper"
      size="lg"
      className="lp-planner lp-garden"
    >
      <div className="lp-garden__stage" role="group" aria-label="Nativo Garden, a game: swap lawn for native plants">
        {mounted && <GardenCanvas />}
      </div>
    </Window>
  );
}
