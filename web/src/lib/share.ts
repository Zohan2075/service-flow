import type { InterestedPerson, Language } from "@/types/data";
import { dateTimeString, type TranslationKey } from "@/lib/i18n";

interface BuildInterestedPersonShareTextArgs {
  person: InterestedPerson;
  statusName: string;
  language: Language;
  t: (key: TranslationKey) => string;
}

// Reference Sunday (2024-01-07) + day index (0=Sun…6=Sat) → localized long weekday name.
function longWeekdayName(language: Language, dayIndex: number): string {
  const name = new Intl.DateTimeFormat(language, { weekday: "long" }).format(
    new Date(2024, 0, 7 + dayIndex),
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Builds a chat-ready summary of a person's stored data; empty fields are
 * omitted entirely. Field order is fixed (see plan phase 1 §C).
 */
export function buildInterestedPersonShareText({
  person,
  statusName,
  language,
  t,
}: BuildInterestedPersonShareTextArgs): string {
  const lines: string[] = [];

  const fullName = [person.name, person.last_name]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
  lines.push(`👤 ${fullName}`);

  const genderSymbol =
    person.gender === "male" ? "♂" : person.gender === "female" ? "♀" : "⚬";
  const genderLabel =
    person.gender === "male"
      ? t("interested.male")
      : person.gender === "female"
        ? t("interested.female")
        : t("interested.unspecified");
  lines.push(
    person.age != null
      ? `${genderSymbol} ${genderLabel} · ${t("interested.age")}: ${person.age}`
      : `${genderSymbol} ${genderLabel}`,
  );

  lines.push(`📌 ${statusName}`);

  if (person.address?.trim()) {
    lines.push(`📍 ${t("interested.address")}: ${person.address.trim()}`);
  }

  if (person.latitude != null && person.longitude != null) {
    lines.push(
      `🗺️ ${t("interested.location")}: https://www.google.com/maps?q=${person.latitude},${person.longitude}`,
    );
  }

  if (person.initial_conversation_date) {
    lines.push(
      `💬 ${t("interested.initialConversation")}: ${dateTimeString(new Date(person.initial_conversation_date), language)}`,
    );
  }

  if (person.next_visit_weekly_day != null) {
    const weekday = longWeekdayName(language, person.next_visit_weekly_day);
    const time = person.next_visit_date
      ? ` ${new Date(person.next_visit_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "";
    lines.push(`📅 ${t("interested.nextVisit")}: ${weekday}${time}`);
  } else if (person.next_visit_date) {
    lines.push(
      `📅 ${t("interested.nextVisit")}: ${dateTimeString(new Date(person.next_visit_date), language)}`,
    );
  }

  if (person.completed) {
    lines.push(`✅ ${t("interested.completed")}`);
  }

  if (person.comments?.trim()) {
    lines.push(`📝 ${t("interested.comments")}: ${person.comments.trim()}`);
  }

  return lines.join("\n");
}
