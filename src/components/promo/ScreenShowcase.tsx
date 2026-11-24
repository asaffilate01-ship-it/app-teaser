import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, Maximize2, Monitor, Smartphone, Tv } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type ScreenKind = "desktop" | "phone" | "tv";
export type ScreenCategory = "scoring" | "screens" | "analysis" | "league";

export interface ScreenShot {
  src: string;
  w: number;
  h: number;
  kind: ScreenKind;
  cat: ScreenCategory;
  /** Address shown in the browser bar (desktop) — where this screen lives in CricLume. */
  url?: string;
}

export interface ScreenText {
  label: string;
  caption: string;
}

const kindIcon = { desktop: Monitor, phone: Smartphone, tv: Tv } as const;

/** A screenshot dressed in a browser window, phone or big-screen frame. */
export function DeviceFrame({
  shot,
  alt,
  eager = false,
  className = "",
}: {
  shot: ScreenShot;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  const img = (
    <img
      src={shot.src}
      alt={alt}
      width={shot.w}
      height={shot.h}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className="block h-auto w-full"
    />
  );
  if (shot.kind === "phone") {
    return (
      <div className={`device-phone ${className}`}>
        <div className="device-phone-screen">
          <span className="device-phone-island" aria-hidden="true" />
          {img}
        </div>
      </div>
    );
  }
  if (shot.kind === "tv") {
    return (
      <div className={`device-tv ${className}`}>
        <div className="device-tv-screen">{img}</div>
        <span className="device-tv-stand" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className={`device-browser ${className}`}>
      <div className="device-browser-bar" aria-hidden="true">
        <span className="device-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="device-browser-url">
          <Lock className="size-3" />
          {shot.url ?? "criclume.com"}
        </span>
      </div>
      {img}
    </div>
  );
}

/** Hero: the desktop match centre with the phone scorer in front of it. */
export function HeroShowcase({
  desktop,
  phone,
  desktopAlt,
  phoneAlt,
  chips,
}: {
  desktop: ScreenShot;
  phone: ScreenShot;
  desktopAlt: string;
  phoneAlt: string;
  chips: readonly string[];
}) {
  return (
    <div className="showcase-stage relative px-2 pb-10 pt-6 sm:px-4 md:pb-14">
      <DeviceFrame shot={desktop} alt={desktopAlt} eager className="relative z-0 w-[90%]" />
      <DeviceFrame
        shot={phone}
        alt={phoneAlt}
        eager
        className="absolute bottom-0 right-0 z-10 w-[29%] max-w-[230px] sm:w-[26%]"
      />
      {chips[0] && (
        <span className="showcase-chip absolute left-0 top-1 z-20">
          <span className="live-dot" aria-hidden="true" /> {chips[0]}
        </span>
      )}
      {chips[1] && (
        <span className="showcase-chip absolute bottom-2 left-3 z-20 sm:left-6">{chips[1]}</span>
      )}
    </div>
  );
}

const displayOrder = [0, 1, 2, 5, 6, 3, 4, 7, 8, 9, 10];

/**
 * On phones and tablets phone shots sit two to a row; the last one of an odd run would leave a gap,
 * so it gets the full row (shot beside its caption). Desktop keeps three to a row.
 */
export function isLonePhone(
  order: readonly number[],
  shots: readonly ScreenShot[],
  at: number,
): boolean {
  let start = at;
  while (start > 0 && shots[order[start - 1]!]!.kind === "phone") start--;
  let end = at;
  while (end < order.length - 1 && shots[order[end + 1]!]!.kind === "phone") end++;
  const runLength = end - start + 1;
  return runLength % 2 === 1 && at === end;
}

/** Product tour: filter by area, framed screenshots, tap to enlarge. */
export function ScreensGallery({
  shots,
  items,
  filters,
  enlarge,
  close,
  cta,
}: {
  shots: readonly ScreenShot[];
  items: readonly ScreenText[];
  filters: Record<"all" | ScreenCategory, string>;
  enlarge: string;
  close: string;
  cta?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<"all" | ScreenCategory>("all");
  const [open, setOpen] = useState<number | null>(null);
  const order = useMemo(() => {
    const base = displayOrder.filter((i) => i < shots.length && i < items.length);
    const rest = shots.map((_, i) => i).filter((i) => !base.includes(i) && i < items.length);
    return [...base, ...rest].filter((i) => filter === "all" || shots[i]!.cat === filter);
  }, [filter, shots, items.length]);

  const step = useCallback(
    (delta: number) => {
      setOpen((current) => {
        if (current === null) return current;
        const at = order.indexOf(current);
        return order[(at + delta + order.length) % order.length] ?? current;
      });
    },
    [order],
  );
  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  const tabs = (["all", "scoring", "screens", "analysis", "league"] as const).filter(
    (id) => id === "all" || shots.some((s) => s.cat === id),
  );
  const current = open === null ? null : { shot: shots[open]!, text: items[open]! };

  return (
    <div className="space-y-5 md:space-y-7">
      <div
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar md:mx-0 md:flex-wrap md:px-0"
        role="group"
      >
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className="showcase-filter shrink-0"
          >
            {filters[id]}
            <span className="showcase-filter-count">
              {id === "all" ? shots.length : shots.filter((s) => s.cat === id).length}
            </span>
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-6">
        {order.map((i, at) => {
          const shot = shots[i]!;
          const text = items[i]!;
          const Icon = kindIcon[shot.kind];
          const wide = shot.kind !== "phone";
          const lone = !wide && isLonePhone(order, shots, at);
          return (
            <li
              key={i}
              className={
                wide
                  ? "col-span-2 lg:col-span-3"
                  : lone
                    ? "col-span-2 lg:col-span-2"
                    : "col-span-1 lg:col-span-2"
              }
            >
              <button
                type="button"
                onClick={() => setOpen(i)}
                className={`showcase-card group h-full w-full text-left ${lone ? "showcase-card-lone" : ""}`}
                aria-label={`${text.label} — ${enlarge}`}
              >
                <div
                  className={`showcase-card-stage ${wide ? "px-4 pt-5 md:px-7 md:pt-7" : "px-5 pt-5 md:px-8 md:pt-7"}`}
                >
                  <DeviceFrame
                    shot={shot}
                    alt={`${text.label} — ${text.caption}`}
                    className={wide ? "mx-auto w-full" : "mx-auto w-full max-w-[220px]"}
                  />
                  <span className="showcase-zoom" aria-hidden="true">
                    <Maximize2 className="size-4" />
                  </span>
                </div>
                <div className="space-y-1.5 p-3.5 md:p-5">
                  <p className="flex items-center gap-2 font-display text-base font-bold leading-tight text-foreground md:text-xl">
                    <Icon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                    {text.label}
                  </p>
                  <p
                    className={`text-xs leading-relaxed text-muted-foreground md:text-sm ${wide ? "" : "line-clamp-4 md:line-clamp-none"}`}
                  >
                    {text.caption}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
        {cta && filter === "all" && <li className="col-span-2 lg:col-span-2">{cta}</li>}
      </ul>

      <Dialog open={current !== null} onOpenChange={(value) => !value && setOpen(null)}>
        {current && (
          <DialogContent className="showcase-dialog max-h-[94vh] w-[96vw] max-w-6xl overflow-y-auto border-border bg-background p-4 md:p-6">
            <div className="showcase-card-stage rounded-2xl px-3 py-5 md:px-8 md:py-8">
              <DeviceFrame
                shot={current.shot}
                alt={`${current.text.label} — ${current.text.caption}`}
                eager
                className={
                  current.shot.kind === "phone"
                    ? "mx-auto w-full max-w-[340px]"
                    : "mx-auto w-full max-w-5xl"
                }
              />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <DialogTitle className="font-display text-xl font-bold text-gold md:text-2xl">
                  {current.text.label}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {current.text.caption}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="showcase-nav"
                  onClick={() => step(-1)}
                  aria-label="Previous screen"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  type="button"
                  className="showcase-nav"
                  onClick={() => step(1)}
                  aria-label="Next screen"
                >
                  <ArrowRight className="size-4" />
                </button>
                <button
                  type="button"
                  className="showcase-nav px-4 text-sm font-semibold"
                  onClick={() => setOpen(null)}
                >
                  {close}
                </button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
