import { PluginOption } from 'vite';

type Env = "server" | "client";

type Pattern = string | RegExp;

type Options = Partial<Record<Env, {
    specifiers?: Pattern[];
    files?: Pattern[];
}>>;
declare function export_default(options: Options): PluginOption[];

declare function envOnlyMacros(): PluginOption[];

export { export_default as denyImports, envOnlyMacros };
