const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

export const validateIdentifier = (name: string): string => {
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(`Invalid identifier: "${name}"`);
  }
  return name;
};

export const isValidIdentifier = (name: string): boolean => {
  return IDENTIFIER_PATTERN.test(name);
};
