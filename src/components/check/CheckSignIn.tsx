import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { GoogleButton } from "@/components/app-shell/GoogleButton";

/** Sign-in card for the check scorer pages; returns to the page the person opened. */
export function CheckSignIn({ requestLink }: { requestLink: (email: string, redirectTo?: string) => Promise<void> }) {
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
    <section className="office-card mx-auto max-w-md space-y-4">
      <span className="icon-tile flex size-11 items-center justify-center">
        <ClipboardCheck className="size-5 text-gold" />
      </span>
      <h1 className="font-display text-2xl font-bold">Check scoring</h1>
      <p className="office-meta">
        Sign in with the email your club uses for CricLume. As a check scorer you follow every ball of the match,
        query anything that looks wrong and confirm the scorecard — you can't add or change balls.
      </p>
      <GoogleButton onClick={() => void google()} />
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <label className="block">
          <span className="office-label">Email</span>
          <input type="email" required className="scorer-input" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button type="submit" className="action-primary w-full" disabled={busy}>
          {sent ? "Link sent — check your inbox" : "Email me a sign-in link"}
        </button>
      </form>
    </section>
  );
}
