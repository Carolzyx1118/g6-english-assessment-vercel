export default function PureonFooter({ note }: { note?: string }) {
  return (
    <div className="pureon-footer">
      <strong>璞源教育 · PUREON EDUCATION</strong>
      {note ? <span> · {note}</span> : null}
      <span> · © 2026</span>
    </div>
  );
}
