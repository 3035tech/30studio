import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { AUTH_QUERY_PARAMETERS, INVITATION_ID_MAX_CHARACTERS } from "@/lib/constants";

type PasswordResetPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: PasswordResetPageProps) {
  const params = await searchParams;
  const invitationId = params[AUTH_QUERY_PARAMETERS.invitationId];
  const returnInvitationId = typeof invitationId === "string" && invitationId.length > 0 && invitationId.length <= INVITATION_ID_MAX_CHARACTERS ? invitationId : null;
  return (
    <PasswordResetForm
      token={typeof params.token === "string" ? params.token : null}
      invalid={typeof params.error === "string"}
      invitationId={returnInvitationId}
    />
  );
}
