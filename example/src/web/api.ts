const BASE = "/api"

export type Post = { id: number; content: string; userId: number; createdAt: string; handle?: string }

type Failure = { error?: string }

let token: string | null = localStorage.getItem("chirp_token")

const headers = () => {
  const h: Record<string, string> = { "content-type": "application/json" }
  if (token) h.authorization = `Bearer ${token}`
  return h
}

const req = async <T = unknown>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<T>
}

export const setToken = (t: string | null) => {
  token = t
  if (t) localStorage.setItem("chirp_token", t)
  else localStorage.removeItem("chirp_token")
}

export const getToken = () => token

export const signup = (handle: string, email: string, password: string) =>
  req<Failure>("POST", "/signup", { handle, email, password })

export const login = async (email: string, password: string) => {
  const data = await req<Failure & { token?: string }>("POST", "/login", { email, password })
  if (data.token) setToken(data.token)
  return data
}

export const createPost = (content: string) =>
  req("POST", "/posts", { content })

export const getTimeline = () =>
  req<Post[] | Failure>("GET", "/timeline")

export const getUserPosts = (handle: string) =>
  req<Post[] | Failure>("GET", `/users/${handle}/posts`)

export const getProfile = (handle: string) =>
  req("GET", `/users/${handle}`)

export const follow = (userId: number) =>
  req("POST", `/follow/${userId}`)

export const unfollow = (userId: number) =>
  req("DELETE", `/follow/${userId}`)

export const likePost = (id: number) =>
  req("POST", `/posts/${id}/like`)

export const unlikePost = (id: number) =>
  req("DELETE", `/posts/${id}/like`)
