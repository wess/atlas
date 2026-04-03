import { Alert, Button, Paper, PasswordInput, Stack, TextInput, Title } from "@mantine/core";
import { Lock, Mail, User } from "lucide-react";
import type React from "react";
import { useState } from "react";

export type AuthPageProps = {
  onSubmit: (data: Record<string, string>) => Promise<{ error?: string } | undefined>;
  title?: string;
};

export const LoginPage = ({ onSubmit, title = "Login" }: AuthPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await onSubmit({ email, password });
    if (result?.error) setError(result.error);
    setLoading(false);
  };

  return (
    <Paper p="xl" maw={400} mx="auto" mt="xl">
      <Title order={2} mb="lg">
        {title}
      </Title>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            leftSection={<Mail size={16} />}
          />
          <PasswordInput
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            leftSection={<Lock size={16} />}
          />
          <Button type="submit" loading={loading} fullWidth>
            Log In
          </Button>
        </Stack>
      </form>
    </Paper>
  );
};

export const SignupPage = ({ onSubmit, title = "Sign Up" }: AuthPageProps) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await onSubmit({ email, name, password });
    if (result?.error) setError(result.error);
    setLoading(false);
  };

  return (
    <Paper p="xl" maw={400} mx="auto" mt="xl">
      <Title order={2} mb="lg">
        {title}
      </Title>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            leftSection={<User size={16} />}
          />
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            leftSection={<Mail size={16} />}
          />
          <PasswordInput
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            leftSection={<Lock size={16} />}
          />
          <Button type="submit" loading={loading} fullWidth>
            Sign Up
          </Button>
        </Stack>
      </form>
    </Paper>
  );
};

export const ResetPasswordPage = ({ onSubmit, title = "Reset Password" }: AuthPageProps) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await onSubmit({ email });
    if (result?.error) setError(result.error);
    else setSuccess(true);
    setLoading(false);
  };

  return (
    <Paper p="xl" maw={400} mx="auto" mt="xl">
      <Title order={2} mb="lg">
        {title}
      </Title>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {success && (
        <Alert color="green" mb="md">
          Check your email for reset instructions.
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            leftSection={<Mail size={16} />}
          />
          <Button type="submit" loading={loading} fullWidth>
            Send Reset Link
          </Button>
        </Stack>
      </form>
    </Paper>
  );
};
