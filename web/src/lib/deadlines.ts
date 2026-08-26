export function isStartDeadlineLabel(label: string) {
  return /^\s*start(\b|$)/i.test((label || "").trim());
}

/** Weekly board tiles should not show Start — it reads as the next issue date. */
export function visibleBoardDeadlines<T extends { label: string }>(deadlines: T[]) {
  return deadlines.filter((d) => !isStartDeadlineLabel(d.label));
}
