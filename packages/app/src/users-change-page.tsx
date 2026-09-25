"use client";

import { EmptyState, PageBody, PageContainer } from "@cdorneles/ui";

/**
 * The `/users/<id>/change` route. The platform API does not expose a
 * user-by-id read/update yet, so the page renders the URL-pattern shell with
 * the id resolved from the route; wiring the form is a matter of calling the
 * API once it exists.
 */
export function UsersChangePage({ userId }: { userId: string }) {
  return (
    <PageContainer py="xl">
      <PageBody title="Editar usuário" description={`Edição do usuário ${userId}.`}>
        <EmptyState
          title="Edição em preparação"
          description="A API de plataforma ainda não expõe leitura e atualização por usuário. A rota já segue o padrão /users/<id>/change."
        />
      </PageBody>
    </PageContainer>
  );
}
