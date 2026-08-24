/**
 * iOS system chrome (status bar, Lock Screen, Home Screen) is always drawn in SF,
 * independent of the app's typeface. On macOS/iOS `-apple-system` resolves to SF Pro.
 */
export const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif'
