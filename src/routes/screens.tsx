import { createFileRoute, redirect } from "@tanstack/react-router";

// Short link: /screens opens the screens section of the home page.
export const Route = createFileRoute("/screens")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: { section: "screens" }, statusCode: 301 });
  },
});
