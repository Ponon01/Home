import { useState } from "react";
import { FileText } from "lucide-react";
import HousingApplicationModal from "./HousingApplicationModal";
import { APPLICATION_TYPES } from "../../constants/housingApplicationTypes";

export default function HousingApplicationCTA() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        style={{
          background: "#053526",
          border: "1px solid rgba(197,160,89,0.4)",
          borderRadius: "20px",
          padding: "32px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
          maxWidth: "1280px",
          margin: "32px auto",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "rgba(197,160,89,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText size={24} color="#C5A059" />
          </div>
          <div>
            <h2 style={{ color: "#ffffff", fontWeight: "bold", fontSize: "20px", margin: 0, fontFamily: "serif" }}>
              Нужно служебное жильё?
            </h2>
            <p style={{ color: "#a0aec0", fontSize: "14px", margin: "6px 0 0" }}>
              Выберите тип заявления и скачайте бланк внутри формы подачи
            </p>
          </div>
        </div>
        
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            background: "linear-gradient(135deg, #C5A059 0%, #E2C78A 50%, #C5A059 100%)",
            color: "#032b1e",
            fontWeight: "bold",
            padding: "14px 32px",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            fontSize: "15px",
            boxShadow: "0 4px 20px rgba(197,160,89,0.3)",
            whiteSpace: "nowrap",
            transition: "transform 0.2s",
          }}
        >
          Подать заявление
        </button>
      </div>

      <HousingApplicationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTypeId={1}
      />
    </>
  );
}
