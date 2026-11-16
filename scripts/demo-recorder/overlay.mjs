// In-page overlay for scripts/record-demo.mjs: a cursor animated on
// requestAnimationFrame, click ripples and captions.
//
// Playwright's input events don't move a visible cursor, and tab capture
// doesn't include the OS cursor, so the recorder draws its own. Every function
// here is serialized into the page with page.evaluate(), so it must not
// reference anything outside its own body.

/**
 * Install the overlay on window.__demoOverlay. Safe to call twice: the
 * previous overlay is removed first.
 *
 * @param {{ x: number, y: number }} start Initial cursor position (CSS px).
 */
export function installOverlay(start) {
  window.__demoOverlay?.remove();

  const Z = "2147483647";
  const root = document.createElement("div");
  root.dataset.demoOverlay = "";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: Z,
    overflow: "hidden",
  });

  // Arrow pointer, tip at (0, 0) of the element.
  const svgNs = "http://www.w3.org/2000/svg";
  const cursor = document.createElementNS(svgNs, "svg");
  cursor.setAttribute("width", "22");
  cursor.setAttribute("height", "28");
  cursor.setAttribute("viewBox", "0 0 22 28");
  const arrow = document.createElementNS(svgNs, "path");
  arrow.setAttribute("d", "M1.5 1.5 L1.5 22.5 L7 17.5 L10.8 26 L14.6 24.3 L10.9 16 L18.5 16 Z");
  arrow.setAttribute("fill", "#fff");
  arrow.setAttribute("stroke", "#111");
  arrow.setAttribute("stroke-width", "1.6");
  arrow.setAttribute("stroke-linejoin", "round");
  cursor.append(arrow);
  Object.assign(cursor.style, {
    position: "absolute",
    left: "0",
    top: "0",
    overflow: "visible",
    filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35))",
    transformOrigin: "1.5px 1.5px",
    willChange: "transform",
  });

  const caption = document.createElement("div");
  Object.assign(caption.style, {
    position: "absolute",
    left: "50%",
    bottom: "40px",
    maxWidth: "70%",
    padding: "10px 20px",
    borderRadius: "999px",
    background: "rgba(17, 17, 22, 0.88)",
    color: "#fff",
    font: "500 16px/1.35 system-ui, -apple-system, sans-serif",
    letterSpacing: "0.01em",
    textAlign: "center",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
    opacity: "0",
    transform: "translate(-50%, 8px)",
  });

  root.append(caption, cursor);
  document.documentElement.append(root);

  const state = { x: start.x, y: start.y, scale: 1, frame: 0 };
  const render = () => {
    cursor.style.transform = `translate3d(${state.x - 1.5}px, ${state.y - 1.5}px, 0) scale(${state.scale})`;
  };
  render();
  cursor.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease-out" });

  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  /** Move the cursor to (x, y) over `duration` ms, one step per animation frame. */
  function glide(x, y, duration) {
    cancelAnimationFrame(state.frame);
    const fromX = state.x;
    const fromY = state.y;
    return new Promise((resolve) => {
      let startTime = 0;
      const tick = (now) => {
        if (!startTime) {
          startTime = now;
        }
        const t = Math.min(1, (now - startTime) / duration);
        const k = easeInOutCubic(t);
        state.x = fromX + (x - fromX) * k;
        state.y = fromY + (y - fromY) * k;
        render();
        if (t < 1) {
          state.frame = requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      state.frame = requestAnimationFrame(tick);
    });
  }

  /** Press feedback: the cursor dips and a ripple expands from its tip. */
  function press() {
    const ripple = document.createElement("div");
    Object.assign(ripple.style, {
      position: "absolute",
      left: `${state.x - 30}px`,
      top: `${state.y - 30}px`,
      width: "60px",
      height: "60px",
      borderRadius: "50%",
      background: "rgba(99, 102, 241, 0.32)",
      border: "2.5px solid rgba(99, 102, 241, 0.95)",
      boxSizing: "border-box",
    });
    root.insertBefore(ripple, cursor);
    ripple
      .animate(
        [
          { transform: "scale(0.25)", opacity: 1 },
          { transform: "scale(1.5)", opacity: 0 },
        ],
        { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      )
      .finished.then(() => ripple.remove());

    const dip = cursor.animate(
      [
        { transform: cursor.style.transform },
        { transform: cursor.style.transform.replace(/scale\([^)]*\)/, "scale(0.82)") },
        { transform: cursor.style.transform },
      ],
      { duration: 220, easing: "ease-out" },
    );
    return dip.finished.then(() => undefined);
  }

  /** Show a caption (fading out any current one), or hide it with null. */
  async function setCaption(text) {
    if (caption.style.opacity !== "0") {
      await caption.animate(
        [
          { opacity: 1, transform: "translate(-50%, 0)" },
          { opacity: 0, transform: "translate(-50%, 8px)" },
        ],
        { duration: 180, easing: "ease-in" },
      ).finished;
      caption.style.opacity = "0";
      caption.style.transform = "translate(-50%, 8px)";
    }
    if (text == null) {
      return;
    }
    caption.textContent = text;
    caption.style.opacity = "1";
    caption.style.transform = "translate(-50%, 0)";
    await caption.animate(
      [
        { opacity: 0, transform: "translate(-50%, 8px)" },
        { opacity: 1, transform: "translate(-50%, 0)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    ).finished;
  }

  function remove() {
    cancelAnimationFrame(state.frame);
    root.remove();
    delete window.__demoOverlay;
  }

  window.__demoOverlay = { glide, press, setCaption, remove };
}
