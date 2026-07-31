export const generateUuid = (): string => {
  const uuid = crypto.randomUUID();
  return uuid;
};
