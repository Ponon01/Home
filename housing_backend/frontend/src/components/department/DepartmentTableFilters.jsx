import { useMemo } from "react";

export default function DepartmentTableFilters({
  fioSearch,
  setFioSearch,
  addressSearch,
  setAddressSearch,
  complexName,
  setComplexName,
  status,
  setStatus,
  rows,
}) {
  const complexOptions = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => {
      const n = r.apartment?.residential_complex_name;
      if (n != null && String(n).trim() !== "") s.add(String(n).trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => {
      const st = r.apartment?.status;
      if (st != null && String(st).trim() !== "") s.add(String(st).trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows]);

  return (
    <div className="complex-working-filters dept-filters">
      <label className="complex-working-filter">
        Поиск по ФИО
        <input
          type="search"
          className="complex-working-input"
          value={fioSearch}
          onChange={(e) => setFioSearch(e.target.value)}
          placeholder="ФИО…"
        />
      </label>
      <label className="complex-working-filter">
        Поиск по адресу
        <input
          type="search"
          className="complex-working-input"
          value={addressSearch}
          onChange={(e) => setAddressSearch(e.target.value)}
          placeholder="Адрес…"
        />
      </label>
      <label className="complex-working-filter">
        ЖК
        <select
          className="complex-working-select"
          value={complexName}
          onChange={(e) => setComplexName(e.target.value)}
        >
          <option value="">Все ЖК</option>
          {complexOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="complex-working-filter">
        Статус
        <select className="complex-working-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          {statusOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function useDepartmentFilteredRows(rows, { fioSearch, addressSearch, complexName, status }) {
  return useMemo(() => {
    const fio = fioSearch.trim().toLowerCase();
    const addr = addressSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (fio && !(row.fio || "").toLowerCase().includes(fio)) return false;
      if (addr && !(row.address || "").toLowerCase().includes(addr)) return false;
      if (complexName && (row.apartment.residential_complex_name || "").trim() !== complexName) return false;
      if (status && (row.apartment.status || "").trim() !== status) return false;
      return true;
    });
  }, [rows, fioSearch, addressSearch, complexName, status]);
}
