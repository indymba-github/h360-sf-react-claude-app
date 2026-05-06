import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session.accessToken) {
    redirect("/");
  }

  const settings = getSettings();

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Customize the app's branding and colors.</p>
      </div>
      <SettingsClient initial={settings} />
    </div>
  );
}
