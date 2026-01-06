/**
 * Comprehensive Debug Logging System
 *
 * Enable by setting localStorage.setItem('DEBUG', 'true') in browser console
 * Or set DEBUG_LEVEL for granular control:
 * - 'all': Everything
 * - 'render': Component renders
 * - 'state': State changes
 * - 'callback': Callback invocations
 * - 'perf': Performance metrics
 * - 'network': API calls
 *
 * Multiple levels: localStorage.setItem('DEBUG_LEVEL', 'render,state,callback')
 *
 * Server logging: localStorage.setItem('DEBUG_SERVER', 'true')
 * - Sends error/warn logs to /api/logs for server-side inspection
 */

type LogLevel = 'render' | 'state' | 'callback' | 'perf' | 'network' | 'error' | 'warn' | 'info';

interface RenderLog {
  component: string;
  timestamp: number;
  renderCount: number;
  props?: Record<string, unknown>;
  cause?: string;
}

interface StateLog {
  component: string;
  timestamp: number;
  stateName: string;
  prevValue: unknown;
  newValue: unknown;
}

interface CallbackLog {
  component: string;
  timestamp: number;
  callbackName: string;
  args?: unknown[];
  result?: unknown;
}

interface PerfLog {
  component: string;
  operation: string;
  duration: number;
  timestamp: number;
}

// Singleton debug instance
class DebugLogger {
  private static instance: DebugLogger;
  private renderCounts: Map<string, number> = new Map();
  private renderHistory: RenderLog[] = [];
  private stateHistory: StateLog[] = [];
  private callbackHistory: CallbackLog[] = [];
  private perfHistory: PerfLog[] = [];
  private lastRenderTime: Map<string, number> = new Map();
  private maxHistorySize = 1000;
  private serverLogQueue: Array<{level: string; message: string; data?: unknown}> = [];
  private serverLogTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    // Expose to window for debugging
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__DEBUG__ = this;

