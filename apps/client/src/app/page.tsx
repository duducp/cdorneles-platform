import { redirect } from "next/navigation";

import { PORTAL_PREFIX } from "@cdorneles/app";

/** The portal is the signed-in surface; the root just hands visitors over. */
export default function Home() {
  redirect(PORTAL_PREFIX);
}
