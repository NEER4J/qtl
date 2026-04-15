"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";

function VerifyEmailContent() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we have verification tokens in the URL
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const type = searchParams.get('type');

    if (accessToken && refreshToken && type === 'signup') {
      setIsVerifying(true);
      // The middleware will handle the actual verification
      // We just need to show the appropriate UI
      setTimeout(() => {
        setVerificationStatus('success');
        setIsVerifying(false);
        // Redirect to dashboard after successful verification
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }, 1000);
    }
  }, [searchParams, router]);

  // If user is already verified and logged in, redirect to dashboard
  useEffect(() => {
    if (user && verificationStatus === 'pending') {
      router.push('/dashboard');
    }
  }, [user, router, verificationStatus]);

  if (isVerifying) {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-medium">Verifying your email...</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Please wait while we verify your email address.
          </p>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-medium">Email verified!</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Your email has been successfully verified. Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'error') {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-3xl font-medium">Verification failed</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            There was an error verifying your email. The link may have expired.
          </p>
        </div>
        <div className="space-y-4">
          <Link href="/auth/register">
            <Button className="w-full">
              Try Again
            </Button>
          </Link>
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
      <div className="space-y-4 text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-medium">Check your email</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          We've sent you a verification link. Please check your email and click the link to verify your account.
        </p>
      </div>
      <div className="space-y-4">
        <Link href="/auth/login">
          <Button className="w-full" variant="outline">
            Back to Login
          </Button>
        </Link>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Didn't receive the email? Check your spam folder or{" "}
            <Link href="/auth/register" className="text-blue-600 dark:text-blue-400 hover:underline">
              try registering again
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-medium">Loading...</h1>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
