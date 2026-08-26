const logger = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({ level: 'info', message, data, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error?: any) => {
    console.error(JSON.stringify({ level: 'error', message, error: error?.message ?? error, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, data?: any) => {
    console.warn(JSON.stringify({ level: 'warn', message, data, timestamp: new Date().toISOString() }));
  },
};

export default logger;
