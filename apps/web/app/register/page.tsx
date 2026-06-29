'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRegister } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Needs uppercase, lowercase, and a number'),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-signal-success animate-pulse-dot" />
          <span className="font-mono text-base font-semibold text-foreground">DistroTask</span>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Create an account</h2>
            <p className="text-sm text-muted">The first account created becomes the system admin</p>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4 pt-2"
              onSubmit={handleSubmit((v) => registerMutation.mutate(v))}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" {...register('firstName')} />
                  {errors.firstName && (
                    <span className="text-xs text-signal-danger">{errors.firstName.message}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" {...register('lastName')} />
                  {errors.lastName && (
                    <span className="text-xs text-signal-danger">{errors.lastName.message}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" {...register('email')} />
                {errors.email && <span className="text-xs text-signal-danger">{errors.email.message}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && (
                  <span className="text-xs text-signal-danger">{errors.password.message}</span>
                )}
              </div>
              <Button type="submit" disabled={registerMutation.isPending} className="mt-2">
                {registerMutation.isPending ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
