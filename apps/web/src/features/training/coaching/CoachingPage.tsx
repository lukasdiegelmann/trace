/** The Coaching screens, for trainers and admins (Coaching.svelte) */
import { useParams } from "react-router";

import { ClientDetail } from "./ClientDetail";
import { ClientList } from "./ClientList";

export function CoachingPage() {
  const { memberId } = useParams();
  return (
    <>
      {memberId === undefined ? (
        <ClientList />
      ) : (
        <ClientDetail key={memberId} memberId={Number(memberId)} />
      )}
    </>
  );
}
