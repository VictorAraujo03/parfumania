// Substitutos das importações npm: das Edge Functions, só para os testes (vitest).
export const withSupabase = (_opts: unknown, handler: unknown) => handler;
export const sendNotification = async () => ({ statusCode: 201 });
