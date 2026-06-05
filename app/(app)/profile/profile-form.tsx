"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UpdateOwnProfileInput } from "@/lib/schemas/profile";
import { updateOwnProfile } from "@/lib/actions/profile";

export function ProfileForm({ fullName }: { fullName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(UpdateOwnProfileInput),
    defaultValues: { full_name: fullName },
  });

  const onSubmit = (values: UpdateOwnProfileInput) => {
    startTransition(async () => {
      const res = await updateOwnProfile(values);
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [key, msgs] of Object.entries(res.fieldErrors)) {
            form.setError(key as keyof UpdateOwnProfileInput, { message: msgs[0] });
          }
        }
        return;
      }
      form.reset({ full_name: res.data.full_name });
      toast.success("Profile updated");
      router.refresh();
    });
  };

  const dirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Jane Doe" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || !dirty}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
