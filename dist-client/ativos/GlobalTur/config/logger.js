import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
class Logger {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.currentDate = new Date().toISOString().split('T')[0];
        this.logFile = path.join(this.logDir, `${this.currentDate}.json`);
        this.initializeLogDir();
    }
    initializeLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    getLogEntries() {
        if (fs.existsSync(this.logFile)) {
            const content = fs.readFileSync(this.logFile, 'utf-8');
            return content ? JSON.parse(content) : [];
        }
        return [];
    }
    saveLog(entry) {
        const logs = this.getLogEntries();
        logs.push(entry);
        fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2), 'utf-8');
    }
    info(message, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            message,
            details
        };
        console.log(message, details || '');
        this.saveLog(entry);
    }
    error(message, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            message,
            details
        };
        console.error(message, details || '');
        this.saveLog(entry);
    }
    warn(message, details) {
        const entry = {
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
