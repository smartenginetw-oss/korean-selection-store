export type FixedPopoverPosition = {
  top: number;
  left: number;
};

type FixedPopoverOptions = {
  width: number;
  height: number;
  gap?: number;
  margin?: number;
};

/**
 * Position a fixed popover next to its trigger without allowing it to leave
 * the visible viewport. The same calculation is used by every admin picker.
 */
export function getFixedPopoverPosition(anchor: HTMLElement, { width, height, gap = 8, margin = 12 }: FixedPopoverOptions): FixedPopoverPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const panelWidth = Math.min(width, Math.max(0, viewportWidth - margin * 2));
  const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin);
  const left = Math.min(Math.max(anchor.getBoundingClientRect().left, margin), maxLeft);
  const rect = anchor.getBoundingClientRect();
  const below = rect.bottom + gap;
  const above = rect.top - gap - height;
  const fitsBelow = below + height <= viewportHeight - margin;
  const fitsAbove = above >= margin;

  let top = below;
  if (!fitsBelow && fitsAbove) {
    top = above;
  } else if (!fitsBelow) {
    const spaceBelow = Math.max(0, viewportHeight - margin - below);
    const spaceAbove = Math.max(0, rect.top - margin - gap);
    top = spaceBelow >= spaceAbove ? below : above;
  }

  const maxTop = Math.max(margin, viewportHeight - margin - height);
  return { top: Math.min(Math.max(top, margin), maxTop), left };
}
