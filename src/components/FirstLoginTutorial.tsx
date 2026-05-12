"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogPortal,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import {
  Home,
  User,
  LayoutDashboard,
  AppWindow,
  Moon,
  Rocket,
} from "lucide-react";

interface FirstLoginTutorialProps {
  open: boolean;
  onFinish: () => void;
}

const STORAGE_KEY = "dezlog:tutorialCompleted";

const tutorialSteps = [
  {
    title: "Bem-vindo(a) ao Sistema de Gestão DezLog!",
    description:
      "Este é um breve guia para ajudá-lo(a) a começar. Use as setas para navegar.",
    icon: <Home className="h-24 w-24 text-primary" />,
  },
  {
    title: "Página Inicial (Dashboard)",
    description:
      "Aqui você encontra atalhos rápidos para todas as áreas do sistema, conforme suas permissões.",
    icon: <LayoutDashboard className="h-24 w-24 text-primary" />,
  },
  {
    title: "Seu Perfil",
    description:
      "No canto superior direito você pode alterar senha, foto e preferências.",
    icon: <User className="h-24 w-24 text-primary" />,
  },
  {
    title: "Personalização",
    description:
      "Você pode alternar layout do menu, ativar modo escuro e ajustar a interface.",
    icon: <AppWindow className="h-24 w-24 text-primary" />,
  },
  {
    title: "Modo Escuro e Tema",
    description:
      "Administradores podem definir cores globais do sistema.",
    icon: <Moon className="h-24 w-24 text-primary" />,
  },
  {
    title: "Tudo pronto!",
    description:
      "Agora você pode explorar o sistema e começar a trabalhar.",
    icon: <Rocket className="h-24 w-24 text-primary" />,
  },
];

export function FirstLoginTutorial({ open, onFinish }: FirstLoginTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isLastStep = currentStep === tutorialSteps.length - 1;

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const finishTutorial = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onFinish();
  };

  return (
    <Dialog open={open} modal onOpenChange={() => {}}>
      <DialogPortal>
        <DialogContent
          className="
            fixed
            left-1/2
            top-1/2
            -translate-x-1/2
            -translate-y-1/2
            w-[92vw]
            max-w-6xl
            max-h-[90vh]
            p-0
            rounded-xl
            overflow-hidden
          "
        >
          <Carousel
            className="w-full"
            opts={{ startIndex: 0 }}
            setApi={(api) => {
              if (!api) return;

              setCurrentStep(api.selectedScrollSnap());
              api.on("select", () =>
                setCurrentStep(api.selectedScrollSnap())
              );
            }}
          >
            {currentStep > 0 && (
              <CarouselPrevious className="left-4 top-1/2 -translate-y-1/2 z-10" />
            )}

            <CarouselContent>
              {tutorialSteps.map((step, index) => (
                <CarouselItem key={index}>
                  <div
                    className="
                      grid
                      grid-cols-1
                      md:grid-cols-2
                      gap-10
                      items-center
                      px-6
                      sm:px-10
                      py-10
                      min-h-[360px]
                    "
                  >
                    {/* COLUNA TEXTO */}
                    <div className="flex flex-col gap-4 text-center md:text-left items-center md:items-start">
                      <DialogHeader>
                        <DialogTitle className="text-2xl sm:text-3xl">
                          {step.title}
                        </DialogTitle>
                        <DialogDescription className="text-sm sm:text-base md:text-lg leading-relaxed">
                          {step.description}
                        </DialogDescription>
                      </DialogHeader>
                    </div>

                    {/* COLUNA VISUAL */}
                    <div className="flex justify-center md:justify-end">
                      {step.icon}
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {!isLastStep && (
              <CarouselNext className="right-4 top-1/2 -translate-y-1/2 z-10" />
            )}
          </Carousel>

          {/* FOOTER */}
          <DialogFooter className="flex flex-col items-center gap-4 p-6">
            {/* Dots */}
            <div className="flex gap-2">
              {tutorialSteps.map((_, index) => (
                <span
                  key={index}
                  aria-current={index === currentStep}
                  className={`h-2 w-2 rounded-full ${
                    index === currentStep
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            {/* Ações */}
            <div className="flex flex-col items-center gap-2">
              {isLastStep ? (
                <Button size="lg" onClick={finishTutorial}>
                  Entendido, vamos começar!
                </Button>
              ) : (
                <div className="h-11" />
              )}

              <Button
                variant="link"
                size="sm"
                onClick={finishTutorial}
                className="text-muted-foreground"
              >
                Pular tutorial
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
