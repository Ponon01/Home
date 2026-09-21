import { Link } from "react-router-dom";

export default function ApartmentTable({ apartments = [] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Адрес</th>
          <th>ФИО</th>
          <th>Тип жилья</th>
          <th>Подтип</th>
          <th>Статус</th>
          <th>Открыть</th>
        </tr>
      </thead>
      <tbody>
        {apartments.map((apt) => (
          <tr key={apt.id}>
            <td>{apt.address || "-"}</td>
            <td>{apt.full_name || "-"}</td>
            <td>{apt.housing_type || "-"}</td>
            <td>{apt.apartment_subtype || "-"}</td>
            <td>{apt.status || "-"}</td>
            <td>
              <Link to={`/apartments/${apt.id}`}>Открыть</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
