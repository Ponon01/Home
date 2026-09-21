import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getApartments, getResidents } from "../api/apartments";
import ApartmentTable from "../components/ApartmentTable";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { normalizeComplexName } from "../utils/complexName";

function isRentSubtype(subtype) {
  return ["rent", "guest", "guest_gph"].includes(subtype);
}

function isSoldSubtype(subtype) {
  return ["full_sold", "installment"].includes(subtype);
}

export default function ApartmentsListPage() {
  const { name } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "rent";
  const complexName = decodeURIComponent(name || "");

  const [apartments, setApartments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getApartments({ limit: 500 }), getResidents({ limit: 1000 })])
      .then(([apts, res]) => {
        setApartments(apts || []);
        setResidents(res || []);
      })
      .catch(() => setError("Failed to load apartments"))
      .finally(() => setLoading(false));
  }, []);

  const residentMap = useMemo(() => {
    const map = new Map();
    residents.forEach((r) => {
      if (r.apartment_id && r.is_active && !map.has(r.apartment_id)) {
        map.set(r.apartment_id, r.full_name);
      }
    });
    return map;
  }, [residents]);

  const rows = useMemo(() => {
    const normClicked = normalizeComplexName(complexName);
    return apartments
      .filter((a) => normalizeComplexName(a.residential_complex_name) === normClicked)
      .filter((a) => (type === "sold" ? isSoldSubtype(a.apartment_subtype) : isRentSubtype(a.apartment_subtype)))
      .map((a) => ({ ...a, full_name: residentMap.get(a.id) || "" }));
  }, [apartments, complexName, type, residentMap]);

  return (
    <main className="container">
      <h1>{complexName}</h1>
      <p className="muted">Filter: {type === "sold" ? "sold apartments" : "rent apartments"}</p>
      <p>
        <Link to={`/complex/${encodeURIComponent(complexName)}`}>Back to filters</Link>
      </p>
      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && <ApartmentTable apartments={rows} />}
    </main>
  );
}
