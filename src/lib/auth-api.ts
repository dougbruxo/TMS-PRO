import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'driver' | 'cliente' | 'sub-cliente' | 'parceiro';
  username: string;
  effectiveUserId?: string; // ID da conta principal (Matriz) para multi-tenancy
  parentId?: string;
  subRole?: string;
  clientPortalsAccess?: boolean;
}

/**
 * Extrai e valida o usuário a partir do cabeçalho de Autorização da requisição.
 */
export function getUserFromRequest(request: Request): AuthenticatedUser | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
  } catch (err) {
    return null;
  }
}

/**
 * Retorna o ID que deve ser usado para filtrar dados (o próprio ID se for admin/user/cliente, ou o parentId se for sub-cliente).
 */
export function getTenantId(user: AuthenticatedUser): string {
  // Se for sub-cliente, o tenant é o parentId (mesmo que effectiveUserId no token)
  if (user.role === 'sub-cliente' && (user.parentId || user.effectiveUserId)) {
    return (user.parentId || user.effectiveUserId) as string;
  }
  // Para os demais, o tenant é o seu próprio ID (no caso de cliente) ou nulo se for admin (que vê tudo)
  return user.userId;
}
