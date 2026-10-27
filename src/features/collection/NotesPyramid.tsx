interface NotesPyramidProps {
  top: string[];
  heart: string[];
  base: string[];
}

export function NotesPyramid({ top, heart, base }: NotesPyramidProps) {
  if (top.length + heart.length + base.length === 0) {
    return <p className="muted">Notas olfativas não informadas.</p>;
  }
  const rows: [string, string[]][] = [
    ['Saída', top],
    ['Coração', heart],
    ['Fundo', base],
  ];
  return (
    <dl className="pyramid">
      {rows.map(([label, notes]) => (
        <div key={label} className="pyramid__row">
          <dt>{label}</dt>
          <dd>
            {notes.length ? (
              notes.map((n) => (
                <span key={n} className="note-chip">
                  {n}
                </span>
              ))
            ) : (
              <span className="muted">—</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
