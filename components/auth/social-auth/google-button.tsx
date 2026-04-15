"use client";

import { siGoogle } from "simple-icons";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/use-auth";

export function GoogleButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      console.error("Google sign-in error:", error);
      // Don't redirect on error, let the user see the error
    }
    // Don't redirect here - let the OAuth callback handle the redirect
    // The OAuth flow will redirect to /auth/callback which then redirects to dashboard
    
    setIsLoading(false);
  };

  return (
    <Button 
      variant="secondary" 
      className={cn(className)} 
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      {...props}
    >
      <SimpleIcon icon={siGoogle} className="size-4 cursor-pointer" />
      {isLoading ? "Signing in..." : "Continue with Google"}
    </Button>
  );
}
