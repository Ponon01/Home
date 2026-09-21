import { useState } from "react";
import DepartmentTableFilters, { useDepartmentFilteredRows } from "./DepartmentTableFilters";
import DocumentActionCell from "./DocumentActionCell";
import { formatNum, formatPurchaseBasis } from "../../utils/apartmentRowData";

const PURCHASE_DOCS = [
  { key: "purchase_contract", title: "Договор купли продажи" },
  { key: "payment_schedule", title: "График платежей" },
  { key: "act", title: "Акт приема-передачи" },
];

const COL_COUNT = 16 + PURCHASE_DOCS.length;

export default function DepartmentBudgetPurchaseTable({ rows = [], title }) {
  const [fioSearch, setFioSearch] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [complexName, setComplexName] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useDepartmentFilteredRows(rows, {
    fioSearch,
    addressSearch,
    complexName,
    status,
  });

  return (
    <div className="complex-working-root">
      {title ? <h1 className="complex-working-title">{title}</h1> : null}
      <DepartmentTableFilters
        fioSearch={fioSearch}
        setFioSearch={setFioSearch}
        addressSearch={addressSearch}
        setAddressSearch={setAddressSearch}
        complexName={complexName}
        setComplexName={setComplexName}
        status={status}
        setStatus={setStatus}
        rows={rows}
      />
      <p className="muted complex-working-sub">
        Показано: {filtered.length} из {rows.length}
      </p>
      <div className="table-wrapper">
        <table className="table-excel">
          <thead>
            <tr>
              <th>ЖК</th>
              <th>Адрес</th>
              <th>ФИО</th>
              <th>Состав семьи</th>
              <th>Первоначальная стоимость</th>
              <th>Оценочная / рыночная</th>
              <th>Остаток долга</th>
              <th>Ежемесячный платёж</th>
              <th>Статус</th>
              <th>Комнат</th>
              <th>Общая площадь</th>
              <th>Год постройки</th>
              <th>Лицевой счет</th>
              <th>Должность</th>
              <th>Подразделение</th>
              <th>Основание для купли-продажи</th>
              {PURCHASE_DOCS.map((d) => (
                <th key={d.key} className="complex-working-th-doc">
                  {d.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="complex-wt-empty">
                  Нет строк по текущим фильтрам
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const apt = row.apartment;
                const res = row.resident;
                const purchase = row.purchase;
                return (
                  <tr key={apt.id}>
                    <td className="complex-wt-left">{apt.residential_complex_name || "—"}</td>
                    <td className="complex-wt-left">{row.address || "—"}</td>
                    <td className="complex-wt-left">{row.fio || "—"}</td>
                    <td className="complex-wt-left">{res?.family_composition || "—"}</td>
                    <td className="complex-wt-num">{formatNum(purchase?.initial_cost)}</td>
                    <td className="complex-wt-num">{formatNum(purchase?.valuation_cost)}</td>
                    <td className="complex-wt-num">{formatNum(purchase?.remaining_debt)}</td>
                    <td className="complex-wt-num">{formatNum(purchase?.monthly_payment)}</td>
                    <td className="complex-wt-left">{apt.status || "—"}</td>
                    <td className="complex-wt-num">{apt.room_count != null ? apt.room_count : ""}</td>
                    <td className="complex-wt-num">{formatNum(apt.total_area)}</td>
                    <td className="complex-wt-num">{apt.build_year != null ? apt.build_year : ""}</td>
                    <td className="complex-wt-left">{apt.personal_account || "—"}</td>
                    <td className="complex-wt-left">{res?.position || "—"}</td>
                    <td className="complex-wt-left">{res?.department || "—"}</td>
                    <td className="complex-wt-left">{formatPurchaseBasis(purchase)}</td>
                    {PURCHASE_DOCS.map((d) => (
                      <td key={d.key} className="complex-wt-doc-cell">
                        <DocumentActionCell doc={row.documents?.[d.key]} />
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