      // Setup global error handlers
      this.setupGlobalErrorHandlers();
    }
  }

  private setupGlobalErrorHandlers(): void {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.sendToServer('error', `Uncaught Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.sendToServer('error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: String(event.reason),
        stack: event.reason?.stack,
      });
    });

    // Catch React errors via console.error override
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError.apply(console, args);

      // Check if it's a React error
      const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (message.includes('React') || message.includes('render') || message.includes('component')) {
        this.sendToServer('error', message.slice(0, 500), { fullArgs: args.slice(0, 3) });
      }
    };
  }

  // Send logs to server (batched)
  private sendToServer(level: string, message: string, data?: unknown): void {
    // Always send errors/warns to server, regardless of DEBUG setting
    const shouldSendToServer = typeof localStorage !== 'undefined' &&
      (localStorage.getItem('DEBUG_SERVER') === 'true' || level === 'error' || level === 'warn');

    if (!shouldSendToServer) return;

    this.serverLogQueue.push({
      level,
      message,
      data,
    });

    // Batch send after 100ms to avoid flooding
    if (!this.serverLogTimeout) {
      this.serverLogTimeout = setTimeout(() => {
        this.flushServerLogs();
      }, 100);
    }
  }

  private async flushServerLogs(): Promise<void> {
    if (this.serverLogQueue.length === 0) return;

    const logs = this.serverLogQueue.map(log => ({
      ...log,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }));

    this.serverLogQueue = [];
    this.serverLogTimeout = null;

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logs),
      });
    } catch (e) {
      // Silently fail - don't want logging to break the app
      console.warn('Failed to send logs to server:', e);
    }
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  private isEnabled(level?: LogLevel): boolean {
    if (typeof localStorage === 'undefined') return false;

    const debug = localStorage.getItem('DEBUG');
    if (debug === 'true') return true;

    if (level) {
      const levels = localStorage.getItem('DEBUG_LEVEL');
      if (levels === 'all') return true;
      if (levels) {
        return levels.split(',').includes(level);
      }
    }

    return false;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.toLocaleTimeString()}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  }

  private addToHistory<T>(history: T[], item: T): void {
    history.push(item);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  // Render tracking
  logRender(component: string, props?: Record<string, unknown>, cause?: string): void {
    if (!this.isEnabled('render')) return;

    const count = (this.renderCounts.get(component) || 0) + 1;
    this.renderCounts.set(component, count);

    const now = Date.now();
    const lastRender = this.lastRenderTime.get(component) || 0;
    const timeSinceLastRender = now - lastRender;
    this.lastRenderTime.set(component, now);

    const log: RenderLog = {
      component,
      timestamp: now,
      renderCount: count,
      props,
      cause,
    };
    this.addToHistory(this.renderHistory, log);

    // Warn if rendering too frequently (potential loop)
    const style = timeSinceLastRender < 50
      ? 'color: red; font-weight: bold'
      : 'color: #4CAF50';

    console.log(
      `%c[RENDER] ${this.formatTime(now)} ${component} #${count}${cause ? ` (${cause})` : ''} ${timeSinceLastRender < 50 ? `⚠️ ${timeSinceLastRender}ms since last render!` : ''}`,
      style
    );

    if (props && Object.keys(props).length > 0) {
      console.log('  Props:', props);
    }

    // Alert on potential render loop
    if (timeSinceLastRender < 16 && count > 10) {
      const errorMsg = `🚨 POTENTIAL RENDER LOOP DETECTED in ${component}! ${count} renders, last two only ${timeSinceLastRender}ms apart`;
      console.error(`%c${errorMsg}`, 'color: red; font-weight: bold; font-size: 14px');

      // Send to server immediately
      this.sendToServer('error', errorMsg, {
        component,
        renderCount: count,
        timeSinceLastRender,
        props,
        cause,
      });
    }
  }

  // State change tracking
  logState(component: string, stateName: string, prevValue: unknown, newValue: unknown): void {
    if (!this.isEnabled('state')) return;

    const now = Date.now();
    const log: StateLog = {
      component,
      timestamp: now,
      stateName,
      prevValue,
      newValue,
    };
    this.addToHistory(this.stateHistory, log);

    const changed = JSON.stringify(prevValue) !== JSON.stringify(newValue);
    const style = changed ? 'color: #2196F3' : 'color: #9E9E9E';

    console.log(
      `%c[STATE] ${this.formatTime(now)} ${component}.${stateName} ${changed ? 'CHANGED' : 'same'}`,
      style
    );
    if (changed) {
      console.log('  From:', prevValue);
      console.log('  To:', newValue);
    }
  }

  // Callback invocation tracking
  logCallback(component: string, callbackName: string, args?: unknown[], result?: unknown): void {
    if (!this.isEnabled('callback')) return;

    const now = Date.now();
    const log: CallbackLog = {
      component,
      timestamp: now,
      callbackName,
      args,
      result,
    };
    this.addToHistory(this.callbackHistory, log);

    console.log(
      `%c[CALLBACK] ${this.formatTime(now)} ${component}.${callbackName}()`,
      'color: #FF9800'
    );
    if (args && args.length > 0) {
      console.log('  Args:', args);
    }
    if (result !== undefined) {
      console.log('  Result:', result);
    }
  }

  // Performance tracking
  startPerf(component: string, operation: string): () => void {
    if (!this.isEnabled('perf')) return () => {};

    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      const now = Date.now();

      const log: PerfLog = {
        component,
        operation,
        duration,
        timestamp: now,
      };
      this.addToHistory(this.perfHistory, log);

      const style = duration > 16 ? 'color: red' : 'color: #9C27B0';
      console.log(
        `%c[PERF] ${this.formatTime(now)} ${component}.${operation}: ${duration.toFixed(2)}ms ${duration > 16 ? '⚠️ SLOW' : ''}`,
        style
      );
    };
  }

  // Network tracking
  logNetwork(method: string, url: string, status?: number, duration?: number, error?: Error): void {
    if (!this.isEnabled('network')) return;

    const now = Date.now();
    const style = error ? 'color: red' : status && status >= 400 ? 'color: orange' : 'color: #00BCD4';

    console.log(
      `%c[NETWORK] ${this.formatTime(now)} ${method} ${url} ${status || ''} ${duration ? `${duration}ms` : ''} ${error ? `ERROR: ${error.message}` : ''}`,
      style
    );
  }

  // General logging
  log(level: 'info' | 'warn' | 'error', message: string, ...args: unknown[]): void {
    if (!this.isEnabled(level)) return;

    const now = Date.now();
    const styles: Record<string, string> = {
      info: 'color: #607D8B',
      warn: 'color: #FFC107',
      error: 'color: #F44336; font-weight: bold',
    };

    console[level](
      `%c[${level.toUpperCase()}] ${this.formatTime(now)} ${message}`,
      styles[level],
      ...args
    );

    // Send errors and warnings to server
    if (level === 'error' || level === 'warn') {
      this.sendToServer(level, message, args.length > 0 ? args : undefined);
    }
  }

  // Get diagnostic report
  getReport(): {
    renderCounts: Record<string, number>;
    recentRenders: RenderLog[];
    recentStateChanges: StateLog[];
    recentCallbacks: CallbackLog[];
    recentPerf: PerfLog[];
    suspectedLoops: string[];
  } {
    // Find components that rendered too many times recently
    const recentWindow = Date.now() - 5000; // Last 5 seconds
    const recentRenders = this.renderHistory.filter(r => r.timestamp > recentWindow);
    const renderCountsInWindow: Record<string, number> = {};

    for (const render of recentRenders) {
      renderCountsInWindow[render.component] = (renderCountsInWindow[render.component] || 0) + 1;
    }

    const suspectedLoops = Object.entries(renderCountsInWindow)
      .filter(([, count]) => count > 50)
      .map(([component, count]) => `${component}: ${count} renders in 5s`);

    return {
      renderCounts: Object.fromEntries(this.renderCounts),
      recentRenders: this.renderHistory.slice(-50),
      recentStateChanges: this.stateHistory.slice(-50),
      recentCallbacks: this.callbackHistory.slice(-50),
      recentPerf: this.perfHistory.slice(-50),
      suspectedLoops,
    };
  }

  // Clear history
  clear(): void {
    this.renderCounts.clear();
    this.renderHistory.length = 0;
    this.stateHistory.length = 0;
    this.callbackHistory.length = 0;
    this.perfHistory.length = 0;
    this.lastRenderTime.clear();
    console.log('%c[DEBUG] History cleared', 'color: #9E9E9E');
  }

  // Print help
  help(): void {
    console.log(`
%c📊 Debug Logger Help

Enable debugging:
  localStorage.setItem('DEBUG', 'true')           // Enable all
  localStorage.setItem('DEBUG_LEVEL', 'render')   // Only renders
  localStorage.setItem('DEBUG_LEVEL', 'render,state,callback')  // Multiple

Disable:
  localStorage.removeItem('DEBUG')
  localStorage.removeItem('DEBUG_LEVEL')

Available levels: render, state, callback, perf, network, info, warn, error

Console commands:
  __DEBUG__.getReport()     // Get diagnostic report
  __DEBUG__.clear()         // Clear history
  __DEBUG__.help()          // Show this help

Symbols:
  ⚠️ = Warning (slow render, frequent updates)
  🚨 = Potential render loop detected
`, 'color: #4CAF50; font-size: 12px');
  }
}

