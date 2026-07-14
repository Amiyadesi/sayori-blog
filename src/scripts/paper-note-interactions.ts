type TornItem = {
  note: HTMLElement;
  scopeKey: string;
  originalParent: ParentNode;
  nextSibling: ChildNode | null;
  originalStyles: string;
};

const PAPER_NOTE_SELECTOR = ".paper-note";
const RESTORE_SCOPE_SELECTOR = "[data-paper-restore-scope]";
const TEAR_TRIGGER_SELECTOR = "[data-paper-tear-trigger]";
const RESTORE_BAR_ATTR = "data-paper-restore-bar";
const AUTO_TRIGGER_CLASS = "paper-note-auto-tear-trigger";
const TEAR_GHOST_CLASS = "paper-note-tear-ghost";
const TEAR_ANIMATION_FALLBACK_MS = 980;

const state = {
  initialized: false,
  tornStack: [] as TornItem[],
  bars: new Map<string, HTMLElement>(),
};

function getScopeKey(scope: Element): string {
  return (
    scope.getAttribute("data-paper-restore-scope") ||
    scope.id ||
    scope.getAttribute("data-id") ||
    "page"
  );
}

function ensureRestoreBar(scope: Element, explicitScopeKey?: string) {
  const scopeKey = explicitScopeKey || getScopeKey(scope);
  const existing = state.bars.get(scopeKey);
  if (existing && existing.isConnected) {
    return existing;
  }

  const bar = document.createElement("div");
  bar.className = "paper-restore-bar";
  bar.hidden = true;
  bar.setAttribute(RESTORE_BAR_ATTR, scopeKey);
  bar.innerHTML = `
    <button type="button" class="paper-restore-button" data-paper-restore-last>贴回上一张</button>
    <button type="button" class="paper-restore-button" data-paper-restore-all>恢复全部</button>
  `;

  scope.prepend(bar);
  state.bars.set(scopeKey, bar);
  return bar;
}

function getRestoreContextForNote(note: HTMLElement) {
  const ownScopeKey = note.getAttribute("data-paper-restore-scope") || "";
  const scoped = note.parentElement?.closest(RESTORE_SCOPE_SELECTOR);
  if (scoped) {
    return {
      scope: scoped,
      scopeKey: ownScopeKey || getScopeKey(scoped),
    };
  }

  if (ownScopeKey && note.parentElement) {
    return {
      scope: note.parentElement,
      scopeKey: ownScopeKey,
    };
  }

  const body = document.body;
  body.setAttribute("data-paper-restore-scope", "page");
  return {
    scope: body,
    scopeKey: ownScopeKey || getScopeKey(body),
  };
}

function getOwnTearTriggers(note: HTMLElement): HTMLElement[] {
  return Array.from(note.querySelectorAll<HTMLElement>(TEAR_TRIGGER_SELECTOR)).filter(
    (trigger) => trigger.closest(PAPER_NOTE_SELECTOR) === note,
  );
}

function updateRestoreBars() {
  for (const [scopeKey, bar] of state.bars.entries()) {
    const count = state.tornStack.filter(
      (item) => item.scopeKey === scopeKey,
    ).length;
    bar.hidden = count === 0;
  }
}

function attachTearTrigger(note: HTMLElement) {
  ensureAutoTearTrigger(note);

  note.dataset.paperTearBound = "true";
  const triggers = getOwnTearTriggers(note);
  if (triggers.length === 0) {
    return;
  }

  triggers.forEach((trigger) => {
    if (trigger.dataset.paperTearTriggerBound === "true") {
      return;
    }

    trigger.dataset.paperTearTriggerBound = "true";
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      tearNote(note);
    });
  });
}

