import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Bot, User, Headphones } from "lucide-react";
import type { Message } from "@/types/database";

interface MessageBubbleProps {
  message: Message;
}

const senderConfig = {
  user: {
    align: 'left' as const,
    icon: User,
    bgClass: 'bg-sender-user',
    textClass: 'text-sender-user-foreground',
    label: 'Customer',
  },
  ai: {
    align: 'right' as const,
    icon: Bot,
    bgClass: 'bg-sender-ai',
    textClass: 'text-sender-ai-foreground',
    label: 'AI Assistant',
  },
  human: {
    align: 'right' as const,
    icon: Headphones,
    bgClass: 'bg-sender-human',
    textClass: 'text-sender-human-foreground',
    label: 'Human Agent',
  },
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const config = senderConfig[message.sender];
  const Icon = config.icon;
  const isRight = config.align === 'right';

  return (
    <div className={cn("flex gap-3 max-w-[80%]", isRight && "ml-auto flex-row-reverse")}>
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        config.bgClass
      )}>
        <Icon className={cn("h-4 w-4", config.textClass)} />
      </div>
      <div className={cn("flex flex-col gap-1", isRight && "items-end")}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{config.label}</span>
          <span>•</span>
          <time>{format(new Date(message.created_at), "h:mm a")}</time>
        </div>
        <div className={cn(
          "rounded-2xl px-4 py-2.5 shadow-sm",
          config.bgClass,
          config.textClass,
          isRight ? "rounded-tr-md" : "rounded-tl-md"
        )}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
