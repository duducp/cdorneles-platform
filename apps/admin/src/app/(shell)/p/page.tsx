import { redirect } from "next/navigation";

import { PORTAL_PREFIX } from "@cdorneles/app";

/** The portal root hands visitors to the app's entry group. */
export default function PortalHome() {
  redirect(`${PORTAL_PREFIX}/admin`);
}
