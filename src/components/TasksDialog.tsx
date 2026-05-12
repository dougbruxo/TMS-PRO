
"use client";

import { useState, useMemo, useEffect } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Bell, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format } from 'date-fns';

type Task = {
  id: string;
  text: string;
  completed: boolean;
  type: 'task' | 'reminder';
  priority: 'none' | 'low' | 'medium' | 'high';
  dueDate?: string;
};

interface TasksDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityConfig = {
  none: { label: 'Nenhuma', color: 'bg-transparent border', icon: <Circle className="h-3 w-3 text-muted-foreground" /> },
  low: { label: 'Baixa', color: 'bg-green-500', icon: <Circle className="h-3 w-3 text-green-500" /> },
  medium: { label: 'Média', color: 'bg-yellow-500', icon: <Circle className="h-3 w-3 text-yellow-500" /> },
  high: { label: 'Alta', color: 'bg-red-500', icon: <Circle className="h-3 w-3 text-red-500" /> },
};

const priorityOrder = { 'high': 4, 'medium': 3, 'low': 2, 'none': 1 };

export function TasksDialog({ isOpen, onOpenChange }: TasksDialogProps) {
  const [tasks, setTasks] = useLocalStorage<Task[]>('user-tasks-and-reminders', []);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskType, setNewTaskType] = useState<'task' | 'reminder'>('task');
  const [newTaskPriority, setNewTaskPriority] = useState<keyof typeof priorityConfig>('none');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const handleAddTask = () => {
    if (newTaskText.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        text: newTaskText,
        completed: false,
        type: newTaskType,
        priority: newTaskPriority,
        dueDate: newTaskDueDate || undefined,
      };
      setTasks([...tasks, newTask]);
      setNewTaskText('');
      setNewTaskDueDate('');
    }
  };

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const sortedTasks = useMemo(() => {
    return tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      
      const aIsOverdue = a.dueDate && new Date(a.dueDate) < new Date();
      const bIsOverdue = b.dueDate && new Date(b.dueDate) < new Date();
      if (aIsOverdue !== bIsOverdue) return aIsOverdue ? -1 : 1;

      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }

      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      return 0;
    });
  }, [tasks]);

  const pendingTasks = sortedTasks.filter(t => !t.completed);
  const completedTasks = sortedTasks.filter(t => t.completed);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Minhas Tarefas e Lembretes</DialogTitle>
          <DialogDescription>
            Adicione tarefas rápidas para não se esquecer de nada. Elas ficam salvas no seu navegador.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-shrink-0 space-y-4 p-4 border rounded-lg">
          <Input
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Adicionar nova tarefa..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTask();
              }
            }}
          />
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <RadioGroup value={newTaskType} onValueChange={(v: any) => setNewTaskType(v)} className="flex items-center">
              <div className="flex items-center space-x-2"><RadioGroupItem value="task" id="type-task" /><Label htmlFor="type-task">Tarefa</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="reminder" id="type-reminder" /><Label htmlFor="type-reminder">Lembrete</Label></div>
            </RadioGroup>
            <Select value={newTaskPriority} onValueChange={(v: any) => setNewTaskPriority(v)}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                {Object.entries(priorityConfig).map(([key, { label, icon }]) => (
                  <SelectItem key={key} value={key}><div className="flex items-center">{icon}{label}</div></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
           <Input type="datetime-local" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} />
          <Button onClick={handleAddTask} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </div>
        <ScrollArea className="flex-grow mt-4">
          <div className="p-1 space-y-3">
            {tasks.length > 0 ? (
              <>
                {pendingTasks.map(task => {
                  const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();
                  return (
                      <div key={task.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted">
                        <Checkbox id={`task-${task.id}`} checked={task.completed} onCheckedChange={() => handleToggleTask(task.id)} className="mt-1" />
                        <div className="flex-grow">
                           <label htmlFor={`task-${task.id}`} className={cn("text-sm cursor-pointer", task.completed && "line-through text-muted-foreground")}>{task.text}</label>
                           <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              {task.type === 'reminder' && <Bell className="h-3 w-3" />}
                              {task.priority !== 'none' && <div className={cn("h-2 w-2 rounded-full", priorityConfig[task.priority].color)} />}
                              {task.dueDate && <span className={cn(isOverdue && 'text-red-500 font-bold')}>{format(new Date(task.dueDate), "dd/MM 'às' HH:mm")}</span>}
                           </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteTask(task.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                  )
                })}
                {completedTasks.length > 0 && pendingTasks.length > 0 && <Separator className="my-4" />}
                {completedTasks.map(task => (
                   <div key={task.id} className="flex items-start gap-3 p-2 rounded-md">
                    <Checkbox id={`task-${task.id}`} checked={task.completed} onCheckedChange={() => handleToggleTask(task.id)} className="mt-1" />
                     <div className="flex-grow">
                      <label htmlFor={`task-${task.id}`} className="text-sm cursor-pointer line-through text-muted-foreground">{task.text}</label>
                       <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                         <Check className="h-3 w-3 text-green-500" />
                         <span>Concluído</span>
                       </div>
                     </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteTask(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa adicionada ainda.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
