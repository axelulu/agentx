import type { CSSProperties } from "react";

const BLUR_FILTER = "saturate(180%) blur(20px)";
const BLUR_FILTER_HEAVY = "saturate(180%) blur(40px)";

/** Frosted glass for the main content area (more opaque) */
export const glassContentStyle: CSSProperties = {
  background: "var(--glass-content-bg)",
  backdropFilter: BLUR_FILTER,
  WebkitBackdropFilter: BLUR_FILTER,
};

/** Frosted glass for modal/dialog panels */
export const glassPanelStyle: CSSProperties = {
  background: "var(--glass-panel-bg)",
  backdropFilter: BLUR_FILTER_HEAVY,
  WebkitBackdropFilter: BLUR_FILTER_HEAVY,
};

/** Frosted glass for popovers, context menus, dropdowns */
export const glassPopoverStyle: CSSProperties = {
  background: "var(--glass-popover-bg)",
  backdropFilter: BLUR_FILTER,
  WebkitBackdropFilter: BLUR_FILTER,
};
