import { createFileRoute, redirect } from "@tanstack/react-router";

// Short link: /faq opens the faq section of the home page.
export const Route = createFileRoute("/faq")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: { section: "faq" }, statusCode: 301 });
  },
});
