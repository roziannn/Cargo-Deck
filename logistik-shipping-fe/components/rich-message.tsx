import { Fragment } from "react";

/** Shows a message where **double asterisks** mark bold text, e.g. a status the user has to look at. */
export function RichMessage({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}
