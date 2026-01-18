
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
}).then(r => r.json());

export function useTenant() {
    const { data: tenant, error: tenantError, mutate: mutateTenant } = useSWR('/api/tenant/me', fetcher);
    const { data: users, error: usersError } = useSWR('/api/tenant/users', fetcher);
    const { data: auditLogs, error: logsError } = useSWR('/api/tenant/audit-logs', fetcher);

    return {
        tenant,
        users,
        auditLogs,
        loading: !tenant && !tenantError,
        error: tenantError || usersError || logsError,
        mutateTenant
    };
}
