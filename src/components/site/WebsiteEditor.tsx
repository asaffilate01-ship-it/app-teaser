import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, ExternalLink, Globe, ImagePlus, LoaderCircle, Newspaper, Pin, Plus, Settings2, Trash2, Upload } from "lucide-react";
import type { PlatformRole } from "@/lib/platform";
import {
  accentLabels,
  isValidWebSlug,
  postKindLabels,
  readAccent,
  readSocials,
  readSponsors,
  safeLink,
  siteAccents,
  socialKeys,
  socialLabels,
  suggestWebSlug,
  type PostKind,
  type SiteAccent,
  type Sponsor,
} from "@/lib/club-site";
import { canEditSite, checkSiteFile, loadSiteEditor, siteCloud, uploadSiteFile, type SiteEditorData, type SitePostRow } from "@/lib/club-site-cloud";
import { friendly } from "@/lib/club-office-cloud";
import { Empty, OfficeCard, OfficeField, Pill, day } from "@/components/office/ui";

const tabs = [
  ["settings", "Website", Settings2],
  ["posts", "News and documents", Newspaper],
  ["photos", "Photos", ImagePlus],
] as const;
type Tab = (typeof tabs)[number][0];

/** Club or league website editor: settings, news/notices/documents and photo gallery. Database rules decide who may change it. */
export function WebsiteEditor({ organisationId, organisationName, role }: { organisationId: string; organisationName: string; role: PlatformRole }) {
  const [tab, setTab] = useState<Tab>("settings");
  const [data, setData] = useState<SiteEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editor = canEditSite(role);
  const reload = useCallback(async () => {
    try {
      setData(await loadSiteEditor(organisationId));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The website settings could not load.");
    }
  }, [organisationId]);
  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  const act = useCallback(
    async (action: () => Promise<void>, done?: string) => {
      try {
        await action();
        if (done) toast.success(done);
        await reload();
        return true;
      } catch (reason) {
        toast.error(reason instanceof Error ? friendly(reason.message) : "That didn't work.");
        return false;
      }
    },
    [reload],
  );

  const address = data ? (data.site?.web_slug ?? data.orgSlug) : "";
  const published = Boolean(data?.site?.published);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="panel-kicker">Public website</p>
          <h2 className="text-2xl font-bold tracking-tight">Your club website</h2>
          <p className="office-meta">
            Live scores, fixtures, results, league tables, news, documents and photos on one page anyone can visit. Player names are never shown.
          </p>
        </div>
        {data && address && (
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={published ? "good" : "warn"}>{published ? "Published" : "Not published"}</Pill>
            <Link to="/club/$slug" params={{ slug: address }} target="_blank" className="action-secondary">
              <ExternalLink className="size-4" aria-hidden="true" /> View site
            </Link>
            <button
              type="button"
              className="action-secondary"
              onClick={() => {
                const link = `${window.location.origin}/club/${address}`;
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast.success("Website link copied"))
                  .catch(() => window.prompt("Copy the website link", link));
              }}
            >
              <Copy className="size-4" aria-hidden="true" /> Copy link
            </button>
          </div>
        )}
      </div>
      {!editor && (
        <p className="office-meta rounded-xl border border-border p-3">Only the club owner and admins can change the website. You can see what's planned.</p>
      )}
      <div className="office-tabs" role="tablist" aria-label="Website">
        {tabs.map(([value, label, Icon]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className="office-tab" onClick={() => setTab(value)}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {error && !data && (
        <div className="office-card">
          <p className="office-meta">{error}</p>
          <button type="button" className="action-secondary mt-3" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="office-card flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Loading the website…
        </div>
      )}
      {data && tab === "settings" && (
        <SettingsPanel key={data.site?.updated_at ?? "new"} data={data} organisationId={organisationId} organisationName={organisationName} editor={editor} act={act} />
      )}
      {data && tab === "posts" && <PostsPanel data={data} organisationId={organisationId} editor={editor} act={act} />}
      {data && tab === "photos" && <PhotosPanel data={data} organisationId={organisationId} editor={editor} act={act} />}
    </div>
  );
}

type Act = (action: () => Promise<void>, done?: string) => Promise<boolean>;

function SettingsPanel({
  data,
  organisationId,
  organisationName,
  editor,
  act,
}: {
  data: SiteEditorData;
  organisationId: string;
  organisationName: string;
  editor: boolean;
  act: Act;
}) {
  const site = data.site;
  const [published, setPublished] = useState(site?.published ?? false);
  const [slug, setSlug] = useState(site?.web_slug ?? suggestWebSlug(organisationName));
  const [tagline, setTagline] = useState(site?.tagline ?? "");
  const [about, setAbout] = useState(site?.about ?? "");
  const [accent, setAccent] = useState<SiteAccent>(readAccent(site?.accent));
  const [email, setEmail] = useState(site?.contact_email ?? "");
  const [phone, setPhone] = useState(site?.contact_phone ?? "");
  const [address, setAddress] = useState(site?.address ?? "");
  const [mapUrl, setMapUrl] = useState(site?.map_url ?? "");
  const [socials, setSocials] = useState<Record<string, string>>(() => ({ ...readSocials(site?.socials) }));
  const [sponsors, setSponsors] = useState<Sponsor[]>(() => readSponsors(site?.sponsors));
  const [heroPath, setHeroPath] = useState<string | null>(site?.hero_path ?? null);
  const [heroPreview, setHeroPreview] = useState<string | null>(site?.hero_path ? (data.files[site.hero_path] ?? null) : null);
  const [busy, setBusy] = useState(false);

  const slugOk = isValidWebSlug(slug);
  const badLinks = [...Object.values(socials), mapUrl, ...sponsors.map((s) => s.url ?? "")].filter((value) => value.trim() && !safeLink(value));

  const save = async () => {
    if (!slugOk) { toast.error("The web address needs 3–40 lowercase letters, numbers or dashes."); return; }
    if (badLinks.length) { toast.error("Links must start with https://"); return; }
    setBusy(true);
    await act(
      () =>
        siteCloud.save(organisationId, {
          published,
          web_slug: slug,
          tagline: tagline.trim(),
          about: about.trim(),
          accent,
          contact_email: email.trim() || null,
          contact_phone: phone.trim() || null,
          address: address.trim() || null,
          map_url: mapUrl.trim() || null,
          socials: Object.fromEntries(Object.entries(socials).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
          sponsors: sponsors.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), url: s.url?.trim() || null })),
          hero_path: heroPath,
        }).catch((reason: unknown) => {
          if (reason instanceof Error && /web_slug|duplicate/i.test(reason.message)) throw new Error("Another club already uses that web address.");
          throw reason;
        }),
      published ? "Website saved and published" : "Website saved",
    );
    setBusy(false);
  };

  const pickHero = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkSiteFile(file, true);
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const path = await uploadSiteFile(organisationId, "hero", file);
      setHeroPath(path);
      setHeroPreview(URL.createObjectURL(file));
      toast.success("Cover photo added — save to use it");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "The photo could not upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset disabled={!editor || busy} className="grid gap-4 lg:grid-cols-2">
      <OfficeCard title="Publishing" description="Visitors only see the site once it's published.">
        <label className="site-check">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span>
            <strong>Publish the website</strong>
            <small className="block office-meta">Shows public matches, fixtures, results, signed-off league tables, published posts and photos.</small>
          </span>
        </label>
        <OfficeField label="Web address" className="mt-3">
          <div className="flex items-center gap-1">
            <span className="office-meta whitespace-nowrap">/club/</span>
            <input className="scorer-input" value={slug} maxLength={40} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
          </div>
          {!slugOk && <span className="office-meta">3–40 lowercase letters, numbers or dashes.</span>}
        </OfficeField>
        <OfficeField label="Colour" className="mt-3">
          <div className="site-swatches" role="radiogroup" aria-label="Website colour">
            {siteAccents.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={accent === value}
                className="site-swatch"
                data-accent={value}
                onClick={() => setAccent(value)}
              >
                <i aria-hidden="true" /> {accentLabels[value]}
              </button>
            ))}
          </div>
        </OfficeField>
      </OfficeCard>

      <OfficeCard title="Cover photo" description="A wide photo of your ground or team. Only use photos everyone shown has agreed to.">
        {heroPreview ? <img src={heroPreview} alt="Cover" className="aspect-[16/7] w-full rounded-xl object-cover" /> : <Empty>No cover photo — your colour is used instead.</Empty>}
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="action-secondary cursor-pointer">
            <Upload className="size-4" aria-hidden="true" /> {heroPath ? "Replace photo" : "Add photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pickHero(e.target.files?.[0])} />
          </label>
          {heroPath && (
            <button type="button" className="action-secondary" onClick={() => (setHeroPath(null), setHeroPreview(null))}>
              Remove
            </button>
          )}
        </div>
      </OfficeCard>

      <OfficeCard title="About">
        <OfficeField label="Tagline (one line)">
          <input className="scorer-input" maxLength={140} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Friendly club cricket since 1952 — all ages welcome" />
        </OfficeField>
        <OfficeField label="About the club" className="mt-3">
          <textarea className="scorer-input min-h-36" maxLength={5000} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Training nights, teams, history and how to join." />
        </OfficeField>
      </OfficeCard>

      <OfficeCard title="Contact and location">
        <div className="grid gap-3 sm:grid-cols-2">
          <OfficeField label="Email">
            <input type="email" className="scorer-input" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          </OfficeField>
          <OfficeField label="Phone">
            <input type="tel" className="scorer-input" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </OfficeField>
          <OfficeField label="Ground address" className="sm:col-span-2">
            <input className="scorer-input" maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
          </OfficeField>
          <OfficeField label="Map link (https://…)" className="sm:col-span-2">
            <input className="scorer-input" maxLength={500} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.google.com/…" />
          </OfficeField>
        </div>
      </OfficeCard>

      <OfficeCard title="Social links">
        <div className="grid gap-3 sm:grid-cols-2">
          {socialKeys.map((key) => (
            <OfficeField key={key} label={socialLabels[key]}>
              <input className="scorer-input" maxLength={500} value={socials[key] ?? ""} onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))} placeholder="https://" />
            </OfficeField>
          ))}
        </div>
      </OfficeCard>

      <OfficeCard
        title="Sponsors"
        description="Shown along the bottom of your home page."
        action={
          <button type="button" className="action-secondary" disabled={sponsors.length >= 24} onClick={() => setSponsors((s) => [...s, { name: "", url: null }])}>
            <Plus className="size-4" aria-hidden="true" /> Add
          </button>
        }
      >
        {sponsors.length === 0 && <Empty>No sponsors yet.</Empty>}
        <ul className="grid gap-2">
          {sponsors.map((sponsor, index) => (
            <li key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input aria-label="Sponsor name" className="scorer-input" maxLength={80} value={sponsor.name} onChange={(e) => setSponsors((s) => s.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))} placeholder="Name" />
              <input aria-label="Sponsor link" className="scorer-input" maxLength={500} value={sponsor.url ?? ""} onChange={(e) => setSponsors((s) => s.map((x, i) => (i === index ? { ...x, url: e.target.value } : x)))} placeholder="https:// (optional)" />
              <button type="button" className="action-secondary" aria-label={`Remove ${sponsor.name || "sponsor"}`} onClick={() => setSponsors((s) => s.filter((_, i) => i !== index))}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </OfficeCard>

      {editor && (
        <div className="site-savebar lg:col-span-2">
          <p className="office-meta">{badLinks.length ? "Links must start with https://" : published ? "Changes go live as soon as you save." : "Save now and publish when you're ready."}</p>
          <button type="button" className="action-primary" onClick={() => void save()}>
            <Globe className="size-4" aria-hidden="true" /> {busy ? "Saving…" : "Save website"}
          </button>
        </div>
      )}
    </fieldset>
  );
}

