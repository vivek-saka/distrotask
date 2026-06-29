import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoginDto, RegisterDto } from '@distrotask/shared';
import { apiClient } from '@/services/api-client';
import { useAuthStore } from '@/store/auth.store';

interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: { id: string; email: string; firstName: string; lastName: string; role: string };
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export function useLogin() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: async (dto: LoginDto) => {
      const { data } = await apiClient.post<ApiEnvelope<AuthTokensResponse>>('/v1/auth/login', dto);
      return data.data;
    },
    onSuccess: (result) => {
      setTokens(result.accessToken, result.refreshToken);
      toast.success(`Welcome back, ${result.user.firstName}`);
      router.push('/dashboard');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Login failed');
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: async (dto: RegisterDto) => {
      const { data } = await apiClient.post<ApiEnvelope<AuthTokensResponse>>('/v1/auth/register', dto);
      return data.data;
    },
    onSuccess: (result) => {
      setTokens(result.accessToken, result.refreshToken);
      toast.success('Account created');
      router.push('/dashboard');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Registration failed');
    },
  });
}
