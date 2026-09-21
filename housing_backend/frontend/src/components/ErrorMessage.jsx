export default function ErrorMessage({ message }) {
  return <div className="state error">{message || "Something went wrong."}</div>;
}