function PostsPanel({ data, organisationId, editor, act }: { data: SiteEditorData; organisationId: string; editor: boolean; act: Act }) {
  const [kind, setKind] = useState<PostKind>("news");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [publishNow, setPublishNow] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error("Add a title."); return; }
    if (link.trim() && !safeLink(link)) { toast.error("Links must start with https://"); return; }
    if (kind === "document" && !file && !link.trim()) { toast.error("Attach a PDF or add a link for the document."); return; }
    if (file) {
      const problem = checkSiteFile(file);
      if (problem) { toast.error(problem); return; }
    }
    setBusy(true);
    const ok = await act(async () => {
      const filePath = file ? await uploadSiteFile(organisationId, kind === "document" ? "docs" : "photos", file) : null;
      await siteCloud.addPost({
        organisation_id: organisationId,
        kind,
        title: title.trim(),
        body: body.trim(),
        file_path: filePath,
        link_url: link.trim() || null,
        published_at: publishNow ? new Date().toISOString() : null,
      });
    }, publishNow ? "Posted to the website" : "Saved as a draft");
    setBusy(false);
    if (ok) {
      setTitle("");
      setBody("");
      setLink("");
      setFile(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {editor && (
        <OfficeCard title="New post" description="News, notices (training changes, AGM) or documents (fixtures list, code of conduct, safeguarding policy).">
          <fieldset disabled={busy} className="grid gap-3">
            <div className="office-tabs" role="radiogroup" aria-label="Type">
              {(["news", "notice", "document"] as const).map((value) => (
                <button key={value} type="button" role="radio" aria-checked={kind === value} aria-selected={kind === value} className="office-tab" onClick={() => setKind(value)}>
                  {postKindLabels[value]}
                </button>
              ))}
            </div>
            <OfficeField label="Title">
              <input className="scorer-input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
            </OfficeField>
            <OfficeField label="Text">
              <textarea className="scorer-input min-h-32" maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} />
            </OfficeField>
            <OfficeField label={kind === "document" ? "PDF or photo" : "Photo (optional)"}>
              <input
                key={data.posts.length}
                type="file"
                accept={kind === "document" ? "application/pdf,image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp"}
                className="scorer-input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </OfficeField>
            <OfficeField label="Link (optional, https://…)">
              <input className="scorer-input" maxLength={500} value={link} onChange={(e) => setLink(e.target.value)} />
            </OfficeField>
            <label className="site-check">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
              <span>Publish now (untick to save a draft)</span>
            </label>
            <button type="button" className="action-primary" onClick={() => void submit()}>
              {busy ? "Saving…" : publishNow ? "Publish post" : "Save draft"}
            </button>
          </fieldset>
        </OfficeCard>
      )}
      <OfficeCard title="Posts" description={`${data.posts.length} post${data.posts.length === 1 ? "" : "s"}`}>
        {data.posts.length === 0 ? (
          <Empty>No posts yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {data.posts.map((post) => (
              <PostRow key={post.id} post={post} editor={editor} act={act} />
            ))}
          </ul>
        )}
      </OfficeCard>
    </div>
  );
}

