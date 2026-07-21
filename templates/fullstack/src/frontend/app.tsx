/// <reference lib="dom" />
import { AtlasProvider } from "@atlas/ui/provider"
import { Button, Card, Stack, Text, TextInput, Title } from "@mantine/core"
import "@mantine/core/styles.css"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

type User = {
  id: number
  email: string
  name: string
  created: string
}

const App = () => {
  const [users, setUsers] = useState<User[]>([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  const fetchUsers = async () => {
    const res = await fetch("/api/users")
    if (res.ok) setUsers((await res.json()) as User[])
  }

  const createUser = async () => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    })
    if (res.ok) {
      setName("")
      setEmail("")
      fetchUsers()
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <Stack gap="lg" p="lg">
      <Title order={1}>Users</Title>

      <Card withBorder>
        <Stack gap="sm">
          <TextInput placeholder="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput placeholder="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <Button onClick={createUser}>Add User</Button>
        </Stack>
      </Card>

      {users.map((user) => (
        <Card key={user.id} withBorder>
          <Title order={3}>{user.name}</Title>
          <Text>{user.email}</Text>
        </Card>
      ))}
    </Stack>
  )
}

createRoot(document.getElementById("root")!).render(
  <AtlasProvider>
    <App />
  </AtlasProvider>,
)
