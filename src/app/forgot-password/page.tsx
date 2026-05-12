"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/Logo';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, insira um e-mail válido.' }),
});

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    // This is a placeholder. A real implementation would call an API.
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({
        title: 'Funcionalidade em desenvolvimento',
        description: 'A recuperação de senha ainda não foi implementada.',
    });
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-8 left-8">
        <Button variant="outline" onClick={() => router.push('/')}>&larr; Voltar ao Login</Button>
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
            <Logo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recuperar Palavra-passe</CardTitle>
            <CardDescription>
              Insira o seu e-mail abaixo. Se houver uma conta associada, enviaremos um link para redefinir a sua palavra-passe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="seu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Link de Recuperação
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
