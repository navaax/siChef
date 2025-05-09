"use client";

import * as React from 'react';
import { useState, useEffect, useRef } from 'react'; // Import useRef
import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label"; // Label from FormLabel is used
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { User, KeyRound, ChevronLeft } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, "Nombre de usuario es requerido"),
  pin: z.string().min(4, "PIN debe tener al menos 4 dígitos").regex(/^\d+$/, "PIN debe contener solo dígitos"),
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
  const hiddenPinInputRef = useRef<HTMLInputElement>(null); // Create ref for hidden PIN input

  useEffect(() => {
    const users: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('siChefPin_')) {
        users.push(key.replace('siChefPin_', ''));
      }
    }
    setSavedUsers(users);
    if (users.length === 0) {
      setShowManualForm(true);
    }
  }, []);

  // Focus the hidden PIN input when a user is selected
  useEffect(() => {
    if (selectedUser && hiddenPinInputRef.current) {
      hiddenPinInputRef.current.focus();
    }
  }, [selectedUser]);


  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      pin: "",
    },
  });

  const onSubmitManual = async (data: LoginFormValues) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));

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

  const handlePinLogin = async () => {
    if (!selectedUser || pinInput.length < 4) {
       toast({
        variant: "destructive",
        title: "PIN Inválido",
        description: "Por favor, introduce un PIN de al menos 4 dígitos.",
      });
      return;
    }
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));

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
       setPinInput(''); // Clear PIN input on failure
       hiddenPinInputRef.current?.focus(); // Re-focus input
    }
    setIsLoading(false);
  };

  const handleUserSelect = (username: string) => {
    setSelectedUser(username);
    setPinInput('');
    setShowManualForm(false);
  };

  const handleGoBack = () => {
    setSelectedUser(null);
    setPinInput('');
    if (savedUsers.length > 0) {
      setShowManualForm(false);
    } else {
      // Should ideally not happen if savedUsers is empty, manual form would be shown
      setShowManualForm(true);
    }
  };

  const handleShowManualForm = () => {
    setSelectedUser(null);
    setShowManualForm(true);
  };

  // Handler to focus the hidden input when the PIN box container is clicked
  const handlePinBoxContainerClick = () => {
    hiddenPinInputRef.current?.focus();
  };

  const renderPinInput = () => (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={handleGoBack} className="absolute top-4 left-4 text-muted-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" /> Volver
      </Button>
      <div className="flex flex-col items-center text-center pt-8">
        <User className="h-16 w-16 mb-3 text-primary" />
        <p className="text-xl font-semibold">{selectedUser}</p>
        <p className="text-md text-muted-foreground mb-6">Introduce tu PIN</p>

        {/* PIN input squares - made clickable */}
        <div
          className="flex justify-center space-x-2 mb-6 cursor-text" // Added cursor-text for better UX
          onClick={handlePinBoxContainerClick} // Focus hidden input on click
          role="button" // Accessibility: treat as a button-like element
          tabIndex={0} // Make it focusable via keyboard
          onKeyDown={(e) => { // Allow focusing with keyboard Enter/Space
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); // Prevent page scroll on Space
              handlePinBoxContainerClick();
            }
          }}
          aria-label="Contenedor de entrada de PIN, haz clic o presiona Enter para escribir"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="w-12 h-14 bg-input/50 rounded-md flex items-center justify-center text-2xl font-mono border border-input pointer-events-none" // pointer-events-none so click goes to parent
            >
              {pinInput[index] ? '•' : ''}
            </div>
          ))}
        </div>
         {/* Hidden actual input for PIN */}
         <Input
            ref={hiddenPinInputRef}
            id="hidden-pin-input" // Added id for potential label association
            type="tel" // Use 'tel' for numeric keypad on mobile
            value={pinInput}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, ''); // Only allow digits
              if (value.length <= 6) setPinInput(value);
            }}
            className="absolute -left-[9999px] opacity-0 w-px h-px" // Visually hidden but focusable
            inputMode='numeric'
            maxLength={6}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pinInput.length >= 4) {
                handlePinLogin();
              }
            }}
            aria-hidden="true" // Hide from assistive technologies
          />
        <Button onClick={handlePinLogin} className="w-full max-w-xs" disabled={isLoading || pinInput.length < 4}>
          {isLoading ? "Iniciando sesión..." : "Entrar"}
        </Button>
      </div>
    </div>
  );

  const renderUserSelection = () => (
    <div className='space-y-4'>
       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {savedUsers.map(user => (
          <Button
            key={user}
            variant="outline"
            className="flex flex-col items-center justify-center h-28 p-4 text-center shadow-sm hover:shadow-md transition-shadow"
            onClick={() => handleUserSelect(user)}
          >
            <User className="h-10 w-10 mb-2 text-muted-foreground" />
            <span className="text-md font-medium truncate">{user}</span>
          </Button>
        ))}
      </div>
       <Button variant="link" onClick={handleShowManualForm} className="w-full text-accent">
            Iniciar sesión con otro usuario
       </Button>
    </div>
  );

  const renderManualForm = () => (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitManual)} className="space-y-4 relative"> {/* Added relative for back button positioning if needed */}
            {savedUsers.length > 0 && ( // Show back button only if there are saved users to go back to
                 <Button variant="ghost" size="sm" onClick={handleGoBack} className="absolute top-0 left-0 text-muted-foreground -mt-4 -ml-2"> {/* Adjusted positioning */}
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
                  <Input type="password" placeholder="Introduce tu PIN (mín. 4 dígitos)" {...field} inputMode='numeric'/>
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
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-lg">
        <h1 className="absolute top-10 left-1/2 -translate-x-1/2 text-5xl font-bold text-primary opacity-0 animate-fadeInUp md:text-6xl">
          siChef
          <span className="align-super text-sm font-semibold text-accent opacity-80 md:text-base">
            POS <span className="text-xs">&copy;</span>
          </span>
        </h1>
        <Card className="w-full shadow-xl relative">
          <CardHeader className="space-y-1 text-center">
            <KeyRound className="mx-auto h-10 w-10 text-primary mb-2" />
            <CardTitle className="text-3xl font-bold">Acceso siChef</CardTitle>
            {!selectedUser && <CardDescription className="text-md">
              {showManualForm || savedUsers.length === 0
                ? "Introduce tus credenciales"
                : "Selecciona tu perfil para continuar"}
            </CardDescription>}
          </CardHeader>
          <CardContent className="p-6">
            {selectedUser ? renderPinInput() : (showManualForm || savedUsers.length === 0 ? renderManualForm() : renderUserSelection())}

            {!selectedUser && (
              <div className="mt-6 text-center text-sm">
                  ¿No tienes cuenta?{" "}
                  <Link href="/register" className="font-semibold text-accent hover:underline">
                  Regístrate aquí
                  </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
