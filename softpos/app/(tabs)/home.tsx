import { useAuthContext } from '@/lib/auth-context';
import { AttendeeHome } from '@/components/home/attendee-home';
import { OperatorHome } from '@/components/home/operator-home';
import { VendorHome } from '@/components/home/vendor-home';
import { AdminHome } from '@/components/home/admin-home';

export default function HomeScreen() {
  const { role } = useAuthContext();

  switch (role) {
    case 'admin':
      return <AdminHome />;
    case 'operator':
      return <OperatorHome />;
    case 'vendor':
      return <VendorHome />;
    case 'attendee':
    default:
      return <AttendeeHome />;
  }
}
