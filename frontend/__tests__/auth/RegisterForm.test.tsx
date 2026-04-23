import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { RegisterForm } from '@/app/[lang]/(auth)/register/RegisterForm';

const mockRegister = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn() }),
  usePathname: () => '/en/register',
}));

jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth/auth-client');
  return {
    AuthError: actual.AuthError,
    useAuth: () => ({
      login: jest.fn(),
      register: mockRegister,
      logout: jest.fn(),
      refresh: jest.fn(),
      session: null,
      loading: false,
    }),
  };
});

describe('RegisterForm', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockReplace.mockReset();
  });

  it('registers a new account with workspace + credentials and routes to dashboard', async () => {
    mockRegister.mockResolvedValueOnce({
      user: { id: 'u', email: 'founder@acme.io', name: 'Jane', role: 'ADMIN' },
      tenant: { id: 't', name: 'Acme' },
    });

    render(<RegisterForm lang="en" />);

    fireEvent.change(screen.getByLabelText(/workspace name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'founder@acme.io' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'supersecret' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'founder@acme.io',
        password: 'supersecret',
        tenantName: 'Acme',
        name: 'Jane',
      });
      expect(mockReplace).toHaveBeenCalledWith('/en/dashboard');
    });
  });

  it('surfaces the server message when email is already registered', async () => {
    const { AuthError } = jest.requireActual('@/lib/auth/auth-client');
    mockRegister.mockRejectedValueOnce(new AuthError('Email already registered', 400));

    render(<RegisterForm lang="en" />);

    fireEvent.change(screen.getByLabelText(/workspace name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dup@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'supersecret' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email already registered');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