// Export singleton
export const debug = DebugLogger.getInstance();

// React hooks for debugging
import { useRef, useEffect } from 'react';

export function useRenderLogger(componentName: string, props?: Record<string, unknown>): void {
  const renderCount = useRef(0);
  const prevPropsRef = useRef<Record<string, unknown>>({});

  renderCount.current += 1;

  // Find which props changed
  let cause: string | undefined;
  if (props && renderCount.current > 1) {
    const changedProps: string[] = [];
    for (const [key, value] of Object.entries(props)) {
      if (prevPropsRef.current[key] !== value) {
        changedProps.push(key);
      }
    }
    if (changedProps.length > 0) {
      cause = `props changed: ${changedProps.join(', ')}`;
    }
  }

  debug.logRender(componentName, props, cause);

  if (props) {
    prevPropsRef.current = { ...props };
  }
}

export function useStateLogger<T>(
  componentName: string,
  stateName: string,
  value: T
): void {
  const prevValue = useRef<T>(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      debug.logState(componentName, stateName, prevValue.current, value);
      prevValue.current = value;
    }
  }, [componentName, stateName, value]);
}

export function useCallbackLogger<T extends (...args: unknown[]) => unknown>(
  componentName: string,
  callbackName: string,
  callback: T
): T {
  const wrappedCallback = ((...args: unknown[]) => {
    debug.logCallback(componentName, callbackName, args);
    const result = callback(...args);
    if (result !== undefined) {
      debug.logCallback(componentName, `${callbackName} returned`, undefined, result);
    }
    return result;
  }) as T;

  return wrappedCallback;
}
