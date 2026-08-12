import AppShell from '@/components/AppShell';

// Route group: the (app) folder name doesn't appear in URLs, so this layout wraps
// every authenticated page while /login and /register stay outside the shell.
export default function AuthedLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
