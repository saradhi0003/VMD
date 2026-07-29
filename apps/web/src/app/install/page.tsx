import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Install the app | Vayumukhi Dairy",
  description: "Put Vayumukhi Dairy on your phone — Android and iPhone.",
};

const RELEASES = "https://github.com/saradhi0003/VMD/releases/latest";

/**
 * A page testers can open ON the phone they're installing to.
 *
 * The two platforms genuinely differ and pretending otherwise wastes people's
 * time: Android sideloads a debug-signed APK in two taps, while Apple requires a
 * signing identity for any self-built app — so iPhone gets Add to Home Screen,
 * which needs no build and no account.
 */
export default function InstallPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-10">
      <PageHeader
        title="Install Vayumukhi Dairy"
        subtitle="Two minutes. Pick the section for your phone."
      />

      <Card>
        <h2 className="font-serif text-2xl text-ink">
          <span aria-hidden>🍎</span> iPhone &amp; iPad
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          No download, no App Store, no Apple ID. Safari installs it directly.
        </p>
        <ol className="mt-4 space-y-3 text-sm text-ink">
          <li>
            <strong>1.</strong> Open this page in <strong>Safari</strong> (not Chrome — only
            Safari can install on iOS).
          </li>
          <li>
            <strong>2.</strong> Tap the <strong>Share</strong> button
            <span className="mx-1 rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs">↑</span>
            at the bottom of the screen.
          </li>
          <li>
            <strong>3.</strong> Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li>
            <strong>4.</strong> Tap <strong>Add</strong>. The icon appears on your home screen.
          </li>
        </ol>
        <div className="mt-4 rounded-tile bg-surface-alt p-3 text-sm text-ink-2">
          Works offline, opens full-screen with no browser bar, and updates itself. Two
          things differ from Android: <strong>speech-to-text is unavailable</strong> (Safari
          has no support — type the entry instead), and{" "}
          <strong>sign-in links from email open in Safari rather than the app</strong>, so sign
          in with your password or PIN inside the app itself.
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-2xl text-ink">
          <span aria-hidden>🤖</span> Android
        </h2>
        <p className="mt-1 text-sm text-ink-2">Install the real app in two taps.</p>
        <ol className="mt-4 space-y-3 text-sm text-ink">
          <li>
            <strong>1.</strong>{" "}
            <a
              href={RELEASES}
              className="font-semibold text-navy underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the latest release
            </a>{" "}
            and tap the <span className="font-mono text-xs">.apk</span> file.
          </li>
          <li>
            <strong>2.</strong> Android will warn about installing from an unknown source —
            allow it for your browser. This is expected for an app not on the Play Store.
          </li>
          <li>
            <strong>3.</strong> Tap <strong>Install</strong>, then open the app.
          </li>
        </ol>
        <div className="mt-4 rounded-tile bg-surface-alt p-3 text-sm text-ink-2">
          Adds a native camera for Smart Scan and a fingerprint / face lock. You can also use
          Add to Home Screen from Chrome if you&apos;d rather not sideload.
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-xl text-ink">Trouble?</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-2">
          <li>
            <strong className="text-ink">Blank screen or an error page.</strong> Tap
            &ldquo;Reset app data&rdquo; if it&apos;s offered, or clear the app&apos;s cache
            (Android: Settings → Apps → Vayumukhi Dairy → Storage). Then reopen.
          </li>
          <li>
            <strong className="text-ink">&ldquo;Add to Home Screen&rdquo; is missing.</strong>{" "}
            You&apos;re not in Safari. iOS only allows installs from Safari.
          </li>
          <li>
            <strong className="text-ink">Scanning a sheet returns nothing.</strong> Photo
            reading needs a vision-capable AI provider configured on the server.
          </li>
        </ul>
      </Card>
    </div>
  );
}
