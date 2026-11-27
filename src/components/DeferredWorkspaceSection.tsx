import { Component, Suspense, type ReactNode } from "react";

class SectionBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <section role="alert" className="rounded-xl border border-white/10 p-4">
          <h2 className="font-semibold">{this.props.name} unavailable</h2>
          <p className="mt-2 text-sm text-slate-400">
            Other workspace sections are still available. Check your connection and save any
            outstanding work before refreshing the page to recover this section.
          </p>
        </section>
      );
    }
    return this.props.children;
  }
}

export function DeferredWorkspaceSection({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <SectionBoundary name={name}>
      <Suspense
        fallback={
          <div
            role="status"
            className="flex min-h-32 items-center gap-3 rounded-xl border border-white/10 p-4 text-sm text-slate-300"
          >
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
            Loading {name}…
          </div>
        }
      >
        {children}
      </Suspense>
    </SectionBoundary>
  );
}
