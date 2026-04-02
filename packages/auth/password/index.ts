export const hash = async (password: string): Promise<string> => {
  return await Bun.password.hash(password, { algorithm: "argon2id" });
};

export const verify = async (password: string, hashed: string): Promise<boolean> => {
  return await Bun.password.verify(password, hashed);
};
