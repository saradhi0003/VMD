import { requireWorker } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { VoiceForm } from "./VoiceForm";

export default async function WorkerVoicePage() {
  await requireWorker();

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <PageHeader title="Voice entry" subtitle="Speak the milk entry — we'll fill the form." backHref="/worker" />
      <Card>
        <VoiceForm />
      </Card>
    </div>
  );
}