function ensureAutoTearTrigger(note: HTMLElement) {
  if (!note.dataset.paperTear) {
    note.dataset.paperTear = "drop";
  }

  const hasOwnAutoTrigger = Array.from(note.children).some((child) =>
    child.classList.contains(AUTO_TRIGGER_CLASS),
  );
  if (hasOwnAutoTrigger) {
    return;
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = AUTO_TRIGGER_CLASS;
  trigger.setAttribute("data-paper-tear-trigger", "");
  trigger.setAttribute("aria-label", "撕下这张纸条");
  trigger.title = "撕下";
  note.prepend(trigger);
}

function getTearMode(note: HTMLElement): string {
  return note.dataset.paperTearMode === "soft" ? "soft" : "drop";
}

function removeCloneIdentity(root: HTMLElement) {
  root.removeAttribute("id");
  root.removeAttribute("data-paper-tear-bound");
  root.removeAttribute("data-paper-restore-scope");
  root.removeAttribute("data-paper-restore-bound");
  root.querySelectorAll<HTMLElement>("[id]").forEach((element) => {
    element.removeAttribute("id");
  });
  root
    .querySelectorAll<HTMLElement>("[data-paper-tear-bound], [data-paper-tear-trigger-bound], [data-paper-restore-bound]")
    .forEach((element) => {
      element.removeAttribute("data-paper-tear-bound");
      element.removeAttribute("data-paper-tear-trigger-bound");
      element.removeAttribute("data-paper-restore-bound");
    });
}

function createTearGhost(note: HTMLElement): HTMLElement {
  const rect = note.getBoundingClientRect();
  const styles = window.getComputedStyle(note);
  const ghost = note.cloneNode(true) as HTMLElement;

  removeCloneIdentity(ghost);
  ghost.classList.remove("is-tearing", "is-torn");
  ghost.classList.add(TEAR_GHOST_CLASS);
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.position = "fixed";
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.margin = "0";
  ghost.style.zIndex = "9999";
  ghost.style.pointerEvents = "none";
  ghost.style.setProperty("--paper-tilt", styles.getPropertyValue("--paper-tilt") || "0deg");

  return ghost;
}

function runTearAnimation(note: HTMLElement, mode: string) {
  const rect = note.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const ghost = createTearGhost(note);
  const fallDistance = Math.max(260, viewportHeight - rect.top + 140);
  const drift = mode === "soft" ? 72 : (Math.random() - 0.5) * 180;
  const rotation =
    (Math.random() > 0.5 ? 1 : -1) * (mode === "soft" ? 14 : 24 + Math.random() * 18);

  ghost.style.setProperty("--paper-tear-fall", `${fallDistance}px`);
  ghost.style.setProperty("--paper-tear-drift", `${drift}px`);
  ghost.style.setProperty("--paper-tear-rotation", `${rotation}deg`);
  document.body.appendChild(ghost);

  note.classList.add("is-torn");

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    ghost.removeEventListener("animationend", cleanup);
    ghost.remove();
    updateRestoreBars();
  };

  ghost.addEventListener("animationend", cleanup, { once: true });
  requestAnimationFrame(() => {
    ghost.classList.add(
      mode === "soft" ? "is-paper-tearing-soft" : "is-paper-tearing-drop",
    );
  });
  window.setTimeout(cleanup, TEAR_ANIMATION_FALLBACK_MS);
}

function tearNote(note: HTMLElement) {
  if (note.classList.contains("is-tearing") || note.classList.contains("is-torn")) {
    return;
  }

  const { scope, scopeKey } = getRestoreContextForNote(note);
  ensureRestoreBar(scope, scopeKey);

  const triggers = getOwnTearTriggers(note);
  triggers.forEach((trigger) => {
    trigger.hidden = true;
  });

  const entry: TornItem = {
    note,
    scopeKey,
    originalParent: note.parentNode!,
    nextSibling: note.nextSibling,
    originalStyles: note.getAttribute("style") || "",
  };

  state.tornStack.push(entry);

  runTearAnimation(note, getTearMode(note));
}

function restoreItem(item: TornItem) {
  const { note, originalParent, nextSibling, originalStyles } = item;
  note.classList.remove("is-tearing", "is-torn");
  note.style.display = "";

  if (originalStyles) {
    note.setAttribute("style", originalStyles);
  } else {
    note.removeAttribute("style");
  }

  const triggers = getOwnTearTriggers(note);
  triggers.forEach((trigger) => {
    trigger.hidden = false;
  });

  if (note.parentNode !== originalParent) {
    if (nextSibling && nextSibling.parentNode === originalParent) {
      originalParent.insertBefore(note, nextSibling);
    } else {
      originalParent.appendChild(note);
    }
  }
}

function restoreLast(scopeKey: string) {
  for (let index = state.tornStack.length - 1; index >= 0; index -= 1) {
    const item = state.tornStack[index];
    if (item.scopeKey !== scopeKey) {
      continue;
    }

    state.tornStack.splice(index, 1);
    restoreItem(item);
    break;
  }

  updateRestoreBars();
}

function restoreAll(scopeKey: string) {
  const kept: TornItem[] = [];
  const restoring: TornItem[] = [];

  for (const item of state.tornStack) {
    if (item.scopeKey === scopeKey) {
      restoring.push(item);
    } else {
      kept.push(item);
    }
  }

  state.tornStack = kept;
  restoring.reverse().forEach(restoreItem);
  updateRestoreBars();
}

function bindRestoreBar(bar: HTMLElement) {
  if (bar.dataset.paperRestoreBound === "true") {
    return;
  }

  bar.dataset.paperRestoreBound = "true";
  const scopeKey = bar.getAttribute(RESTORE_BAR_ATTR) || "page";
  bar
    .querySelector<HTMLElement>("[data-paper-restore-last]")
    ?.addEventListener("click", () => restoreLast(scopeKey));
  bar
    .querySelector<HTMLElement>("[data-paper-restore-all]")
    ?.addEventListener("click", () => restoreAll(scopeKey));
}

function initPaperNoteInteractions() {
  document.querySelectorAll<HTMLElement>(PAPER_NOTE_SELECTOR).forEach((note) => {
    attachTearTrigger(note);
    const { scope, scopeKey } = getRestoreContextForNote(note);
    const bar = ensureRestoreBar(scope, scopeKey);
    bindRestoreBar(bar);
  });

  updateRestoreBars();
}

function setupPaperNoteInteractions() {
  if (state.initialized) {
    initPaperNoteInteractions();
    return;
  }

  state.initialized = true;
  initPaperNoteInteractions();

  document.addEventListener("astro:page-load", initPaperNoteInteractions);
  document.addEventListener("swup:contentReplaced", initPaperNoteInteractions);
  document.addEventListener("mizuki:page:loaded", initPaperNoteInteractions);
}

setupPaperNoteInteractions();
