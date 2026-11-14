import { InvitationAcceptance } from "@/components/workspace/invitation-acceptance";
import { AUTH_QUERY_PARAMETERS, INVITATION_ID_MAX_CHARACTERS } from "@/lib/constants";

type InvitationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AcceptInvitationPage({ searchParams }: InvitationPageProps) {
  const params = await searchParams;
  const invitationId = params[AUTH_QUERY_PARAMETERS.invitationId];
  const normalizedId = typeof invitationId === "string" && invitationId.length <= INVITATION_ID_MAX_CHARACTERS ? invitationId : null;
  return <InvitationAcceptance invitationId={normalizedId} />;
}
