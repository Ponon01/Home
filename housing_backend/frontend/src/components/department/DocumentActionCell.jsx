import { openDocument, downloadDocument } from "../../api/documents";

export default function DocumentActionCell({ doc }) {
  if (!doc) {
    return <span className="complex-wt-empty">—</span>;
  }
  return (
    <div className="complex-wt-doc-btns">
      <button type="button" className="complex-wt-doc-btn" onClick={() => openDocument(doc.id)}>
        Открыть
      </button>
      <button
        type="button"
        className="complex-wt-doc-btn"
        onClick={() => downloadDocument(doc.id, doc.file_name || "document")}
      >
        Скачать
      </button>
    </div>
  );
}
