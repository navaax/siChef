"use client";

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label"; // Using FormLabel
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from 'lucide-react'; // Icon for registration

const registerSchema = z.object({
  username: z.string().min(3, "Nombre de usuario debe tener al menos 3 caracteres"),
  pin: z.string().min(4, "PIN debe tener al menos 4 dígitos").regex(/^\d+$/, "PIN debe contener solo dígitos"),
  confirmPin: z.string().min(4, "PIN debe tener al menos 4 dígitos"),
}).refine((data) => data.pin === data.confirmPin, {
  message: "Los PINs no coinciden",
  path: ["confirmPin"], 
});


type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      pin: "",
      confirmPin: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (localStorage.getItem(`siChefPin_${data.username}`)) {
       toast({
        variant: "destructive",
        title: "Registro Fallido",
        description: "El nombre de usuario ya existe.",
      });
    } else {
      localStorage.setItem(`siChefPin_${data.username}`, data.pin);

      toast({
        title: "Registro Exitoso",
        description: "Tu cuenta ha sido creada.",
      });
      router.push('/login');
    }

    setIsLoading(false);
  };

  return (
    // Incorporating centering styles from AuthLayout
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-lg"> {/* Container for centering */}
        <Card className="w-full shadow-xl"> {/* Increased shadow */}
          <CardHeader className="space-y-1 text-center">
            <UserPlus className="mx-auto h-10 w-10 text-primary mb-2" /> {/* Icon */}
            <CardTitle className="text-3xl font-bold">Crear Cuenta</CardTitle> {/* Larger title */}
            <CardDescription className="text-md">Regístrate con un nombre de usuario y un PIN seguro.</CardDescription>
          </CardHeader>
          <CardContent className="p-6"> {/* Added padding */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de Usuario</FormLabel>
                      <FormControl>
                        <Input placeholder="Elige un nombre de usuario" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN (mín. 4 dígitos)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Crea un PIN numérico" {...field} inputMode='numeric' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar PIN</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirma tu PIN" {...field} inputMode='numeric' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Registrando..." : "Registrar Cuenta"}
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm">
              ¿Ya tienes una cuenta?{" "}
              <Link href="/login" className="font-semibold text-accent hover:underline">
                Inicia sesión aquí
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
