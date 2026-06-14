import SidebarShell from '../../components/SidebarShell';

export default function AdminLayout({ children }) {
    return <SidebarShell requireAdmin>{children}</SidebarShell>;
}
