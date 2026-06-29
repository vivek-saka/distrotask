'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useCreateTask } from '@/hooks/use-tasks';
import { TaskPriority } from '@distrotask/shared';

const schema = z.object({
  name: z.string().min(1, 'Required').max(200),
  type: z.string().min(1, 'Required').max(100),
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']),
  payload: z.string().refine(
    (v) => {
      try {
        JSON.parse(v || '{}');
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Must be valid JSON' },
  ),
  maxRetries: z.coerce.number().int().min(0).max(10),
});

type FormValues = z.infer<typeof schema>;

export function CreateTaskDialog() {
  const [open, setOpen] = useState(false);
  const createTask = useCreateTask();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'NORMAL', payload: '{}', maxRetries: 3 },
  });

  const onSubmit = (values: FormValues) => {
    createTask.mutate(
      {
        name: values.name,
        type: values.type,
        priority: values.priority as TaskPriority,
        payload: JSON.parse(values.payload || '{}'),
        maxRetries: values.maxRetries,
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>New Task</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 animate-fade-slide-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 animate-fade-slide-in">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-foreground">Create task</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Send welcome email" {...register('name')} />
              {errors.name && <span className="text-xs text-signal-danger">{errors.name.message}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Input id="type" placeholder="email.send" {...register('type')} />
              {errors.type && <span className="text-xs text-signal-danger">{errors.type.message}</span>}
              <span className="text-xs text-muted-foreground">
                Must match a registered worker executor (e.g. email.send, report.generate, webhook.deliver)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-foreground"
                  {...register('priority')}
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="maxRetries">Max retries</Label>
                <Input id="maxRetries" type="number" min={0} max={10} {...register('maxRetries')} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payload">Payload (JSON)</Label>
              <textarea
                id="payload"
                rows={4}
                className="rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                placeholder='{"to": "user@example.com", "subject": "Welcome"}'
                {...register('payload')}
              />
              {errors.payload && <span className="text-xs text-signal-danger">{errors.payload.message}</span>}
            </div>

            <Button type="submit" disabled={createTask.isPending} className="mt-2">
              {createTask.isPending ? 'Creating…' : 'Create and enqueue'}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
