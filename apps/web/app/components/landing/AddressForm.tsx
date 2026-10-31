import type { FormEvent } from "react";
import { Responsive } from "./primitives";

export type AddressState = {
  addr: string;
  submitted: boolean;
  setAddr: (value: string) => void;
  submit: () => void;
};

/**
 * The address pill. Appears twice on the page with shared state. On submit
 * it will move on to the Address Confirm (pin) step; until that page exists
 * it confirms the address in place.
 */
export function AddressForm({
  state,
  placeholder,
  tone,
}: {
  state: AddressState;
  placeholder: string;
  tone: "green" | "gold";
}) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    state.submit();
  };
  return (
    <form className={`lp-address lp-address--${tone}`} onSubmit={onSubmit}>
      <input
        className="lp-address__input"
        value={state.addr}
        onChange={(e) => state.setAddr(e.target.value)}
        placeholder={placeholder}
        aria-label="Street address"
        autoComplete="street-address"
      />
      <button type="submit" className={`lp-button lp-button--${tone} lp-address__button`}>
        Check my ground
      </button>
    </form>
  );
}

export function AddressConfirmation({ state, full }: { state: AddressState; full: boolean }) {
  if (!state.submitted) return null;
  const place = state.addr.trim() || "your address";
  return (
    <p className="lp-address__done" role="status">
      Off we go to {place}!
      {full && <Responsive desktop=" Next you'll pop a pin on your yard." phone="" />}
    </p>
  );
}
