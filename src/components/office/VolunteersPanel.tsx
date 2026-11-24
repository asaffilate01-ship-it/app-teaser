import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HandHeart, LoaderCircle, Plus, X } from "lucide-react";
import { can } from "@/lib/platform";
import { getCloudClient } from "@/lib/cloud";
import {
  Empty,
  OfficeCard,
  OfficeField,
  Pill,
  fromLocal,
  nameOfMember,
  upcoming,
  when,
  type OfficeProps,
} from "./ui";

interface Job {
  id: string;
  title: string;
  starts_at: string;
  places: number;
  notes: string | null;
  cancelled_at: string | null;
}
interface Signup {
  id: string;
  job_id: string;
  user_id: string;
}

/** Teas, scoring, umpiring, bar, ground prep: managers post jobs, members put their name down. */
export function VolunteersPanel({ organisationId, role, club, act }: OfficeProps) {
  const manager = can(role, "events.manage");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const load = useCallback(async () => {
    const client = getCloudClient();
    const [{ data: user }, jobsResult, signupResult] = await Promise.all([
      client.auth.getUser(),
      client
        .from("club_volunteer_jobs")
        .select("id,title,starts_at,places,notes,cancelled_at")
        .eq("organisation_id", organisationId)
        .order("starts_at"),
      client
        .from("club_volunteer_signups")
        .select("id,job_id,user_id")
        .eq("organisation_id", organisationId),
    ]);
    setMe(user.user?.id ?? null);
    setJobs((jobsResult.data ?? []) as Job[]);
    setSignups((signupResult.data ?? []) as Signup[]);
  }, [organisationId]);
  useEffect(() => void load(), [load]);

  const run = async (action: () => Promise<void>, done: string) => {
    await act(action, done);
    await load();
  };
  const must = async <T,>(
    request: PromiseLike<{ error: { message: string } | null; data?: T }>,
  ) => {
    const { error } = await request;
    if (error) throw new Error(error.message);
  };

  if (!jobs) {
    return (
      <p className="office-meta flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading volunteer jobs…
      </p>
    );
  }
  const open = upcoming(jobs);
  return (
    <div className="space-y-4">
      {manager && (
        <NewJob
          onAdd={(job) =>
            run(
              () =>
                must(
                  getCloudClient()
                    .from("club_volunteer_jobs")
                    .insert({ ...job, organisation_id: organisationId }),
                ),
              "Job posted — members can now sign up",
            )
          }
        />
      )}
      {open.length === 0 && (
        <Empty>
          No volunteer jobs coming up.
          {manager ? " Post one above — teas, scoring, bar, ground prep." : ""}
        </Empty>
      )}
      {open.map((job) => {
        const names = signups.filter((item) => item.job_id === job.id);
        const mine = names.find((item) => item.user_id === me);
        const full = names.length >= job.places;
        return (
          <OfficeCard
            key={job.id}
            title={job.title}
            description={when(job.starts_at)}
            action={
              <Pill tone={full ? "good" : "warn"}>
                {names.length}/{job.places} filled
              </Pill>
            }
          >
            {job.notes && <p className="office-meta mb-3">{job.notes}</p>}
            {names.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {names.map((item) => (
                  <li key={item.id} className="office-pill">
                    {item.user_id === me ? "You" : nameOfMember(club, item.user_id)}
                    {manager && item.user_id !== me && (
                      <button
                        type="button"
                        aria-label="Remove"
                        className="ml-1"
                        onClick={() =>
                          void run(
                            () =>
                              must(
                                getCloudClient()
                                  .from("club_volunteer_signups")
                                  .delete()
                                  .eq("id", item.id),
                              ),
                            "Removed from the job",
                          )
                        }
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {mine ? (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() =>
                    void run(
                      () =>
                        must(
                          getCloudClient()
                            .from("club_volunteer_signups")
                            .delete()
                            .eq("id", mine.id),
                        ),
                      "You're off this job",
                    )
                  }
                >
                  Can't make it now
                </button>
              ) : (
                <button
                  type="button"
                  className="action-primary"
                  disabled={full}
                  onClick={() =>
                    void run(
                      () => must(getCloudClient().rpc("volunteer_sign_up", { p_job_id: job.id })),
                      "Thanks — you're down for it",
                    )
                  }
                >
                  <HandHeart className="size-4" /> {full ? "All places taken" : "I'll help"}
                </button>
              )}
              {manager && (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() =>
                    void run(
                      () =>
                        must(
                          getCloudClient()
                            .from("club_volunteer_jobs")
                            .update({ cancelled_at: new Date().toISOString() })
                            .eq("id", job.id),
                        ),
                      "Job cancelled",
                    )
                  }
                >
                  Cancel job
                </button>
              )}
            </div>
          </OfficeCard>
        );
      })}
    </div>
  );
}

function NewJob({
  onAdd,
}: {
  onAdd: (job: {
    title: string;
    starts_at: string;
    places: number;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [places, setPlaces] = useState(2);
  const [notes, setNotes] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const start = fromLocal(startsAt);
    if (!start || title.trim().length < 2) return;
    await onAdd({ title: title.trim(), starts_at: start, places, notes: notes.trim() || null });
    setTitle("");
    setNotes("");
  };
  return (
    <OfficeCard
      title="Post a volunteer job"
      description="Members see it here and put their name down. You see who's coming."
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <OfficeField label="Job" className="lg:col-span-2">
          <input
            required
            minLength={2}
            maxLength={80}
            className="scorer-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Teas for Saturday's 1st XI"
          />
        </OfficeField>
        <OfficeField label="When">
          <input
            required
            type="datetime-local"
            className="scorer-input"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </OfficeField>
        <OfficeField label="People needed">
          <input
            type="number"
            min={1}
            max={50}
            className="scorer-input"
            value={places}
            onChange={(event) =>
              setPlaces(Math.max(1, Math.min(50, Number(event.target.value) || 1)))
            }
          />
        </OfficeField>
        <OfficeField label="Notes (optional)" className="sm:col-span-2 lg:col-span-3">
          <input
            maxLength={500}
            className="scorer-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Bring a cake; urn is in the kitchen"
          />
        </OfficeField>
        <div className="flex items-end">
          <button className="action-primary w-full">
            <Plus className="size-4" /> Post job
          </button>
        </div>
      </form>
    </OfficeCard>
  );
}
