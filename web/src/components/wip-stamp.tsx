export function WipStamp() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      <div className="wip-stamp">
        <span>WIP</span>
        <span className="wip-stamp-note">Not in use yet</span>
      </div>
    </div>
  );
}
