import 'electron';

declare module 'electron' {
  interface App {
    isQuitting?: boolean;
  }
}