function PostRow({ post, editor, act }: { post: SitePostRow; editor: boolean; act: Act }) {
  const live = Boolean(post.published_at && Date.parse(post.published_at) <= Date.now());
  return (
    <li className="office-row">
      <div className="min-w-0">
        <p className="font-bold">
          {post.pinned && <Pin className="mr-1 inline size-3.5" aria-label="Pinned" />}
          {post.title}
        </p>
        <p className="office-meta">
          {postKindLabels[post.kind as PostKind] ?? post.kind} · {live ? `Published ${day(post.published_at)}` : "Draft"}
          {post.file_path ? " · file attached" : ""}
        </p>
      </div>
      {editor && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="action-secondary"
            onClick={() => void act(() => siteCloud.updatePost(post.id, { published_at: live ? null : new Date().toISOString() }), live ? "Moved back to drafts" : "Published")}
          >
            {live ? "Unpublish" : "Publish"}
          </button>
          <button type="button" className="action-secondary" aria-pressed={post.pinned} onClick={() => void act(() => siteCloud.updatePost(post.id, { pinned: !post.pinned }))}>
            {post.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            className="action-secondary"
            aria-label={`Delete ${post.title}`}
            onClick={() => {
              if (window.confirm(`Delete “${post.title}”?`)) void act(() => siteCloud.deletePost(post), "Post deleted");
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </li>
  );
}

function PhotosPanel({ data, organisationId, editor, act }: { data: SiteEditorData; organisationId: string; editor: boolean; act: Act }) {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const upload = async () => {
    if (!consent) { toast.error("Please confirm everyone shown has agreed."); return; }
    for (const file of files) {
      const problem = checkSiteFile(file, true);
      if (problem) { toast.error(`${file.name}: ${problem}`); return; }
    }
    setBusy(true);
    const ok = await act(async () => {
      for (const file of files) await siteCloud.addPhoto(organisationId, file, caption.trim());
    }, files.length === 1 ? "Photo added" : `${files.length} photos added`);
    setBusy(false);
    if (ok) {
      setFiles([]);
      setCaption("");
      setConsent(false);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      {editor && (
        <OfficeCard title="Add photos" description="JPG, PNG or WebP, up to 10 MB each.">
          <fieldset disabled={busy} className="grid gap-3">
            <input key={data.photos.length} type="file" multiple accept="image/jpeg,image/png,image/webp" className="scorer-input" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 20))} />
            <OfficeField label="Caption (optional)">
              <input className="scorer-input" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </OfficeField>
            <label className="site-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Everyone shown has agreed to be on our public website. For under-18s, a parent or guardian has agreed.
              </span>
            </label>
            <button type="button" className="action-primary" disabled={files.length === 0 || !consent} onClick={() => void upload()}>
              <Upload className="size-4" aria-hidden="true" /> {busy ? "Uploading…" : files.length > 1 ? `Upload ${files.length} photos` : "Upload photo"}
            </button>
          </fieldset>
        </OfficeCard>
      )}
      <OfficeCard title="Gallery" description={`${data.photos.length} photo${data.photos.length === 1 ? "" : "s"}`}>
        {data.photos.length === 0 ? (
          <Empty>No photos yet.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.photos.map((photo) => (
              <li key={photo.id} className="relative overflow-hidden rounded-xl border border-border">
                {data.files[photo.path] ? (
                  <img src={data.files[photo.path]} alt={photo.caption} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-[4/3] w-full" />
                )}
                {editor && (
                  <button
                    type="button"
                    className="site-photo-delete"
                    aria-label="Delete photo"
                    onClick={() => {
                      if (window.confirm("Delete this photo from the website?")) void act(() => siteCloud.deletePhoto(photo), "Photo deleted");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                {photo.caption && <p className="office-meta truncate px-2 py-1">{photo.caption}</p>}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>
    </div>
  );
}
