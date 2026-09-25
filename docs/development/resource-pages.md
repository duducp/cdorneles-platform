# Páginas de recurso: listagem, forms e permissões

Como criar páginas no padrão da plataforma (estilo Django admin). A **listagem
sempre existe**; create, update e delete são opcionais e só aparecem quando a
permissão correspondente foi concedida.

## Padrão de URL

| Operação | URL                        | Obrigatória?                                      |
| -------- | -------------------------- | ------------------------------------------------- |
| Listar   | `/grupo/recurso`           | Sim — toda página começa aqui                     |
| Criar    | `/grupo/recurso/add`       | Opcional (permissão `recurso.create`)             |
| Editar   | `/grupo/recurso/<id>/change` | Opcional (permissão `recurso.update` + API)     |
| Apagar   | ação na listagem ou na página de edição | Opcional (permissão `recurso.delete`) |

- O **grupo** (`/admin`, `/crm`) tem uma página de índice listando seus
  recursos visíveis — como a home do admin do Django.
- `dashboard` e `settings` ficam **fora de grupos** de propósito: não são
  recursos de negócio.

## O registro central de rotas (`routes.ts`)

Toda a navegação deriva de **um único arquivo por app**:
`packages/app/src/routes.ts` (`ADMIN_ROUTES`, `CLIENT_ROUTES`). Cada grupo e
página declara:

```ts
{
  kind: "page",
  href: "/admin/users",
  label: "Usuários",                    // sidebar, breadcrumbs, índice
  description: "Pessoas com acesso…",   // visível no índice do grupo
  tags: ["admin", "users", "iam"],      // classificação p/ filtros futuros
  permissions: { allOf: [permissionKey("users.read")] },
  icon: Users,
}
```

Consumidores do registry (não duplique nada disso à mão):

| Consumo                     | De onde vem                                   |
| --------------------------- | --------------------------------------------- |
| Sidebar (itens e seções)    | `createShellLayout({ routes })` → `toNavItems` |
| Breadcrumbs (inclui "Novo"/"Editar" para `add`/`change`) | `deriveTrail(pathname, navItems, routes)` |
| Índice do grupo             | `groupIndexItems(group)` + `<GroupIndex>`     |
| Filtro por permissão        | `visibleRoutes(routes, checker)`              |

### Como adicionar um recurso novo (exemplo: `/admin/invoices`)

1. **`packages/app/src/routes.ts`** — adicione a página ao grupo desejado
   (ou crie um grupo novo) com `label`, `description`, `tags`, `permissions`
   e `icon`.
2. **`packages/app/src/<recurso>-list-page.tsx`** — crie a página de listagem
   (veja o esqueleto abaixo).
3. **Rotas Next** — crie `apps/<app>/src/app/(shell)/admin/<recurso>/page.tsx`
   exportando a página; adicione `add/page.tsx` e `[id]/change/page.tsx` só se
   a operação existir.
4. **Permissões** — garanta que `recurso.read` (e as demais) existam no seed
   (`packages/provisioning`) e nas roles; a UI filtra sozinha.

## Esqueleto da página de listagem

```tsx
"use client";

import { permissionKey } from "@cdorneles/permissions";
import { Button, DataTable, EmptyState, PageBody, PageContainer } from "@cdorneles/ui";
import { PermissionGate } from "@cdorneles/ui/permissions";
import { Plus } from "lucide-react";
import Link from "next/link";

export function InvoicesListPage({ linkComponent: Link }: Props) {
  return (
    <PageContainer py="xl">
      <PageBody
        title="Faturas"
        description="O que a página faz."            {/* vira description do breadcrumb/índice */}
        action={
          {/* botão de create SÓ com a permissão */}
          <PermissionGate permission={permissionKey("invoices.create")}>
            <Button component={Link} href="add" leftSection={<Plus size={16} />}>
              Nova fatura
            </Button>
          </PermissionGate>
        }
        toolbar={/* busca, contagem, filtros — opcional */}
      >
        {/* A listagem em si é gated por recurso.read */}
        <PermissionGate
          permission={permissionKey("invoices.read")}
          fallback={<EmptyState title="Acesso negado" description="…" />}
        >
          {/* vazio | loading | erro | tabela */}
          <DataTable data={rows} columns={columns} withBorder={false} />
        </PermissionGate>
      </PageBody>
    </PageContainer>
  );
}
```

Regras do esqueleto:

- **`PageBody`** já desenha o painel console (título + action row + toolbar +
  conteúdo). Passe `withBorder={false}` ao `DataTable` — o painel já tem borda.
- **Listagem sempre presente** dentro do gate de `recurso.read`; os estados
  vazio/erro/loading moram dentro dela.
- **Ações condicionais por permissão**: o botão de create usa
  `<PermissionGate permission={…("recurso.create")}>`; ações de linha (editar/
  apagar) usam `recurso.update`/`recurso.delete`. Frontend é UX only — o
  servidor reautoriza (Functions).
- **Formulários**: submit sempre habilitado, validação no submit
  (`noValidate`), erro inline no `FormError` compartilhado. Nunca desabilite o
  submit porque faltam campos (esconde o porquê).

## Páginas dedicadas de create e edit

- **`/add`**: página própria com o form (veja `packages/app/src/users-add-page.tsx`),
  gated por `recurso.create`, estado de sucesso com `EmptyState` após criar.
- **`/<id>/change`**: `async function Page({ params })` com `await params`
  (Next 16), gated por `recurso.update`. Enquanto a API não expõe leitura/
  update individual, a página renderiza o shell com o id (veja
  `users-change-page.tsx`).
- **Delete**: ação na listagem (menu de linha) ou na página de edição, gated
  por `recurso.delete`, com confirmação explícita.

## Referência viva

- `packages/app/src/routes.ts` — registry com os recursos atuais.
- `packages/app/src/users-list-page.tsx` / `users-add-page.tsx` /
  `users-change-page.tsx` — o trio completo.
- `packages/ui/src/shell/route-registry.ts` — tipos e helpers.
- `packages/ui/src/shell/group-index.tsx` — índice do grupo.
