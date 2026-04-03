import React, { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { Button, Card, Stack, Text, Input } from "@atlas/ui"

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
    if (res.ok) setUsers(await res.json())
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

  useEffect(() => { fetchUsers() }, [])

  return (
    <Stack gap="lg" padding="lg">
      <Text variant="h1">Users</Text>

      <Card>
        <Stack gap="sm">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={createUser}>Add User</Button>
        </Stack>
      </Card>

      {users.map((user) => (
        <Card key={user.id}>
          <Text variant="h3">{user.name}</Text>
          <Text>{user.email}</Text>
        </Card>
      ))}
    </Stack>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
