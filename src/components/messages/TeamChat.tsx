import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, Megaphone, Send, Trash2 } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { can, type PlatformRole } from "@/lib/platform";
import type { PlatformDashboardData } from "@/lib/platform-cloud";
import { Empty, when } from "@/components/office/ui";

interface Message { id: string; team_id: string | null; author_id: string; author_name: string; body: string; is_announcement: boolean; created_at: string }
interface Read { message_id: string; user_id: string; reader_name: string; read_at: string }

/** Club and team channels: chat, announcements from coaches/managers, and who has read each message. */
export function TeamChat({ organisationId, role, club }: { organisationId: string; role: PlatformRole; club: PlatformDashboardData }) {
  const db = getCloudClient();
  const manager = can(role, "events.manage");
  const [channel, setChannel] = useState<string>("club");
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [reads, setReads] = useState<Read[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [openReads, setOpenReads] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const myName = club.members.find((m) => m.userId === me)?.displayName ?? "Club member";
  const channels = [{ id: "club", name: "Whole club" }, ...club.teams.filter((t) => !t.external).map((t) => ({ id: t.id, name: t.name }))];

  const load = useCallback(async () => {
    const { data: auth } = await db.auth.getUser();
    setMe(auth.user?.id ?? null);
    let query = db.from("team_messages").select("id,team_id,author_id,author_name,body,is_announcement,created_at").eq("organisation_id", organisationId);
    query = channel === "club" ? query.is("team_id", null) : query.eq("team_id", channel);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
    if (error) return setMessages([]);
    const rows = ((data ?? []) as Message[]).reverse();
    setMessages(rows);
    if (rows.length) {
      const r = await db.from("team_message_reads").select("message_id,user_id,reader_name,read_at").in("message_id", rows.map((m) => m.id));
      setReads((r.data ?? []) as Read[]);
    } else setReads([]);
  }, [channel, db, organisationId]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages?.length]);

  // Mark what's on screen as read.
  useEffect(() => {
    if (!me || !messages?.length) return undefined;
    const unread = messages.filter((m) => m.author_id !== me && !reads.some((r) => r.message_id === m.id && r.user_id === me));
    if (!unread.length) return undefined;
    void db.from("team_message_reads").upsert(unread.map((m) => ({ message_id: m.id, user_id: me, reader_name: myName })), { onConflict: "message_id,user_id", ignoreDuplicates: true });
    return undefined;
  }, [db, me, messages, myName, reads]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    const { error } = await db.from("team_messages").insert({ organisation_id: organisationId, team_id: channel === "club" ? null : channel, author_name: myName, body: text.slice(0, 2000), is_announcement: announce && manager });
    if (error) {
      toast.error("Your message could not be sent.");
      return;
    }
    setBody("");
    setAnnounce(false);
    await load();
  };
  const remove = async (id: string) => {
    const { error } = await db.from("team_messages").delete().eq("id", id);
    if (error) toast.error("Couldn't delete that message.");
    await load();
  };
  const members = club.members.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-4">
      <div>
        <p className="panel-kicker">Messages</p>
        <h2 className="text-2xl font-bold tracking-tight">Team chat &amp; announcements</h2>
        <p className="office-meta">Announcements stay pinned at the top. The sender and managers can see who has read each message.</p>
      </div>
      <div className="office-tabs" role="tablist" aria-label="Channel">
        {channels.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={channel === c.id} className="office-tab" onClick={() => setChannel(c.id)}>{c.name}</button>
        ))}
      </div>
      {messages?.filter((m) => m.is_announcement).slice(-3).map((m) => (
        <div key={`pin-${m.id}`} className="office-card flex gap-3">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
          <div><p className="text-sm font-semibold whitespace-pre-wrap">{m.body}</p><p className="office-meta">{m.author_name} · {when(m.created_at)}</p></div>
        </div>
      ))}
      <div className="office-card max-h-[60vh] space-y-2 overflow-y-auto" aria-live="polite">
        {messages === null && <p className="office-meta">Loading…</p>}
        {messages?.length === 0 && <Empty>No messages yet. Say hello.</Empty>}
        {messages?.map((m) => {
          const mine = m.author_id === me;
          const readers = reads.filter((r) => r.message_id === m.id && r.user_id !== m.author_id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl border px-3 py-2 ${mine ? "border-gold/40 bg-gold/10" : "border-border bg-card"}`}>
                {!mine && <p className="text-[11px] font-bold text-gold">{m.author_name}</p>}
                <p className="whitespace-pre-wrap text-sm">{m.is_announcement && <Megaphone className="mr-1 inline size-3.5" />}{m.body}</p>
                <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                  <span>{when(m.created_at)}</span>
                  {(mine || manager) && (
                    <button type="button" className="inline-flex items-center gap-0.5" onClick={() => setOpenReads(openReads === m.id ? null : m.id)} aria-expanded={openReads === m.id}>
                      <CheckCheck className="size-3" /> Read by {readers.length}{members > 1 ? ` of ${members - 1}` : ""}
                    </button>
                  )}
                  {(mine || manager) && <button type="button" aria-label="Delete message" onClick={() => void remove(m.id)}><Trash2 className="size-3" /></button>}
                </div>
                {openReads === m.id && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{readers.length ? readers.map((r) => r.reader_name).join(", ") : "Nobody yet"}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="office-card flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea className="scorer-input min-h-12 flex-1" maxLength={2000} placeholder="Write a message" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        {manager && (
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} /> Announcement</label>
        )}
        <button className="action-primary"><Send className="size-4" /> Send</button>
      </form>
    </div>
  );
}
