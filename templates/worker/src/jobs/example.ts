export const handleExample = async (payload: unknown): Promise<unknown> => {
  const data = payload as { message?: string }
  console.log(`Example job processing: ${data.message ?? "no message"}`)

  // Simulate work
  await Bun.sleep(500)

  return { processed: true, message: data.message ?? "done" }
}
