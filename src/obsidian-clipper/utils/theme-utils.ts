export function isDarkMode(): boolean {
  // Check for Safari-specific properties
  if ("safari" in window) {
    // @ts-ignore
    if (globalThis.safari.darkMode === true) {
      return true;
    }
  }

  // Check for native macOS dark mode
  if (
    globalThis.matchMedia &&
    globalThis.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return true;
  }

  // Check if the browser supports color-scheme
  if (globalThis.matchMedia && globalThis.matchMedia("(color-scheme: dark)").matches) {
    return true;
  }

  // Check for dark mode class on html or body
  if (
    document.documentElement.classList.contains("dark-mode") ||
    document.body.classList.contains("dark-mode")
  ) {
    return true;
  }

  // Check for dark background color
  const bodyColor = globalThis.getComputedStyle(document.body).backgroundColor;
  const [r, g, b] = bodyColor.match(/\d+/g)?.map(Number) || [255, 255, 255];
  if (r + g + b < 384) { // Threshold for considering it "dark"
    return true;
  }

  return false;
}

// Add a new function to observe changes in color scheme
export function observeColorScheme(callback: (isDark: boolean) => void): void {
  const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addListener((e) => callback(e.matches));

  // Initial call
  callback(mediaQuery.matches);
}
