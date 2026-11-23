import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";

/** Public "Join the club" form; requests land in the club office for an admin to accept. */
export function JoinClubForm({ slug, clubName }: { slug: string; clubName: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", interest: "player", junior: false, message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.website) return setState("sent"); // filled only by bots
    setError(null);
    setState("sending");
    const { error: failure } = await getCloudClient().rpc("submit_club_join_request", {
      p_slug: slug, p_name: form.name, p_email: form.email, p_phone: form.phone, p_interest: form.interest, p_junior: form.junior, p_message: form.message,
    });
    if (failure) {
      setState("idle");
      setError(failure.message.includes("already") ? "We already have your request — the club will be in touch." : "Your request couldn't be sent. Check your email address and try again.");
      return;
    }
    setState("sent");
  };
  if (state === "sent") {
    return (
      <section className="club-card" id="join" aria-live="polite">
        <h2 className="text-xl font-bold">Thanks — request sent</h2>
        <p className="mt-1 text-sm opacity-80">Someone from {clubName} will get back to you by email.</p>
      </section>
    );
  }
  const field = "mt-1 w-full rounded-xl border border-[var(--site-line)] bg-transparent px-3 py-2 text-sm";
  return (
    <section className="club-card" id="join">
      <h2 className="text-xl font-bold">Join {clubName}</h2>
      <p className="mt-1 text-sm opacity-80">Players, parents, coaches, umpires and volunteers welcome.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void submit(e)}>
        <label className="text-sm">Your name<input required minLength={2} maxLength={100} className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
        <label className="text-sm">Email<input required type="email" maxLength={200} className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
        <label className="text-sm">Phone (optional)<input maxLength={40} className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
        <label className="text-sm">I'd like to join as
          <select className={field} value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })}>
            <option value="player">A player</option>
            <option value="parent">A parent of a junior</option>
            <option value="coach">A coach</option>
            <option value="umpire">An umpire or scorer</option>
            <option value="volunteer">A volunteer</option>
            <option value="other">Something else</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.junior} onChange={(e) => setForm({ ...form, junior: e.target.checked })} /> This is for a child under 18 (a parent or guardian is filling this in)</label>
        <label className="text-sm sm:col-span-2">Anything else? (optional)<textarea maxLength={1000} className={`${field} min-h-20`} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Experience, age group, which team you're interested in" /></label>
        <label className="hidden" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
        {error && <p className="text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
        <div className="sm:col-span-2"><button className="club-button" disabled={state === "sending"}><Send /> {state === "sending" ? "Sending…" : "Send request"}</button></div>
        <p className="text-xs opacity-70 sm:col-span-2">Your details go only to the club's admins.</p>
      </form>
    </section>
  );
}
