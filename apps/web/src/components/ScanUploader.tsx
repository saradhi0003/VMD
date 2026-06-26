"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

function SubmitButton({ hasImage }: { hasImage: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!hasImage || pending} className="w-full">
      {pending ? "Reading sheet…" : "Scan & continue"}
    </Button>
  );
}

/** Camera/file uploader for Smart Scan. Posts the chosen image to the given server action. */
export function ScanUploader({
  action,
  hint = "milk sheet · feed sheet · or choose from gallery",
}: {
  action: (formData: FormData) => void;
  hint?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-4">
      <label className="grid cursor-pointer place-items-center rounded-card border-2 border-dashed border-line bg-surface px-6 py-10 text-center transition hover:border-navy/40">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected document" className="max-h-56 rounded-tile object-contain" />
        ) : (
          <span className="space-y-1">
            <span className="block text-3xl">📷</span>
            <span className="block text-base font-semibold text-ink">Photograph the document</span>
            <span className="block text-sm text-ink-2">{hint}</span>
          </span>
        )}
        <input
          type="file"
          name="image"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>
      <SubmitButton hasImage={!!preview} />
      <p className="text-center text-xs text-ink-3">We read each row, then let you check and fix it before saving.</p>
    </form>
  );
}
