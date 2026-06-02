import { Navigate, useLocation } from "react-router-dom";
import { useAppState } from "../features/app/AppStateContext";
import { buildLoginRedirectPath } from "../features/auth/authRedirect";

export function RequireAuth(props: { children: JSX.Element }) {
  const { token } = useAppState();
  const location = useLocation();

  if (!token) {
    return <Navigate replace to={buildLoginRedirectPath(`${location.pathname}${location.search}`)} />;
  }

  return props.children;
}
