"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound, ShieldCheck, Sparkles, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";

export function OnboardingWizard({ isOpen, onComplete, isAdmin = true, needsSetup = false }: { isOpen: boolean, onComplete: () => void, isAdmin?: boolean, needsSetup?: boolean }) {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  const generateResources = async () => {
    setIsGenerating(true);
    try {
      // Create a default API Key
      const keyRes = await fetch("/api/onboarding/generate-key", { method: "POST" });
      if (!keyRes.ok) throw new Error("Failed to generate key");
      const keyData = await keyRes.json();
      setApiKey(keyData.key);
      setStep(2);
    } catch (e) {
      toast.error("Failed to set up resources");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("API Key copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const showMemberWelcome = !isAdmin || (isAdmin && !needsSetup);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg bg-black border border-white/10 text-white [&>button]:hidden">
        <AnimatePresence mode="wait">
          {showMemberWelcome && (
            <motion.div
              key="step-member"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 text-center py-6"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white mb-2">Welcome to the Workspace</DialogTitle>
                <DialogDescription className="text-muted-foreground text-base px-6">
                  You have successfully joined the organization. The workspace is already set up, and you can now view policies and audit logs.
                </DialogDescription>
              </div>
              <Button 
                onClick={onComplete} 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white h-12 text-md font-medium"
              >
                Go to Dashboard
              </Button>
            </motion.div>
          )}

          {!showMemberWelcome && step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 text-center py-6"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white mb-2">Welcome to PromptWall</DialogTitle>
                <DialogDescription className="text-muted-foreground text-base px-6">
                  Let's get you set up. We'll automatically generate your first API key and a default security policy to block prompt injections.
                </DialogDescription>
              </div>
              <Button 
                onClick={generateResources} 
                disabled={isGenerating}
                className="w-full bg-white text-black hover:bg-gray-200 h-12 text-md font-medium"
              >
                {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Quick Start"}
              </Button>
            </motion.div>
          )}

          {!showMemberWelcome && step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 py-4"
            >
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <DialogTitle className="text-xl font-bold text-white mb-2">You're all set!</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Your default policy is active and your API key is ready.
                </DialogDescription>
              </div>

              <div className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">Your API Key (Save this now)</span>
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={apiKey} 
                    readOnly 
                    className="font-mono bg-black/40 border-white/10 text-white" 
                  />
                  <Button variant="outline" className="border-white/10 text-white bg-transparent hover:bg-white/5" onClick={copyToClipboard}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                  <ShieldCheck className="w-3 h-3" />
                  A default prompt injection policy has also been created.
                </p>
              </div>

              <Button 
                onClick={() => {
                  onComplete();
                  window.location.reload();
                }} 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white h-12"
              >
                Go to Dashboard
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
