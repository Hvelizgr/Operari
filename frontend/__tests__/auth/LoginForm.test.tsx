import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '@/app/[lang]/(auth)/login/LoginForm';

const mockLogin = jest.fn();
const mockReplace = jest.fn();
const searchParamsGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => ({ get: searchParamsGet }),
  usePathname: () => '/en/login',
}));

jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth/auth-client');
  return {
    AuthError: actual.AuthError,
    useAuth: () => ({
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
      session: null,
      loading: false,
    }),
  };
});

describe('LoginForm', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockReplace.mockReset();
    searchParamsGet.mockReset();
  });

  it('renders email and password fields and submits them', async () => {
    mockLogin.mockResolvedValueOnce({
      user: { id: 'u', email: 'a@b.co', name: null, role: 'USER' },
      tenant: { id: 't', name: 'T' },
    });
    searchParamsGet.mockReturnValue(null);

    render(<LoginForm lang="en" />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ email: 'a@b.co', password: 'password123' });
      expect(mockReplace).toHaveBeenCalledWith('/en/dashboard');
    });
  });

  it('shows a generic error on 401 without leaking which field was wrong', async () => {
    const { AuthError } = jest.requireActual('@/lib/auth/auth-client');
    mockLogin.mockRejectedValueOnce(new AuthError('Invalid credentials', 401));
    searchParamsGet.mockReturnValue(null);

    render(<LoginForm lang="en" />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Invalid credentials');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('respects a safe redirect query param', async () => {
    mockLogin.mockResolvedValueOnce({
      user: { id: 'u', email: 'a@b.co', name: null, role: 'USER' },
      tenant: { id: 't', name: 'T' },
    });
    searchParamsGet.mockReturnValue('/en/runbooks');

    render(<LoginForm lang="en" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/en/runbooks');
    });
  });

  it('ignores an unsafe redirect (external URL) and falls back to dashboard', async () => {
    mockLogin.mockResolvedValueOnce({
      user: { id: 'u', email: 'a@b.co', name: null, role: 'USER' },
      tenant: { id: 't', name: 'T' },
    });
    searchParamsGet.mockReturnValue('https://evil.example.com/steal');

    render(<LoginForm lang="en" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/en/dashboard');
    });
  });
});
