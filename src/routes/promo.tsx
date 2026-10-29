import { createFileRoute, redirect } from "@tanstack/react-router";

// Keep a single public homepage for shared promotional links.
export const Route = createFileRoute("/promo")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
