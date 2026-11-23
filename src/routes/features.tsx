import { createFileRoute, redirect } from "@tanstack/react-router";

// Short link: /features opens the features section of the home page.
export const Route = createFileRoute("/features")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: { section: "features" }, statusCode: 301 });
  },
});
