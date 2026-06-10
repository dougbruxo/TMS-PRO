
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoginResult } from '@/lib/types';

const formSchema = z.object({
  identifier: z.string().min(1, { message: 'E-mail ou CPF é obrigatório.' }),
  password: z.string().min(1, { message: 'Senha é obrigatória.' }),
});

interface LoginFormProps {
  onLogin: (identifier: string, password: string) => Promise<LoginResult>;
  prefilledIdentifier?: string | null;
}

export function LoginForm({ onLogin, prefilledIdentifier }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      identifier: prefilledIdentifier || '',
      password: '',
    },
  });

  useEffect(() => {
    if (prefilledIdentifier) {
      form.setValue('identifier', prefilledIdentifier);
    }
  }, [prefilledIdentifier, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    
    const result = await onLogin(values.identifier, values.password);
    
    if (result.status === 'success') {
        toast({
            title: 'Login bem-sucedido!',
            description: 'Bem-vindo(a) ao sistema DezLog.',
        });
    } else if (result.status === 'disabled') {
         toast({
            variant: 'destructive',
            title: 'Acesso Negado',
            description: 'Sua conta está desabilitada. Entre em contato com o administrador.',
        });
    } else if (result.status === 'invalid-credentials') {
        toast({
            variant: 'destructive',
            title: 'Erro de Autenticação',
            description: 'E-mail/CPF ou senha inválidos.',
        });
    } else if (result.status === 'db-connection-error') {
        toast({
            variant: 'destructive',
            title: 'Erro de Conexão com a Base de Dados',
            description: result.message || 'Não foi possível conectar à base de dados. Verifique se o serviço MongoDB está em execução.',
            duration: 9000,
        });
    } else { // 'error'
       toast({
            variant: 'destructive',
            title: 'Erro no Sistema',
            description: result.message || 'Não foi possível realizar o login. Tente novamente mais tarde.',
        });
    }

    setIsLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-primary font-semibold">E-mail ou CPF</FormLabel>
              <FormControl>
                <Input placeholder="seu@email.com ou 123.456.789-00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-primary font-semibold">Senha</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Sua senha" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
            type="submit" 
            className={cn(
                "w-full text-lg font-semibold tracking-wider",
                "bg-gradient-to-r from-primary to-accent text-primary-foreground",
                "hover:brightness-110 hover:shadow-lg transition-all duration-300",
                "disabled:bg-muted"
            )} 
            disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
    </Form>
  );
}
