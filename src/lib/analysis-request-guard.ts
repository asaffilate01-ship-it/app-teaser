/** Client-side request coordination only; backend permissions remain authoritative. */
export function createAnalysisRequestGuard() {
  let generation = 0;
  let ready = false;
  let action: number | null = null;
  let nextAction = 0;
  let preview = 0;

  return {
    beginRefresh() {
      generation += 1;
      preview += 1;
      ready = false;
      return generation;
    },
    completeRefresh(token: number, success: boolean) {
      if (token !== generation) return false;
      ready = success;
      return true;
    },
    canAct: () => ready && action === null,
    beginAction() {
      if (!ready || action !== null) return null;
      action = ++nextAction;
      return action;
    },
    finishAction(token: number) {
      if (action !== token) return false;
      action = null;
      return true;
    },
    beginPreview() {
      return ++preview;
    },
    closePreview() {
      preview += 1;
    },
    isPreviewCurrent: (token: number) => ready && token === preview,
    dispose() {
      generation += 1;
      preview += 1;
      ready = false;
      action = null;
    },
  };
}
