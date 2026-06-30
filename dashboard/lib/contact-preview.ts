import type { SFContact } from "./salesforce";

export type ContactPreview = {
  contactCount: number;
  emailCoveragePercent: number;
  phoneCoveragePercent: number;
  missingEmailCount: number;
  missingPhoneCount: number;
  gapSummary: string | null;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function percent(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export function buildContactPreview(contacts: SFContact[]): ContactPreview {
  const contactCount = contacts.length;
  const emailCount = contacts.filter((contact) => !!contact.Email).length;
  const phoneCount = contacts.filter((contact) => !!contact.Phone).length;
  const missingEmailCount = contactCount - emailCount;
  const missingPhoneCount = contactCount - phoneCount;
  const gaps = [
    missingEmailCount > 0 ? plural(missingEmailCount, "missing email") : null,
    missingPhoneCount > 0 ? plural(missingPhoneCount, "missing phone") : null,
  ].filter(Boolean);

  return {
    contactCount,
    emailCoveragePercent: percent(emailCount, contactCount),
    phoneCoveragePercent: percent(phoneCount, contactCount),
    missingEmailCount,
    missingPhoneCount,
    gapSummary: contactCount > 0 && gaps.length > 0 ? `Coverage gaps: ${gaps.join(", ")}.` : null,
  };
}
