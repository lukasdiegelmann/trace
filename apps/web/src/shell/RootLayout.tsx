import {
  LinkProvider,
  type LinkComponentProps,
} from "@monocircuit/monolithium/contexts";
import { Link, Outlet } from "react-router";

/** monolithium's links (e.g. a crumb with `href`) navigate through React Router */
function RouterLink({ href, ...props }: LinkComponentProps) {
  return <Link to={href} {...props} />;
}

/** The root route: what every page, signed in or not, sits in */
export function RootLayout() {
  return (
    <LinkProvider component={RouterLink}>
      <Outlet />
    </LinkProvider>
  );
}
