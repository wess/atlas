import { Bot, Search, Send, Sparkles, User } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "../components/index.tsx";
import { useDebounced } from "../headless/index.tsx";

// MessageBubble

export type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
};

const renderContent = (content: string) => {
  const parts = content.split(/(```[\s\S]*?```)/g);
  // parts of one message have no identity but their position
  return parts.map((part, key) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.slice(3, -3).replace(/^\w*\n/, "");
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <Code key={key} block>
          {code}
        </Code>
      );
    }
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: see above
      <Text key={key} size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {part}
      </Text>
    );
  });
};

export const MessageBubble = ({ role, content, timestamp }: MessageBubbleProps) => (
  <div className="atlas-message" data-role={role}>
    {role === "assistant" && (
      <span className="atlas-message__avatar">
        <Bot size={14} aria-hidden="true" />
      </span>
    )}
    <div className="atlas-message__bubble">
      {renderContent(content)}
      {timestamp && (
        <Text size="xs" className="atlas-message__time">
          {timestamp.toLocaleTimeString()}
        </Text>
      )}
    </div>
    {role === "user" && (
      <span className="atlas-message__avatar">
        <User size={14} aria-hidden="true" />
      </span>
    )}
  </div>
);

// PromptInput

export type PromptInputProps = {
  onSend: (message: string) => void;
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

export const PromptInput = ({
  onSend,
  loading = false,
  placeholder = "Type a message...",
  disabled = false,
}: PromptInputProps) => {
  const [value, setValue] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading || disabled) return;
    onSend(trimmed);
    setValue("");
  }, [value, loading, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <Group gap="xs" align="flex-end" w="100%">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        autosize
        minRows={1}
        maxRows={4}
        flex={1}
      />
      <ActionIcon
        aria-label="Send message"
        size="lg"
        color="primary"
        onClick={handleSend}
        disabled={!value.trim() || loading || disabled}
        loading={loading}
      >
        <Send size={16} />
      </ActionIcon>
    </Group>
  );
};

// ChatWindow

export type ChatWindowProps = {
  messages: { role: "user" | "assistant"; content: string }[];
  onSend: (message: string) => void;
  loading?: boolean;
  title?: string;
  placeholder?: string;
  height?: number | string;
};

export const ChatWindow = ({
  messages,
  onSend,
  loading = false,
  title,
  placeholder,
  height = 500,
}: ChatWindowProps) => {
  const viewport = useRef<HTMLDivElement>(null);

  // new messages and the loading row are what should move the view, though neither is read here
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading]);

  return (
    <Paper p="md" withBorder radius="md" h={height} style={{ display: "flex", flexDirection: "column" }}>
      {title && (
        <Title order={4} mb="sm">
          {title}
        </Title>
      )}
      <ScrollArea flex={1} ref={viewport} mb="sm">
        <Stack gap="sm" p="xs">
          {messages.map((msg, index) => (
            // the list only grows, and two identical messages must not share a key
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <MessageBubble key={index} role={msg.role} content={msg.content} />
          ))}
          {loading && (
            <Group gap="xs">
              <Bot size={14} />
              <Loader size="xs" type="dots" />
            </Group>
          )}
        </Stack>
      </ScrollArea>
      <PromptInput onSend={onSend} loading={loading} placeholder={placeholder} />
    </Paper>
  );
};

// AiSearch

export type AiSearchProps = {
  onSearch: (query: string) => Promise<{ id: string; text: string; score: number }[]>;
  placeholder?: string;
  debounceMs?: number;
};

export const AiSearch = ({ onSearch, placeholder = "Search with AI...", debounceMs = 300 }: AiSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; text: string; score: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounced(query, debounceMs);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    onSearch(debounced)
      .then((res) => {
        if (!cancelled) {
          setResults(res);
          setSearching(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setSearching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, onSearch]);

  return (
    <Stack gap="xs">
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder={placeholder}
        leftSection={<Search size={16} />}
        rightSection={searching ? <Loader size="xs" /> : null}
      />
      {results.length > 0 && (
        <Paper withBorder p="xs" radius="sm">
          <Stack gap="xs">
            {results.map((r) => (
              <Group key={r.id} justify="space-between">
                <Text size="sm" truncate flex={1}>
                  {r.text}
                </Text>
                <Badge size="sm" variant="light">
                  {(r.score * 100).toFixed(0)}%
                </Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

// GenerateButton

export type GenerateButtonProps = {
  onGenerate: () => Promise<string>;
  label?: string;
  onResult: (text: string) => void;
  variant?: "button" | "icon";
};

export const GenerateButton = ({
  onGenerate,
  label = "Generate",
  onResult,
  variant = "button",
}: GenerateButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const text = await onGenerate();
      onResult(text);
    } finally {
      setLoading(false);
    }
  }, [loading, onGenerate, onResult]);

  if (variant === "icon") {
    return (
      <ActionIcon aria-label={label} onClick={handleClick} loading={loading} color="accent" variant="light">
        <Sparkles size={16} />
      </ActionIcon>
    );
  }

  return (
    <Button onClick={handleClick} loading={loading} leftSection={<Sparkles size={16} />} color="accent" variant="light">
      {label}
    </Button>
  );
};
