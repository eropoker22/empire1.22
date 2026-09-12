export function getOnboardingViewport(win) {
  const visual = win?.visualViewport;
  const width = visual?.width || win?.innerWidth || 1024;
  const height = visual?.height || win?.innerHeight || 768;
  const left = visual?.offsetLeft || 0;
  const top = visual?.offsetTop || 0;
  return { width, height, left, top, right: left + width, bottom: top + height };
}

// Geometry changes must not replace buttons, steal focus or scroll back to a step.
export function observeOnboardingViewport(mount, update) {
  const win = mount?.ownerDocument?.defaultView;
  if (!win?.addEventListener || !win.requestAnimationFrame) return () => {};
  let frame = null;
  const schedule = () => {
    if (frame !== null) return;
    frame = win.requestAnimationFrame(() => { frame = null; if (!mount.hidden && mount.isConnected) update(); });
  };
  win.addEventListener("resize", schedule);
  win.addEventListener("scroll", schedule, true);
  win.visualViewport?.addEventListener("resize", schedule);
  win.visualViewport?.addEventListener("scroll", schedule);
  schedule();
  return () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    win.removeEventListener("resize", schedule);
    win.removeEventListener("scroll", schedule, true);
    win.visualViewport?.removeEventListener("resize", schedule);
    win.visualViewport?.removeEventListener("scroll", schedule);
  };
}
