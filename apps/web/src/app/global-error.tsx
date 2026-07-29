"use client";

/**
 * Root error boundary.
 *
 * Next's production default is "Application error: a client-side exception has
 * occurred (see the browser console for more information)" — useless on a phone,
 * where there is no console to open without a USB cable and desktop Chrome.
 *
 * This shows the actual message and stack, so a screenshot is a bug report.
 * Nothing secret ends up here: it's the same text already sitting in the JS
 * console of whoever is holding the device.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#173a5c",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "2rem 1.25rem",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.35rem", margin: "0 0 .35rem" }}>Something broke</h1>
          <p style={{ opacity: 0.75, margin: "0 0 1.25rem", fontSize: ".95rem" }}>
            Screenshot this and send it over — the details below say exactly what failed.
          </p>

          <pre
            style={{
              background: "rgba(0,0,0,.35)",
              borderRadius: 12,
              padding: "1rem",
              fontSize: ".8rem",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowX: "auto",
              margin: "0 0 1.25rem",
            }}
          >
            {error?.name}: {error?.message}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
            {error?.stack ? `\n\n${error.stack.split("\n").slice(0, 12).join("\n")}` : ""}
          </pre>

          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{
                background: "#fff",
                color: "#173a5c",
                border: 0,
                borderRadius: 999,
                padding: ".8rem 1.75rem",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <button
              onClick={() => {
                // Clear the PWA cache + service worker, then hard reload. The
                // usual self-service fix when a stale bundle is the problem.
                void (async () => {
                  try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                  } catch {
                    /* ignore */
                  }
                  location.replace("/");
                })();
              }}
              style={{
                background: "transparent",
                color: "#fff",
                border: "1px solid rgba(255,255,255,.5)",
                borderRadius: 999,
                padding: ".8rem 1.75rem",
                fontSize: "1rem",
              }}
            >
              Reset app data
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
