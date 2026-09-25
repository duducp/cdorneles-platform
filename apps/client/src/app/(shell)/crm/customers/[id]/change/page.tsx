import { EmptyState, PageBody, PageContainer } from "@cdorneles/ui";

/**
 * The `/customers/<id>/change` route. The customers API does not expose a
 * read/update by id yet, so the page renders the URL-pattern shell with the
 * id resolved from the route.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer py="xl">
      <PageBody title="Editar cliente" description={`Edição do cliente ${id}.`}>
        <EmptyState
          title="Edição em preparação"
          description="A API ainda não expõe leitura e atualização por cliente. A rota já segue o padrão /customers/<id>/change."
        />
      </PageBody>
    </PageContainer>
  );
}
