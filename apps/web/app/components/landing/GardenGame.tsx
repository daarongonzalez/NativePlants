import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  EventType,
  Fit,
  Layout,
  RuntimeLoader,
  useRive,
  type Event as RiveEvent,
} from "@rive-app/react-webgl2";
import riveWasmUrl from "@rive-app/webgl2/rive.wasm?url";
import riveFallbackWasmUrl from "@rive-app/webgl2/rive_fallback.wasm?url";
import gardenUrl from "../../assets/nativo-garden.riv?url";
import { Responsive, Window } from "./primitives";

// Serve the Rive player from this site rather than its default CDN (unpkg, then jsdelivr).
RuntimeLoader.setWasmUrl(riveWasmUrl);
RuntimeLoader.setWasmFallbackUrl(riveFallbackWasmUrl);

// Matches the landing page's phone breakpoint in landing.css.
const PHONE_QUERY = "(max-width: 767px)";

type Board = { artboard: string; aspect: string };
const WIDE: Board = { artboard: "Garden", aspect: "8 / 5" };
const COMPACT: Board = { artboard: "Garden Compact", aspect: "39 / 74" };

/**
 * The game canvas. Built from the Rive project "Nativo Interactions"; the .riv
 * must be built with `rive . --publish` (signed), because web runtimes refuse
 * unsigned scripts.
 */
function GardenCanvas({ artboard }: { artboard: string }) {
  const navigate = useNavigate();
  const { rive, RiveComponent } = useRive({
    src: gardenUrl,
    artboard,
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
 * Phones get the portrait artboard, picked once on load.
 */
export function GardenGame() {
  // The Rive player needs a browser; the server renders the sized, empty frame.
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => setBoard(window.matchMedia(PHONE_QUERY).matches ? COMPACT : WIDE), []);

  return (
    <Window
      label={<Responsive desktop="try-it · grow a native yard" phone="try-it · native yard" />}
      tone="paper"
      size="lg"
      className="lp-planner lp-garden"
    >
      <div
        className="lp-garden__stage"
        style={{ aspectRatio: (board ?? WIDE).aspect }}
        role="group"
        aria-label="Nativo Garden, a game: swap lawn for native plants"
      >
        {board && <GardenCanvas artboard={board.artboard} />}
      </div>
    </Window>
  );
}
