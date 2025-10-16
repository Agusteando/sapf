
export function toast(detail = {}) {
  try {
    if (typeof window === "undefined") return;
    const evt = new CustomEvent("sapf:toast", {
      detail: {
        type: detail.type || "info",
        title: detail.title || "",
        message: detail.message || "",
        duration: Number.isFinite(detail.duration) ? detail.duration : 4000,
      },
    });
    window.dispatchEvent(evt);
    // Minimal debug log to confirm dispatch.
    console.debug("[notify] toast dispatched", {
      type: detail.type,
      title: detail.title,
      message: detail.message?.slice?.(0, 200) || "",
      duration: detail.duration,
    });
  } catch (e) {
    // Swallow to avoid breaking callers.
    // eslint-disable-next-line no-console
    console.warn("[notify] toast dispatch error", e?.message || e);
  }
}

export function toastSuccess(message, opts = {}) {
  toast({ type: "success", message, title: opts.title, duration: opts.duration });
}

export function toastError(message, opts = {}) {
  toast({ type: "error", message, title: opts.title, duration: opts.duration });
}

export function toastWarning(message, opts = {}) {
  toast({ type: "warning", message, title: opts.title, duration: opts.duration });
}

export function toastInfo(message, opts = {}) {
  toast({ type: "info", message, title: opts.title, duration: opts.duration });
}
