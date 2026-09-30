import { UsersChangePage } from "@cdorneles/app";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UsersChangePage userId={id} />;
}
