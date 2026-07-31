const debugLog = (data: any, nodeEnv: string): void => {
  if (nodeEnv === 'development') {
    console.log(data);
  }
};

export { debugLog };
