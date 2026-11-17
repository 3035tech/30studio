"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type FeedbackTone = "success" | "error" | "info";
type FeedbackItem = { id: number; tone: FeedbackTone; message: string };
type FeedbackContextValue = { showFeedback: (tone: FeedbackTone, message: string) => void };
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function SystemFeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const t = useTranslations("systemFeedback");
  const showFeedback = useCallback((tone: FeedbackTone, message: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 6000);
  }, []);

  return <FeedbackContext.Provider value={{ showFeedback }}>
    {children}
    <div className="systemFeedback" aria-label={t("regionLabel")}>
      {items.map(({ id, tone, message }) => {
        const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : Info;
        return <div className={`systemFeedback__item is-${tone}`} key={id} role={tone === "error" ? "alert" : "status"}>
          <Icon aria-hidden="true" size={19} />
          <p>{message}</p>
          <Button appearance="quiet" className="systemFeedback__dismiss" type="button" aria-label={t("dismiss")} onClick={() => setItems((current) => current.filter((item) => item.id !== id))}><X aria-hidden="true" size={16} /></Button>
        </div>;
      })}
    </div>
  </FeedbackContext.Provider>;
}

export function useSystemFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("System feedback must be used inside SystemFeedbackProvider.");
  return context.showFeedback;
}
