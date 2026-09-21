import { downloadDocument, openDocument } from "../api/documents";

export default function DocumentsList({ documents = [] }) {
  if (!documents.length) return <p>No documents</p>;

  return (
    <div className="doc-list">
      {documents.map((doc) => {
        return (
          <div className="doc-item" key={doc.id}>
            <div>
              <div className="doc-name">{doc.file_name}</div>
              <div className="doc-type">{doc.document_type}</div>
            </div>
            <div className="doc-actions">
              <button className="button button-ghost" onClick={() => openDocument(doc.id)}>
                Open
              </button>
              <button
                className="button button-ghost"
                onClick={() => downloadDocument(doc.id, doc.file_name || `document-${doc.id}`)}
              >
                Download
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
