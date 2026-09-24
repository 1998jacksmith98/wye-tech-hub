export function isStartDeadlineLabel(label: string) {
  return /^\s*start(\b|$)/i.test((label || "").trim());
}

/** Weekly board tiles hide Start dates and anything marked complete. */
export function visibleBoardDeadlines<
  T extends { label: string; isComplete?: boolean },
>(deadlines: T[]) {
  return deadlines.filter(
    (d) => !d.isComplete && !isStartDeadlineLabel(d.label),
  );
}
