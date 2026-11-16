"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { CONTENT_APPROVAL_POLICY, CONTENT_APPROVAL_POLICY_API_PATHS } from "@/lib/constants";
import type { BrandListItem } from "@/lib/validation/brands";

type PolicyData = { defaultRequiredApprovals: number; brandOverrides: { brandId: string; brandName: string; requiredApprovals: number }[] };
const INITIAL_POLICY: PolicyData = { defaultRequiredApprovals: CONTENT_APPROVAL_POLICY.defaultRequiredApprovals, brandOverrides: [] };
const APPROVAL_OPTIONS = Array.from({ length: CONTENT_APPROVAL_POLICY.maximumRequiredApprovals }, (_, index) => index + 1);

export function ApprovalPolicySettings({ brands }: { brands: BrandListItem[] }) {
  const t = useTranslations("approvalPolicy");
  const [policy, setPolicy] = useState(INITIAL_POLICY);
  const [scope, setScope] = useState("");
  const [value, setValue] = useState(String(INITIAL_POLICY.defaultRequiredApprovals));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(CONTENT_APPROVAL_POLICY_API_PATHS.collection, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); const result = await response.json() as { data: PolicyData }; setPolicy(result.data); setValue(String(result.data.defaultRequiredApprovals)); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(t("loadError")); });
    return () => controller.abort();
  }, [t]);

  async function save(brandId: string | null) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(CONTENT_APPROVAL_POLICY_API_PATHS.collection, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId, requiredApprovals: Number(value) }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { data: PolicyData };
      setPolicy(result.data); setMessage(t("saved"));
    } catch { setMessage(t("saveError")); } finally { setBusy(false); }
  }

  async function reset(brandId: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(CONTENT_APPROVAL_POLICY_API_PATHS.collection, { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { data: PolicyData };
      setPolicy(result.data); setMessage(t("saved"));
    } catch { setMessage(t("saveError")); } finally { setBusy(false); }
  }

  const selectedBrandId = scope || null;
  return <section className="teamSection__policy" aria-labelledby="approval-policy-title">
    <h3 id="approval-policy-title">{t("title")}</h3><p>{t("description")}</p>
    <div className="teamCollection__actions">
      <SelectField id="approval-policy-scope" label={t("scope")} value={scope} disabled={busy} onChange={(event) => {
        const nextScope = event.target.value;
        setScope(nextScope);
        setValue(String(nextScope ? policy.brandOverrides.find((override) => override.brandId === nextScope)?.requiredApprovals ?? policy.defaultRequiredApprovals : policy.defaultRequiredApprovals));
      }}>
        <option value="">{t("organization")}</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </SelectField>
      <SelectField id="approval-policy-count" label={t("count")} value={value} disabled={busy} onChange={(event) => setValue(event.target.value)}>
        {APPROVAL_OPTIONS.map((count) => <option key={count} value={count}>{count}</option>)}
      </SelectField>
      <Button type="button" disabled={busy} onClick={() => void save(selectedBrandId)}>{t("save")}</Button>
    </div>
    <ul>{policy.brandOverrides.map((override) => <li key={override.brandId} className="teamCollection__actions"><span>{t("overrideSummary", { brand: override.brandName, count: override.requiredApprovals })}</span><Button appearance="quiet" type="button" disabled={busy} onClick={() => void reset(override.brandId)}>{t("reset")}</Button></li>)}</ul>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
