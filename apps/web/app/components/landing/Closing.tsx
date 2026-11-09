import grass from "../../../../../design/nativo/assets/Grass/grass-07-cream.svg?url";
import { FooterLinks } from "../site/SiteFooter";
import { AddressForm, type AddressState } from "./AddressForm";

export function Closing({ address }: { address: AddressState }) {
  return (
    <div className="lp-band lp-band--green lp-closing-band">
      <section className="lp-wrap lp-closing" aria-labelledby="closing-title">
        <img src={grass} alt="" className="lp-closing__grass" />
        <h2 id="closing-title" className="lp-h2-closing">Trade grass for what belongs</h2>
        <p className="lp-body-lg">Now serving Salt Lake, Utah, Davis and Weber counties. More regions to come.</p>
        <AddressForm state={address} tone="gold" placeholder="Your street address" />
        <footer className="lp-footer">
          <span className="lp-wordmark lp-wordmark--footer">nativo</span>
          <span>Advice, not a guarantee. Check toxicity warnings near pets or children.</span>
          <FooterLinks className="lp-footer__links" />
        </footer>
      </section>
    </div>
  );
}
