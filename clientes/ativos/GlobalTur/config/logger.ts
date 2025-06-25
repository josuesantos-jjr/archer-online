import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  details?: any;
}

class Logger {
  private logDir: string;
  private currentDate: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(__dirname, 'logs');
    this.currentDate = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDir, `${this.currentDate}.json`);
    this.initializeLogDir();
  }

  private initializeLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogEntries(): LogEntry[] {
    if (fs.existsSync(this.logFile)) {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      return content ? JSON.parse(content) : [];
    }
    return [];
  }

  private saveLog(entry: LogEntry) {
    const logs = this.getLogEntries();
    logs.push(entry);
    fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2), 'utf-8');
  }

  info(message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      details
    };
    console.log(message, details || '');
    this.saveLog(entry);
  }

  error(message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      details
    };
    console.error(message, details || '');
    this.saveLog(entry);
  }

  warn(message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      details
    };
    console.warn(message, details || '');
    this.saveLog(entry);
  }
}

const logger = new Logger();
export default logger;