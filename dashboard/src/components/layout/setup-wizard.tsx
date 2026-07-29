"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ShieldCheck, Key, Code } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SetupWizard() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Check if the user has already seen the wizard
    const hasSeenWizard = localStorage.getItem("promptwall_wizard_seen");
    if (!hasSeenWizard) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("promptwall_wizard_seen", "true");
    setIsOpen(false);
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
              <h3 className="font-medium text-white">Welcome to PromptWall</h3>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex justify-center py-6">
                    <div className="rounded-full bg-cyan-500/10 p-6 border border-cyan-500/20">
                      <ShieldCheck className="h-12 w-12 text-cyan-400" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold text-white">Your AI Firewall is Ready</h2>
                    <p className="text-sm text-muted-foreground">
                      PromptWall helps you securely inspect, evaluate, and block prompt injection attacks before they ever reach your LLM backend.
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex justify-center py-6">
                    <div className="rounded-full bg-white/5 p-6 border border-white/10">
                      <Key className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold text-white">Generate an API Key</h2>
                    <p className="text-sm text-muted-foreground">
                      Navigate to the <strong>API Keys</strong> tab to generate a secure cryptographic key. You will use this key to authenticate requests from your Python or Node backend.
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex justify-center py-6">
                    <div className="rounded-full bg-white/5 p-6 border border-white/10">
                      <Code className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold text-white">Integrate & Monitor</h2>
                    <p className="text-sm text-muted-foreground pb-2">
                      Send prompts to your dashboard endpoint. We'll evaluate them instantly against your active policies.
                    </p>
                    <div className="rounded-md bg-black border border-white/10 p-3 text-left overflow-x-auto">
                      <pre className="text-xs text-muted-foreground font-mono">
                        <span className="text-cyan-400">curl</span> -X POST http://localhost:3000/api/evaluate \\<br/>
                        &nbsp;&nbsp;-H <span className="text-emerald-400">"Authorization: Bearer pw_live_..."</span> \\<br/>
                        &nbsp;&nbsp;-d <span className="text-amber-400">'&#123;"prompt": "Ignore all instructions"&#125;'</span>
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-6 py-4">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    step === i ? "bg-white" : "bg-white/20"
                  }`}
                />
              ))}
            </div>
            <Button
              onClick={handleNext}
              className="bg-white text-black hover:bg-gray-200 h-9"
            >
              {step === 3 ? "Get Started" : "Next"}
              {step < 3 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
