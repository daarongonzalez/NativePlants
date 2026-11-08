import { Form, useNavigation } from "react-router";

export type AddressState = {
  addr: string;
  setAddr: (value: string) => void;
};

/**
 * The address pill. Appears twice on the page with shared state, and starts
 * the flow: it opens the address check at /start.
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
  const navigation = useNavigation();
  const looking = navigation.state !== "idle" && navigation.location?.pathname === "/start";
  return (
    <Form method="get" action="/start" className={`lp-address lp-address--${tone}`}>
      <input
        className="lp-address__input"
        name="address"
        value={state.addr}
        onChange={(e) => state.setAddr(e.target.value)}
        placeholder={placeholder}
        aria-label="Street address"
        autoComplete="street-address"
        required
        minLength={5}
      />
      <button type="submit" className={`lp-button lp-button--${tone} lp-address__button`} disabled={looking}>
        {looking ? "Looking it up…" : "Check my ground"}
      </button>
    </Form>
  );
}
