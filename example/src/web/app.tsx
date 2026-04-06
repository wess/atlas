import React, { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import * as api from "./api.ts"

const Auth = ({ onLogin }: { onLogin: () => void }) => {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [handle, setHandle] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const submit = async () => {
    setError("")
    if (mode === "signup") {
      const res = await api.signup(handle, email, password)
      if (res.error) return setError(res.error)
      setMode("login")
      return
    }
    const res = await api.login(email, password)
    if (res.error) return setError(res.error)
    onLogin()
  }

  return (
    <div className="auth">
      <h2>{mode === "login" ? "Log in to Chirp" : "Join Chirp"}</h2>
      {error && <div className="error">{error}</div>}
      {mode === "signup" && (
        <input placeholder="Handle" value={handle} onChange={e => setHandle(e.target.value)} />
      )}
      <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
      <button onClick={submit}>{mode === "login" ? "Log in" : "Sign up"}</button>
      <div className="toggle" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
      </div>
    </div>
  )
}

type Post = { id: number; content: string; userId: number; createdAt: string; handle?: string }

const PostItem = ({ post }: { post: Post }) => (
  <div className="post">
    <span className="handle">@{post.handle ?? `user${post.userId}`}</span>
    <span className="time">{new Date(post.createdAt).toLocaleString()}</span>
    <div className="content">{post.content}</div>
    <div className="actions">
      <span onClick={() => api.likePost(post.id)}>Like</span>
    </div>
  </div>
)

const Compose = ({ onPost }: { onPost: () => void }) => {
  const [content, setContent] = useState("")

  const submit = async () => {
    if (!content.trim()) return
    await api.createPost(content)
    setContent("")
    onPost()
  }

  return (
    <div className="compose">
      <textarea placeholder="What's happening?" value={content} onChange={e => setContent(e.target.value)} maxLength={280} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        <span className="counter">{content.length}/280</span>
        <button onClick={submit}>Post</button>
      </div>
    </div>
  )
}

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([])
  const [tab, setTab] = useState<"timeline" | "mine">("mine")

  const load = async () => {
    const token = api.getToken()
    if (!token) return
    const payload = JSON.parse(atob(token.split(".")[1]!))
    const data = tab === "timeline"
      ? await api.getTimeline()
      : await api.getUserPosts(payload.handle)
    setPosts(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load() }, [tab])

  return (
    <>
      <Compose onPost={load} />
      <div className="tabs">
        <span className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>My Posts</span>
        <span className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>Timeline</span>
      </div>
      {posts.length === 0
        ? <div className="empty">{tab === "timeline" ? "Follow people to see their posts" : "No posts yet"}</div>
        : posts.map(p => <PostItem key={p.id} post={p} />)
      }
    </>
  )
}

const App = () => {
  const [loggedIn, setLoggedIn] = useState(!!api.getToken())

  const logout = () => {
    api.setToken(null)
    setLoggedIn(false)
  }

  return (
    <>
      <header>
        Chirp
        {loggedIn && <span className="logout" onClick={logout}>Logout</span>}
      </header>
      {loggedIn ? <Feed /> : <Auth onLogin={() => setLoggedIn(true)} />}
    </>
  )
}

createRoot(document.getElementById("app")!).render(<App />)
