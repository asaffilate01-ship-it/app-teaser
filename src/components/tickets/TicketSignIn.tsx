import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GoogleButton } from "@/components/app-shell/GoogleButton";

/** Free account sign-in for fans buying tickets; comes back to the same page. */
export function TicketSignIn({ requestLink }: { requestLink: (email: string, redirectTo?: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const back = () => `${window.location.origin}${window.location.pathname}`;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLink(email.trim(), back());
      setSent(true);
    } catch {
      toast.error("We couldn't send the link. Check the email and try again.");
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: back() });
    if (result.error) toast.error("Google sign-in didn't finish. Please try again.");
  };
  return (
    <section className="club-card ticket-signin" aria-label="Sign in to buy tickets">
      <h2 className="text-xl font-bold">Sign in to buy tickets</h2>
      <p className="mt-1 text-sm opacity-80">A free CricLume account keeps your tickets safe on your phone. No card needed — you pay the club by bank or wallet transfer.</p>
      <div className="mt-3 grid gap-3">
        <GoogleButton onClick={() => void google()} />
        <form onSubmit={(event) => void submit(event)} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            aria-label="Email"
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-xl border border-[var(--site-line)] bg-transparent px-3 py-2 text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="club-button club-button-sm" disabled={busy}>
            {sent ? "Link sent — check your inbox" : "Email me a link"}
          </button>
        </form>
      </div>
    </section>
  );
}
