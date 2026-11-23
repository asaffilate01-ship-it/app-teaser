import { createFileRoute, redirect } from "@tanstack/react-router";

// Short link: /pricing opens the pricing section of the home page.
export const Route = createFileRoute("/pricing")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: { section: "pricing" }, statusCode: 301 });
  },
});
