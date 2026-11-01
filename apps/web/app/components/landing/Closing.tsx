import grass from "../../../../../design/nativo/assets/Grass/grass-07-cream.svg?url";
import { AddressConfirmation, AddressForm, type AddressState } from "./AddressForm";

export function Closing({ address }: { address: AddressState }) {
  return (
    <div className="lp-band lp-band--green lp-closing-band">
      <section className="lp-wrap lp-closing" aria-labelledby="closing-title">
        <img src={grass} alt="" className="lp-closing__grass" />
        <h2 id="closing-title" className="lp-h2-closing">Trade grass for what belongs</h2>
        <p className="lp-body-lg">Salt Lake, Utah, Davis and Weber counties, for now.</p>
        <AddressForm state={address} tone="gold" placeholder="Your street address" />
        <AddressConfirmation state={address} full={false} />
        <footer className="lp-footer">
          <span className="lp-wordmark lp-wordmark--footer">nativo</span>
          <span>Advice, not a guarantee. Check toxicity warnings near pets or children.</span>
          <span className="lp-footer__links">
            <a href="#privacy">Privacy</a>
            <a href="#sources">Sources</a>
          </span>
        </footer>
      </section>
    </div>
  );
}
