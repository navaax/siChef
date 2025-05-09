
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { User, KeyRound, ChevronLeft } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, "Nombre de usuario es requerido"),
  pin: z.string().length(4, "PIN debe tener exactamente 4 dígitos").regex(/^\d{4}$/, "PIN debe contener solo dígitos"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [savedUsers, setSavedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { login } = useAuth();

  // Load saved usernames from localStorage on mount
  useEffect(() => {
    const users: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('siChefPin_')) {
        users.push(key.replace('siChefPin_', ''));
      }
    }
    setSavedUsers(users);
    // If no saved users, default to showing the manual form
    if (users.length === 0) {
      setShowManualForm(true);
    }
  }, []);


  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      pin: "",
    },
  });

  // Handles login from the standard username/PIN form
  const onSubmitManual = async (data: LoginFormValues) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

    const storedPin = localStorage.getItem(`siChefPin_${data.username}`);
    if (storedPin && storedPin === data.pin) {
      login(data.username);
      toast({
        title: "Inicio de Sesión Exitoso",
        description: `¡Bienvenido de nuevo, ${data.username}!`,
      });
      router.push('/dashboard/home');
    } else {
      toast({
        variant: "destructive",
        title: "Inicio de Sesión Fallido",
        description: "Nombre de usuario o PIN inválido.",
      });
    }
    setIsLoading(false);
  };

  // Handles login after selecting a user and entering PIN
  const handlePinLogin = async () => {
    if (!selectedUser || pinInput.length !== 4) {
       toast({
        variant: "destructive",
        title: "PIN Inválido",
        description: "Por favor, introduce un PIN de 4 dígitos.",
      });
      return;
    }
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

    const storedPin = localStorage.getItem(`siChefPin_${selectedUser}`);
    if (storedPin && storedPin === pinInput) {
      login(selectedUser);
      toast({
        title: "Inicio de Sesión Exitoso",
        description: `¡Bienvenido de nuevo, ${selectedUser}!`,
      });
      router.push('/dashboard/home');
    } else {
      toast({
        variant: "destructive",
        title: "Inicio de Sesión Fallido",
        description: "PIN incorrecto.",
      });
       // Consider clearing pinInput here if desired
       setPinInput('');
    }
    setIsLoading(false);
  };

  const handleUserSelect = (username: string) => {
    setSelectedUser(username);
    setPinInput(''); // Clear PIN input when selecting a user
    setShowManualForm(false); // Hide manual form if a user is selected
  };

  const handleGoBack = () => {
    setSelectedUser(null);
    setPinInput('');
    // If there were saved users, go back to the user list, otherwise show the form
    if (savedUsers.length > 0) {
      setShowManualForm(false);
    } else {
      setShowManualForm(true);
    }
  };

  const handleShowManualForm = () => {
    setSelectedUser(null);
    setShowManualForm(true);
  };

  // Renders the list of saved user profiles
  const renderUserSelection = () => (
    <div className='space-y-4'>
       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {savedUsers.map(user => (
          <Button
            key={user}
            variant="outline"
            className="flex flex-col items-center justify-center h-24 p-4 text-center"
            onClick={() => handleUserSelect(user)}
          >
            <User className="h-8 w-8 mb-2 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{user}</span>
          </Button>
        ))}
      </div>
       <Button variant="link" onClick={handleShowManualForm} className="w-full">
            Iniciar sesión con otro usuario
       </Button>
    </div>
  );

  // Renders the PIN input for a selected user
  const renderPinInput = () => (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={handleGoBack} className="absolute top-4 left-4 text-muted-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" /> Volver
      </Button>
      <div className="flex flex-col items-center text-center pt-8">
        <User className="h-12 w-12 mb-2 text-primary" />
        <p className="text-lg font-semibold">{selectedUser}</p>
        <p className="text-sm text-muted-foreground mb-4">Introduce tu PIN</p>
        <div className="flex justify-center gap-2 mb-4">
           {/* Basic password input for PIN */}
           <Input
            type="password"
            maxLength={4}
            value={pinInput}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, ''); // Only allow digits
              setPinInput(value);
              if (value.length === 4) {
                 // Optional: Auto-submit when 4 digits are entered
                 // handlePinLogin();
              }
            }}
            placeholder="----"
            className="w-32 text-center tracking-[0.5em] text-2xl font-mono"
            autoFocus
            inputMode='numeric'
          />
          {/* Alternative: Could implement 4 separate inputs here */}
        </div>
        <Button onClick={handlePinLogin} className="w-full max-w-xs" disabled={isLoading || pinInput.length !== 4}>
          {isLoading ? "Iniciando sesión..." : "Entrar"}
        </Button>
      </div>
    </div>
  );

   // Renders the manual username/PIN form
  const renderManualForm = () => (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitManual)} className="space-y-4">
            {savedUsers.length > 0 && (
                 <Button variant="ghost" size="sm" onClick={handleGoBack} className="absolute top-4 left-4 text-muted-foreground">
                    <ChevronLeft className="mr-1 h-4 w-4" /> Volver a Usuarios
                 </Button>
            )}
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de usuario</FormLabel>
                <FormControl>
                  <Input placeholder="Introduce tu nombre de usuario" {...field} />
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
                <FormLabel>PIN</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Introduce tu PIN de 4 dígitos" maxLength={4} {...field} inputMode='numeric'/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>
        </form>
     </Form>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <h1 className="absolute top-10 text-4xl font-bold opacity-0 animate-fadeInUp">
        siChef
        <span className="align-super text-xs opacity-70">pos c</span>
      </h1>
      <Card className="w-full max-w-md mx-auto shadow-lg relative"> {/* Added relative for back button positioning */}
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">siChef POS - Login</CardTitle>
          {!selectedUser && <CardDescription>
             {showManualForm || savedUsers.length === 0
              ? "Introduce tu nombre de usuario y PIN"
              : "Selecciona tu perfil"}
          </CardDescription>}
        </CardHeader>
        <CardContent>
          {selectedUser ? renderPinInput() : (showManualForm || savedUsers.length === 0 ? renderManualForm() : renderUserSelection())}

          {/* Link to Register (only show if not entering PIN for selected user) */}
          {!selectedUser && (
             <div className="mt-4 text-center text-sm">
                 ¿No tienes cuenta?{" "}
                <Link href="/register" className="underline text-accent">
                 Regístrate
                </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    