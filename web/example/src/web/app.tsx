/// <reference lib="dom" />
import React, { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import * as api from "./api.ts"
import type { Post } from "./api.ts"
import { follow, navigate, usePathname } from "./router.ts"

const Auth = ({ mode, onLogin }: { mode: "login" | "signup"; onLogin: () => void }) => {
  const [handle, setHandle] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const submit = async () => {
    setError("")
    if (mode === "signup") {
      const res = await api.signup(handle, email, password)
      if (res.error) return setError(res.error)
      navigate("/login")
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
      <a className="toggle" href={mode === "login" ? "/signup" : "/login"} onClick={follow(mode === "login" ? "/signup" : "/login")}>
        {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
      </a>
    </div>
  )
}

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

const Feed = ({ tab }: { tab: "timeline" | "mine" }) => {
  const [posts, setPosts] = useState<Post[]>([])

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
        <a className={tab === "mine" ? "active" : ""} href="/mine" onClick={follow("/mine")}>My Posts</a>
        <a className={tab === "timeline" ? "active" : ""} href="/timeline" onClick={follow("/timeline")}>Timeline</a>
      </div>
      {posts.length === 0
        ? <div className="empty">{tab === "timeline" ? "Follow people to see their posts" : "No posts yet"}</div>
        : posts.map(p => <PostItem key={p.id} post={p} />)
      }
    </>
  )
}

const App = () => {
  const pathname = usePathname()
  const loggedIn = !!api.getToken()
  const screens = loggedIn ? ["/mine", "/timeline"] : ["/login", "/signup"]
  const known = screens.includes(pathname)

  // an address that does not fit the session settles on that session's home, without a history entry
  useEffect(() => {
    if (!known) navigate(screens[0]!, { replace: true })
  }, [known])

  const logout = () => {
    api.setToken(null)
    navigate("/login")
  }

  return (
    <>
      <header>
        Chirp
        {loggedIn && <span className="logout" onClick={logout}>Logout</span>}
      </header>
      {known && (loggedIn
        ? <Feed tab={pathname === "/timeline" ? "timeline" : "mine"} />
        : <Auth mode={pathname === "/signup" ? "signup" : "login"} onLogin={() => navigate("/mine")} />)}
    </>
  )
}

createRoot(document.getElementById("app")!).render(<App />)
