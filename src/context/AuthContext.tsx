

"use client";

import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { User, LoginResult, CnpjAddressInfo, CompanyProfile, PricingSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ObjectId } from 'mongodb';
import useLocalStorage from '@/hooks/use-local-storage';
import { initialPricingSettings } from '@/lib/data';
import { APP_VERSION, VERSION_KEY } from '@/lib/version';


interface AuthContextType {
  user: User | null;
  companyProfile: CompanyProfile | null;
  pricingSettings: PricingSettings | null;
  loading: boolean;
  unreadChatCount: number;
  operationalAlertCount: number;
  receivingAlertCount: number;
  expenseAlertCount: number;
  billingAlertCount: number;
  notificationPermission: NotificationPermission | null;
  openPopupIds: string[];
  setOpenPopupIds: React.Dispatch<React.SetStateAction<string[]>>;
  requestNotificationPermission: () => Promise<void>;
  refreshNotificationCounts: () => void;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  updateUser: (id: string, data: Partial<User>) => Promise<boolean>;
  uploadProfilePicture: (userId: string, file: File) => Promise<string | null>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  sendPasswordResetEmail: (email: string) => Promise<boolean>;
  fetchAddressByCnpj: (cnpj: string) => Promise<CnpjAddressInfo | null>;
  fetchAddressByCep: (cep: string) => Promise<any | null>;
  completeFirstLoginTutorial: () => void;
  refreshCompanyProfile: () => void;
  refreshPricingSettings: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [operationalAlertCount, setOperationalAlertCount] = useState(0);
  const [receivingAlertCount, setReceivingAlertCount] = useState(0);
  const [expenseAlertCount, setExpenseAlertCount] = useState(0);
  const [billingAlertCount, setBillingAlertCount] = useState(0);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [lastLoggedInUser, setLastLoggedInUser] = useLocalStorage<Partial<User> & { identifier?: string } | null>('lastLoggedInUser', null);
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  const [openPopupIds, _setOpenPopupIds] = useState<string[]>([]);

  // Wrap the setter to also update localStorage
  const setOpenPopupIds = useCallback((value: React.SetStateAction<string[]>) => {
    _setOpenPopupIds(currentIds => {
      const newIds = typeof value === 'function' ? value(currentIds) : value;
      if (user?.id) {
        localStorage.setItem(`openChatPopupIds_${user.id}`, JSON.stringify(newIds));
      }
      return newIds;
    });
  }, [user?.id]);

