export function localTime() {
  const result = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return result;
}
