// Política de senha do painel admin. Deve espelhar a configuração de
// "Password Requirements" do Supabase (Authentication → Policies):
// mínimo de 8 caracteres com minúscula, maiúscula, número e símbolo.
// Fonte única de verdade compartilhada entre cliente (checklist) e servidor (validação).

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // limite do bcrypt usado pelo Supabase

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `Ao menos ${PASSWORD_MIN_LENGTH} caracteres`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH
  },
  { id: "lower", label: "Uma letra minúscula", test: (password) => /[a-z]/.test(password) },
  { id: "upper", label: "Uma letra maiúscula", test: (password) => /[A-Z]/.test(password) },
  { id: "number", label: "Um número", test: (password) => /[0-9]/.test(password) },
  {
    id: "symbol",
    label: "Um símbolo (ex.: !@#$%)",
    test: (password) => /[^A-Za-z0-9\s]/.test(password)
  }
];

export function evaluatePassword(password: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const rule of PASSWORD_RULES) result[rule.id] = rule.test(password);
  return result;
}

export function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length <= PASSWORD_MAX_LENGTH && PASSWORD_RULES.every((rule) => rule.test(password))
  );
}

// Mensagem do primeiro requisito não atendido, ou null se a senha está OK.
export function passwordPolicyError(password: string): string | null {
  if (password.length > PASSWORD_MAX_LENGTH) return "A nova senha é muito longa.";
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failed ? `A nova senha precisa conter: ${failed.label.toLowerCase()}.` : null;
}
