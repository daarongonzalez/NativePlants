import { data } from "react-router";

/** Any address we do not know. Throws so the root error page shows, with a real 404 status. */
export function loader() {
  throw data(null, { status: 404 });
}

export default function NotFound() {
  return null;
}