  // Load from localStorage when user changes
  useEffect(() => {
    if (user?.id) {
      const storedIdsRaw = localStorage.getItem(`openChatPopupIds_${user.id}`);
      if (storedIdsRaw) {
        try {
          const storedIds = JSON.parse(storedIdsRaw);
          _setOpenPopupIds(storedIds);
        } catch (e) {
          _setOpenPopupIds(['launcher']);
        }
      } else {
        _setOpenPopupIds(['launcher']);
      }
    } else {
      _setOpenPopupIds([]);
    }
  }, [user?.id]);


  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        toast({ title: 'Navegador não suportado', description: 'O seu navegador não suporta notificações.', variant: 'destructive'});
        return;
    }

    if (Notification.permission === 'granted') {
        toast({ title: 'Permissão já concedida'});
        return;
    }

    if (Notification.permission === 'denied') {
        toast({ title: 'Permissão bloqueada', description: 'Por favor, habilite as notificações nas configurações do seu navegador.', variant: 'destructive'});
        return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
        new Notification('Notificações Ativadas!', {
            body: 'Você receberá alertas e novas mensagens por aqui.',
            icon: '/icon.svg'
        });
    }
  }, [toast]);
  
   const showNotification = useCallback((title: string, options: NotificationOptions) => {
    if (notificationPermission !== 'granted') return;
    
    // Check if the tab is active/visible
    if(document.hidden) {
      new Notification(title, {
          ...options,
          icon: '/icon.svg',
          badge: '/icon.svg',
      });
    }
  }, [notificationPermission]);

  const fetchEssentialData = useCallback(async () => {
      try {
        const [companyProfileRes, pricingSettingsRes] = await Promise.all([
          fetch('/api/company-profile/default', { cache: 'no-store' }),
          fetch('/api/settings/pricing', { cache: 'no-store' }),
        ]);

        if (companyProfileRes.ok) {
            const profile = await companyProfileRes.json();
            setCompanyProfile(profile);
        } else {
            setCompanyProfile(null);
        }

        const pricing = pricingSettingsRes.ok ? await pricingSettingsRes.json() : initialPricingSettings;
        setPricingSettings(pricing);
      } catch (e) {
        console.error("Failed to fetch essential data", e)
        setPricingSettings(initialPricingSettings); // Fallback to initial settings on error
      }
  }, []);

  const refreshPricingSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/pricing', { cache: 'no-store' });
      if (response.ok) {
        const pricing = await response.json();
        setPricingSettings(pricing);
      }
    } catch (error) {
      console.error("Failed to refresh pricing settings", error);
    }
  }, []);

  const refreshCompanyProfile = useCallback(async () => {
    try {
        const companyProfileRes = await fetch('/api/company-profile/default', { cache: 'no-store' });
        if (companyProfileRes.ok) {
            const profile = await companyProfileRes.json();
            setCompanyProfile(profile);
        } else {
            setCompanyProfile(null);
        }
    } catch (e) {
        console.error("Failed to refresh company profile", e);
    }
  }, []);

   const refreshNotificationCounts = useCallback(async () => {
    if (!user) {
      setUnreadChatCount(0);
      setOperationalAlertCount(0);
      setReceivingAlertCount(0);
      setExpenseAlertCount(0);
      setBillingAlertCount(0);
      return;
    }
    try {
        const [chatRes, alertsRes] = await Promise.all([
            user.chatEnabled ? fetch(`/api/chat/unread-count?userId=${user.id}`) : Promise.resolve(null),
            (user.operationalAccess || user.expensesAccess) ? fetch(`/api/dashboard/alerts`) : Promise.resolve(null),
        ]);
      
        if (chatRes && chatRes.ok) {
            const data = await chatRes.json();
            const newCount = data.count || 0;
            setUnreadChatCount(prevCount => {
                if (newCount > prevCount && pathname !== '/chat') {
                    showNotification('Nova Mensagem no Chat', { body: `Você tem ${newCount} mensagens não lidas.` });
                }
                return newCount;
            });
        }

        if (alertsRes && alertsRes.ok) {
            const data = await alertsRes.json();
            const newOpCount = data.operationalAlertCount || 0;
            const newReceivingCount = data.receivingAlertCount || 0;
            const newExpenseCount = data.expenseAlertCount || 0;
            const newBillingCount = data.billingAlertCount || 0;

            setOperationalAlertCount(prevCount => {
                if (newOpCount > prevCount) {
                    showNotification('Alerta Operacional', { body: `Você tem ${newOpCount} pendências operacionais.` });
                }
                return newOpCount;
            });

            setReceivingAlertCount(prevCount => {
                if (newReceivingCount > prevCount) {
                    showNotification('Alerta de Recebimento', { body: `Você tem ${newReceivingCount} alertas no galpão.` });
                }
                return newReceivingCount;
            });

            setExpenseAlertCount(prevCount => {
                if (newExpenseCount > prevCount && !pathname.startsWith('/financial')) {
                    showNotification('Alerta de Despesa', { body: `Você tem ${newExpenseCount} despesas próximas do vencimento.` });
                }
                return newExpenseCount;
            });
            
            setBillingAlertCount(prevCount => {
                if (newBillingCount > prevCount && !pathname.startsWith('/financial')) {
                    showNotification('Alerta de Cobrança', { body: `Você tem ${newBillingCount} cobranças próximas do vencimento.` });
                }
                return newBillingCount;
            });
        }

    } catch (error) {
      console.error("Failed to fetch notification counts:", error);
    }
  }, [user, showNotification, pathname]);

  const checkUserSession = useCallback(async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        setUser(null);
        return;
      }
      const response = await fetch('/api/auth/me', { 
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        setUser(null);
        localStorage.removeItem('sessionToken');
        return;
      }
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error("Erro ao validar sessão:", error);
      setUser(null);
      localStorage.removeItem('sessionToken');
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);

      // ── Controle de Versão: Purga de dados obsoletos ──
      if (typeof window !== 'undefined') {
        const storedVersion = localStorage.getItem(VERSION_KEY);
        if (storedVersion !== APP_VERSION) {
          console.info(`[VersionControl] Atualização detectada: ${storedVersion || '(nenhuma)'} → ${APP_VERSION}. Limpando dados antigos...`);

          // Preservar o token de sessão para não derrubar o usuário logado
          const currentToken = localStorage.getItem('sessionToken');

          // 1. Limpar todo o localStorage
          localStorage.clear();

          // 2. Re-inserir o token se existia
          if (currentToken) {
            localStorage.setItem('sessionToken', currentToken);
          }

          // 3. Limpar todos os cookies (exceto essenciais httpOnly que o JS não consegue ver)
          document.cookie.split(';').forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            if (name) {
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            }
          });

          // 4. Gravar a versão atual
          localStorage.setItem(VERSION_KEY, APP_VERSION);

          console.info(`[VersionControl] Limpeza concluída. Versão ${APP_VERSION} registrada.`);
        }
      }

      // Run both in parallel
      const sessionPromise = checkUserSession();
      const essentialDataPromise = fetchEssentialData();
      
      await Promise.all([
        sessionPromise,
        essentialDataPromise,
      ]);

      setLoading(false);
    };
    initializeApp();
  }, [checkUserSession, fetchEssentialData]);
  
  useEffect(() => {
    if (user) {
      refreshNotificationCounts();
      const interval = setInterval(refreshNotificationCounts, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, refreshNotificationCounts]);
  
   useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (
      user.role === 'admin' &&
      !companyProfile &&
      pathname !== '/settings/companies'
    ) {
      router.push('/settings/companies?first-login=true');
      return;
    }

    // Segurança: Se um admin/user estiver em uma rota de cliente, redirecionar
    const isClient = user.role === 'cliente' || user.role === 'sub-cliente';
    if (!isClient && pathname.startsWith('/cliente')) {
      router.replace('/dashboard');
      return;
    }

    if (pathname === '/' || pathname === '/driver-login') {
      const redirectPath =
        user.role === 'driver'
          ? '/driver-portal'
          : isClient
          ? '/cliente/dashboard'
          : searchParams.get('redirect') || '/dashboard';
      router.push(redirectPath);
    }
  }, [user, loading, companyProfile, router, searchParams, pathname]);

  const login = useCallback(async (identifier: string, password: string): Promise<LoginResult> => {
    const isCpf = /^\d{11,}$/.test(identifier.replace(/[^\d]/g, ''));
    const apiEndpoint = isCpf ? '/api/auth/driver-login' : '/api/auth/login';
    const body = isCpf ? { cpf: identifier, password } : { email: identifier, password };
    
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result: LoginResult = await response.json();
      
      if (response.ok && result.token && result.user) {
        localStorage.setItem('sessionToken', result.token);
        
        // Fetch essential data BEFORE setting the user to avoid race condition
        await fetchEssentialData();

        setUser(result.user as User);
        setLastLoggedInUser({ identifier: isCpf ? identifier : (result.user as any).email, username: result.user.username, avatarUrl: result.user.avatarUrl });
        
        return { status: 'success', user: result.user, token: result.token };
      } else {
        return { status: result.status || 'error', message: result.message };
      }
    } catch (error: any) {
        return { status: 'error', message: 'Falha de rede. Não foi possível conectar ao servidor.' };
    }
  }, [setLastLoggedInUser, fetchEssentialData]);

  const logout = useCallback(() => {
    setUser(null);
    setCompanyProfile(null);
    setPricingSettings(null);
    setOpenPopupIds([]);
    localStorage.removeItem('sessionToken');
    // IMPORTANTE: Usar hard navigation para resetar completamente o estado da aplicação.
    // router.push('/') faz soft navigation e pode causar race condition no redirect
    // quando um novo usuário faz login antes da navegação completar.
    window.location.href = '/';
  }, [setOpenPopupIds]);


  const updateUser = useCallback(async (id: string, data: Partial<User>): Promise<boolean> => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
       if(response.ok) {
          if (id === user?.id) {
             const updatedUserData = await response.json();
             setUser(updatedUserData.user);
          }
          return true;
      }
      return false;
    } catch (error) {
      console.error("Update User Error:", error);
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível atualizar o usuário.' });
      return false;
    }
  }, [toast, user?.id]);

  const uploadProfilePicture = useCallback(async (userId: string, file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    try {
        const response = await fetch('/api/users/upload-avatar', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok && result.success) {
            const newAvatarUrl = result.path;
            if(userId === user?.id) {
              setUser(prev => prev ? {...prev, avatarUrl: newAvatarUrl} : null);
            }
            return newAvatarUrl;
        }
        toast({ variant: 'destructive', title: 'Erro de Upload', description: result.message });
        return null;
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Erro de Rede', description: `Não foi possível carregar a imagem: ${error.message}` });
        return null;
    }
  }, [toast, user?.id]);

  const changeUserPassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if(!user) return false;
    try {
      const response = await fetch(`/api/users/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword, newPassword }),
      });
      return response.ok;
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível alterar a palavra-passe.' });
      return false;
    }
  }, [user, toast]);

    const sendPasswordResetEmail = useCallback(async (email: string): Promise<boolean> => {
        toast({ title: "Funcionalidade não implementada." });
        return Promise.resolve(false);
    }, [toast]);

    const fetchAddressByCnpj = useCallback(async (cnpj: string): Promise<CnpjAddressInfo | null> => {
        try {
            const token = localStorage.getItem('sessionToken');
            const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch(`/api/cnpj/${cnpj}`, { headers });
            if (!response.ok) {
                // Safe error parsing: read as text first to avoid JSON parse exceptions
                // on plain-text responses (e.g. "Too Many Requests" from upstream APIs)
                const rawText = await response.text();
                let errorMessage = 'Serviço indisponível.';
                try {
                    const errorData = JSON.parse(rawText);
                    errorMessage = errorData.message || errorMessage;
                } catch {
                    // Body was plain text (e.g. "Too Many Requests") — use status-based message
                    if (response.status === 429) {
                        errorMessage = 'Limite de consultas atingido. Aguarde alguns segundos e tente novamente.';
                    } else if (response.status === 404) {
                        errorMessage = 'CNPJ não encontrado.';
                    } else if (rawText) {
                        errorMessage = rawText.substring(0, 120);
                    }
                }
                toast({ variant: 'destructive', title: 'Erro ao buscar CNPJ', description: errorMessage });
                return null;
            }
            return await response.json();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar ao serviço de CNPJ.' });
            return null;
        }
    }, [toast]);

    const fetchAddressByCep = useCallback(async (cep: string): Promise<any | null> => {
      try {
          const response = await fetch(`/api/cep/${cep}`);
          if (!response.ok) {
              const rawText = await response.text();
              let errorMessage = 'Serviço indisponível.';
              try {
                  const errorData = JSON.parse(rawText);
                  errorMessage = errorData.message || errorMessage;
              } catch {
                  if (response.status === 429) {
                      errorMessage = 'Limite de consultas atingido. Aguarde alguns segundos.';
                  } else if (response.status === 404) {
                      errorMessage = 'CEP não encontrado.';
                  } else if (rawText) {
                      errorMessage = rawText.substring(0, 120);
                  }
              }
              toast({ variant: 'destructive', title: 'Erro ao buscar CEP', description: errorMessage });
              return null;
          }
          return await response.json();
      } catch (error) {
          toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível conectar ao serviço de CEP.' });
          return null;
      }
  }, [toast]);
  
  const completeFirstLoginTutorial = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstLogin: false }),
      });
      if (response.ok) {
        setUser(prev => prev ? { ...prev, firstLogin: false } : null);
      } else {
        throw new Error('Falha ao atualizar o status de primeiro login.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
      console.error("Failed to update first login status:", error);
    }
  }, [user, toast]);

    const contextValue: AuthContextType = useMemo(() => ({
        user,
        companyProfile,
        pricingSettings,
        loading,
        unreadChatCount,
        operationalAlertCount,
        receivingAlertCount,
        expenseAlertCount,
        billingAlertCount,
        notificationPermission,
        openPopupIds,
        setOpenPopupIds,
        requestNotificationPermission,
        refreshNotificationCounts,
        login,
        logout,
        updateUser,
        uploadProfilePicture,
        changeUserPassword,
        sendPasswordResetEmail,
        fetchAddressByCnpj,
        fetchAddressByCep,
        completeFirstLoginTutorial,
        refreshCompanyProfile,
        refreshPricingSettings,
    }), [
        user, companyProfile, pricingSettings, loading, unreadChatCount, operationalAlertCount, receivingAlertCount, expenseAlertCount, billingAlertCount, notificationPermission, openPopupIds, setOpenPopupIds,
        requestNotificationPermission, refreshNotificationCounts,
        login, logout, updateUser, uploadProfilePicture, changeUserPassword, sendPasswordResetEmail, fetchAddressByCnpj, fetchAddressByCep, completeFirstLoginTutorial, refreshCompanyProfile, refreshPricingSettings
    ]);

    return (
        <AuthContext.Provider value={contextValue as any}>
            {children}
        </AuthContext.Provider>
    );
};
