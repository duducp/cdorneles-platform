import { EmptyState, PageBody, PageContainer } from "@cdorneles/ui";
import { permissionKey } from "@cdorneles/permissions";
import { PermissionGate } from "@cdorneles/ui/permissions";

/**
 * The `/clients/add` route. Client organizations are created through the
 * provisioning flow today; the dedicated form arrives with the API for it.
 */
export default function Page() {
  return (
    <PageContainer py="xl">
      <PageBody title="Novo cliente" description="Cria uma organização cliente.">
        <PermissionGate
          permission={permissionKey("customers.create")}
          fallback={
            <EmptyState
              title="Acesso negado"
              description="Você não tem permissão para criar clientes."
            />
          }
        >
          <EmptyState
            title="Integração em preparação"
            description="A criação de clientes será feita aqui assim que a API de provisionamento expuser o fluxo completo."
          />
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
