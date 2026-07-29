"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Mail, Lock, User } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export default function AcceptInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      // Clear any existing session first (especially if an admin is testing in the same browser)
      await authClient.signOut();

      // 1. Sign up the user (this will log them in automatically)
      const { data: signUpData, error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name,
      });

      // If sign up fails (e.g. user already exists), try signing in
      if (signUpError) {
         const { error: signInError } = await authClient.signIn.email({ email, password });
         if (signInError) {
           throw new Error("SIGNIN_FAILED");
         }
      }

      // 2. Accept the invitation
      const { data: acceptData, error: acceptError } = await authClient.organization.acceptInvitation({
        invitationId: id,
      });

      if (acceptError) {
        throw acceptError;
      }

      toast.success("Welcome to the team!");
      router.push("/");
    } catch (error: any) {
      if (error?.message === "SIGNIN_FAILED") {
        toast.error("An account with this email already exists, but the password was incorrect.");
        return;
      }
      let errText = "";
      if (typeof error === 'string') {
        errText = error;
      } else if (error?.message) {
        errText = error.message;
      } else if (error?.error?.message) {
        errText = error.error.message;
      } else {
        try { errText = JSON.stringify(error); } catch(e) {}
      }
      
      let msg = errText || "Failed to accept invitation. Make sure you use the exact email you were invited with.";
      const lowerMsg = msg.toLowerCase();
      if (
        lowerMsg === "this email belongs to a different user" || 
        lowerMsg === "this email belongs to a diffrent user" || 
        lowerMsg === "you can only accept an invitation sent to the same email address as your account"
      ) {
        msg = "This isn't the right email for that link. Please use the exact email you were invited with.";
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 bg-[url('/grid-pattern.svg')] bg-repeat bg-[length:32px_32px]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
            <ShieldCheck className="h-8 w-8 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight text-center">Team Invitation</h1>
          <p className="text-gray-400 mt-2 text-center text-sm px-4">
            You've been invited to join a PromptWall organization. Complete your profile to accept the invitation.
          </p>
        </div>

        <Card className="glass-card border-white/10 shadow-2xl overflow-hidden bg-black/60 backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Create your account</CardTitle>
            <CardDescription className="text-muted-foreground">
              You must use the exact email address the invitation was sent to.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleOnboarding}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                    type="text" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-white/30"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                    type="email" 
                    placeholder="name@company.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-white/30"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                    type="password" 
                    placeholder="•••••••• (min 8 characters)" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-white/30"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full bg-white text-black hover:bg-gray-200 h-11 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Accept Invitation"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
