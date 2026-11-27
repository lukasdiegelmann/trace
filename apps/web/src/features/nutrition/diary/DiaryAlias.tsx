import { Navigate, useLocation } from "react-router";

/** `/nutrition/diary?date=…`, as Statistics links a day, is the diary */
export function DiaryAlias() {
  const { search } = useLocation();
  return <Navigate to={`/nutrition${search}`} replace />;
}
