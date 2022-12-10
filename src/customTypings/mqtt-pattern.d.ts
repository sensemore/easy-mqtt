//define types for mqtt-pattern package
declare module "mqtt-pattern" {
    export function match(pattern: string, topic: string): boolean;
    export function exec(pattern: string, topic: string): object;
    export function clean(pattern: string): string;
    export function matches(pattern: string, topic: string): boolean;

}