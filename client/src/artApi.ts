/**
 * Single import point for artwork: every screen imports from here, never from
 * ./art directly, so the art can be swapped or stubbed in one line.
 */
export { Avatar, CreekScene, DepthMeter, DescentScene, TierBadge, Logo, Backdrop } from './art/index';
