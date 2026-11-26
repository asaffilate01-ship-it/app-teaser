import { Component, Suspense, lazy, type ReactNode } from "react";
import type { CricketMatch } from "@/lib/cricket";

const BallSpeedTool = lazy(() =>
  import("@/components/scorer/BallSpeedTool").then((module) => ({
    default: module.BallSpeedTool,
  })),
);
const SpeedComparisonLab = lazy(() =>
  import("@/components/scorer/SpeedComparisonLab").then((module) => ({
    default: module.SpeedComparisonLab,
  })),
);
const VideoLab = lazy(() =>
  import("@/components/video/VideoLab").then((module) => ({ default: module.VideoLab })),
);

class VideoToolBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section role="alert" className="rounded-xl border border-border p-4">
          <h2 className="font-semibold">{this.props.name} unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You can return to the scoring tab. Check that scores and pending changes are saved
            before refreshing the app to recover this tool.
          </p>
        </section>
      );
    }
    return this.props.children;
  }
}

function LoadingVideoTool({ name }: { name: string }) {
  return (
    <div
      role="status"
      className="flex min-h-24 items-center gap-3 rounded-xl border border-border p-4 text-sm text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      />
      Loading {name}…
    </div>
  );
}

function OptionalTool({ name, children }: { name: string; children: ReactNode }) {
  return (
    <VideoToolBoundary name={name}>
      <Suspense fallback={<LoadingVideoTool name={name} />}>{children}</Suspense>
    </VideoToolBoundary>
  );
}

/** Optional analysis tools load independently only when the video tab is mounted. */
export function OptionalVideoTools({
  match,
  onSave,
  allowComparison,
}: {
  match: CricketMatch;
  onSave?: ((match: CricketMatch) => void) | undefined;
  allowComparison: boolean;
}) {
  return (
    <>
      <OptionalTool name="ball speed review">
        <BallSpeedTool match={match} onSave={onSave} />
      </OptionalTool>
      {allowComparison && (
        <OptionalTool name="speed validation">
          <SpeedComparisonLab key={match.id} />
        </OptionalTool>
      )}
      <OptionalTool name="video coaching lab">
        <VideoLab />
      </OptionalTool>
    </>
  );
}
