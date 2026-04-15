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
  email: z.string().email({ message: "Please enter a valid email address." }),
});

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { resetPassword } = useAuth();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    
    const { error } = await resetPassword(data.email);
    
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
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            We've sent you a password reset link. Please check your email and follow the instructions.
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
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="you@example.com" 
                    autoComplete="email" 
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
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-50"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
