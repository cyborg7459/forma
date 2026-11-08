import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
const snapshot = () => window.location.hash.slice(1) || '/';

export function useLocation() {
  return { pathname: useSyncExternalStore(subscribe, snapshot, () => '/') };
}
export function useParams() {
  return { sectionId: useLocation().pathname.split('/')[2] };
}
export function useNavigate() {
  return (path: string) => { window.location.hash = path; };
}
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };
export function Link({ to, ...props }: LinkProps) {
  return <a {...props} href={`#${to}`} />;
}
export function NavLink({ to, end = false, className = '', ...props }: LinkProps & { end?: boolean }) {
  const { pathname } = useLocation();
  const active = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  return <Link {...props} to={to} className={`${className}${active ? ' active' : ''}`}
    aria-current={active ? 'page' : undefined} />;
}
