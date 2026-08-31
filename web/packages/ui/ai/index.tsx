import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Bot, Search, Send, Sparkles, User } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

// --- MessageBubble ---

export type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
};

const renderContent = (content: string) => {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part) => {
    const key = part.slice(0, 40);
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.slice(3, -3).replace(/^\w*\n/, "");
      return (
        <Paper key={key} bg="dark.8" p="xs" my="xs" radius="sm">
          <Text size="sm" ff="monospace" style={{ whiteSpace: "pre-wrap" }}>
            {code}
          </Text>
        </Paper>
      );
    }
    return (
      <Text key={key} size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {part}
      </Text>
    );
  });
};

export const MessageBubble = ({ role, content, timestamp }: MessageBubbleProps) => (
  <Group justify={role === "user" ? "flex-end" : "flex-start"} align="flex-start" w="100%">
    {role === "assistant" && (
      <ActionIcon variant="light" color="blue" size="sm" radius="xl" mt={4}>
        <Bot size={14} />
      </ActionIcon>
    )}
    <Paper
      p="sm"
      radius="md"
      bg={role === "user" ? "blue.6" : "gray.1"}
      c={role === "user" ? "white" : undefined}
      maw="75%"
    >
      {renderContent(content)}
      {timestamp && (
        <Text size="xs" c={role === "user" ? "blue.1" : "dimmed"} mt={4}>
          {timestamp.toLocaleTimeString()}
        </Text>
      )}
    </Paper>
    {role === "user" && (
      <ActionIcon variant="light" color="gray" size="sm" radius="xl" mt={4}>
        <User size={14} />
      </ActionIcon>
    )}
  </Group>
);

// --- PromptInput ---

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
        style={{ flex: 1 }}
      />
      <ActionIcon
        size="lg"
        color="blue"
        onClick={handleSend}
        disabled={!value.trim() || loading || disabled}
        loading={loading}
      >
        <Send size={16} />
      </ActionIcon>
    </Group>
  );
};

// --- ChatWindow ---

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

  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  return (
    <Paper p="md" withBorder radius="md" h={height} style={{ display: "flex", flexDirection: "column" }}>
      {title && (
        <Title order={4} mb="sm">
          {title}
        </Title>
      )}
      <ScrollArea flex={1} viewportRef={viewport} mb="sm">
        <Stack gap="sm" p="xs">
          {messages.map((msg) => {
            const key = `${msg.role}-${msg.content.slice(0, 32)}`;
            return <MessageBubble key={key} role={msg.role} content={msg.content} />;
          })}
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

// --- AiSearch ---

export type AiSearchProps = {
  onSearch: (query: string) => Promise<{ id: string; text: string; score: number }[]>;
  placeholder?: string;
  debounceMs?: number;
};

export const AiSearch = ({ onSearch, placeholder = "Search with AI...", debounceMs = 300 }: AiSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; text: string; score: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [debounced] = useDebouncedValue(query, debounceMs);

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
                <Text size="sm" truncate style={{ flex: 1 }}>
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

// --- GenerateButton ---

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
      <ActionIcon onClick={handleClick} loading={loading} color="violet" variant="light">
        <Sparkles size={16} />
      </ActionIcon>
    );
  }

  return (
    <Button onClick={handleClick} loading={loading} leftSection={<Sparkles size={16} />} color="violet" variant="light">
      {label}
    </Button>
  );
};
