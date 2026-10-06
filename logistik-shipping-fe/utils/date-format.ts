import { format, formatDistanceToNow, isValid, parse } from "date-fns";

function formatDisplayDate(date: Date) {
  return format(date, "dd MMM yyyy HH:mm:ss");
}

function formatDisplayDateShort(date: Date) {
  return format(date, "dd MMM yyyy");
}

function parseDate(value: string) {
  const parsers = [
    () => new Date(value),
    () => new Date(value.replace(" ", "T")),
    () => parse(value, "dd MMM yyyy HH:mm:ss", new Date()),
    () => parse(value, "dd MMM yyyy HH:mm", new Date()),
    () => parse(value, "dd MMM yyyy", new Date()),
    () => parse(value, "yyyy-MM-dd HH:mm:ss", new Date()),
    () => parse(value, "yyyy-MM-dd HH:mm", new Date()),
    () => parse(value, "yyyy-MM-dd", new Date()),
    () => parse(value, "yyyy-MM-dd'T'HH:mm:ss", new Date()),
    () => parse(value, "yyyy-MM-dd'T'HH:mm", new Date()),
  ];

  for (const getDate of parsers) {
    const date = getDate();
    if (isValid(date)) return date;
  }

  return null;
}

function formatRelativeHuman(date: Date) {
  const value = formatDistanceToNow(date, { addSuffix: true });

  if (value === "less than a minute ago") return "just now";
  if (value === "about 1 hour ago") return "an hour ago";
  if (value === "about 1 month ago") return "a month ago";
  if (value === "about 1 year ago") return "a year ago";

  return value;
}

export function DateFormat(dateString: string): string {
  const value = dateString.trim();

  if (!value) return "";

  const date = parseDate(value);
  if (date) return formatDisplayDate(date);

  return value;
}

export function DateFormatShort(dateString: string): string {
  const value = dateString.trim();
  if (!value) return "";

  const date = parseDate(value);
  if (date) return formatDisplayDateShort(date);

  return value;
}

export function DateFormatRelativeHuman(dateString: string): string {
  const value = dateString.trim();
  if (!value) return "";

  const date = parseDate(value);
  if (date) return formatRelativeHuman(date);

  return value;
}
