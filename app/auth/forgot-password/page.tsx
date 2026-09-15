"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/use-auth";

const FormSchema = z.object({
  identifier: z.string().trim().min(1, { message: "Please enter your email or username." }),
});

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { resetPassword } = useAuth();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      identifier: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);

    const { error } = await resetPassword(data.identifier);
    
    if (error) {
      toast.error("Failed to send reset email", {
        description: error,
      });
    } else {
      setIsSubmitted(true);
      toast.success("Reset email sent", {
        description: "Please check your email for password reset instructions.",
      });
    }
    
    setIsLoading(false);
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium">Check your email</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            We&apos;ve sent you a password reset link. Please check your email and follow the instructions.
          </p>
        </div>
        <div className="space-y-4">
          <Link href="/auth/login">
            <Button className="w-full" variant="outline">
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-medium">Forgot your password?</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          Enter your email or username and we&apos;ll email you a link to reset your password.
          Staff without an email address on file should ask their manager or admin.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email or username</FormLabel>
                <FormControl>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="you@example.com or jdoe"
                    autoComplete="username"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </Form>
      <div className="text-center">
        <Link 
          href="/auth/login" 
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
